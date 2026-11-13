import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { DamagePerformanceModifiers } from './damageSystem';
import { createWaveSample, GRAVITY, sampleOcean, WaveSample } from './oceanSolver';
import { computeSailAerodynamics, createSailAeroResult, SailAeroResult } from './sailAerodynamics';
import {
  ControlInputs,
  OceanConfig,
  TelemetrySnapshot,
  VesselConfig,
  WeatherPresetId,
  WindConfig,
} from './types';
import { createWindSample, MS_TO_KNOTS, sampleWindField, WindSample } from './windField';

export interface BuoyancyElement {
  localX: number;
  localY: number;
  localZ: number;
  radius: number;
  volumeM3: number;
  // Runtime debug state
  worldX: number;
  worldY: number;
  worldZ: number;
  submergedRatio: number;
}

export interface PhysicsDebugVectors {
  buoyancyElements: BuoyancyElement[];
  aeroForce: THREE.Vector3;
  aeroOrigin: THREE.Vector3;
  apparentWind: THREE.Vector3;
  keelLift: THREE.Vector3;
  hydroDrag: THREE.Vector3;
}

let rapierInitPromise: Promise<void> | null = null;
export function ensureRapierInitialized(): Promise<void> {
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init();
  }
  return rapierInitPromise;
}

/**
 * 6-DOF Naval Rigid Body Physics Engine powered by Rapier 3D (WebAssembly).
 * Computes volumetric buoyancy, hydrodynamic drag, keel anti-leeway lift,
 * rudder torque, auxiliary propulsion, and aerodynamic sail forces.
 */
export class NavalPhysicsWorld {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private hullCollider: RAPIER.Collider;
  private keelCollider: RAPIER.Collider;

  public readonly buoyancyElements: BuoyancyElement[] = [];
  private readonly waveSample: WaveSample = createWaveSample();
  private readonly windSample: WindSample = createWindSample();
  private readonly aeroResult: SailAeroResult = createSailAeroResult();

  private currentBoomAngleRad = 0.25;
  private currentRudderRad = 0;
  private simTime = 0;
  private distanceMeters = 0;
  private lastMassKg = 6800;
  private lastComY = 0;
  private lastComZ = 0;

  // Reusable math scratch objects (zero GC in loop)
  private readonly _pos = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _up = new THREE.Vector3();
  private readonly _linVel = new THREE.Vector3();
  private readonly _angVel = new THREE.Vector3();
  private readonly _elemWorld = new THREE.Vector3();
  private readonly _rVec = new THREE.Vector3();
  private readonly _pointVel = new THREE.Vector3();
  private readonly _relWaterVel = new THREE.Vector3();
  private readonly _forceVec = new THREE.Vector3();
  private readonly _torqueVec = new THREE.Vector3();

  // Telemetry accumulators
  private lastBuoyancyTotalN = 0;
  private lastDragTotalN = 0;
  private lastKeelLiftN = 0;
  private lastAuxThrustN = 0;
  private lastSubmergedCount = 0;
  private lastWaveHeightAtBoat = 0;

  public readonly debugVectors: PhysicsDebugVectors;

  public moored = false;
  private mooringX = 16.5;
  private mooringZ = 12.0;

  constructor(initialVessel: VesselConfig, spawnX = 0, spawnZ = 0, headingDeg = 0) {
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });

    const yawRad = (-headingDeg * Math.PI) / 180;
    this._euler.set(0, yawRad, 0, 'YXZ');
    this._quat.setFromEuler(this._euler);

    const rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, 0.28, spawnZ)
      .setRotation({ x: this._quat.x, y: this._quat.y, z: this._quat.z, w: this._quat.w })
      .setCanSleep(false);
    this.body = this.world.createRigidBody(rbDesc);
    this.mooringX = spawnX;
    this.mooringZ = spawnZ;

    this.lastMassKg = initialVessel.massKg;
    this.lastComY = initialVessel.comOffsetY;
    this.lastComZ = initialVessel.comOffsetZ;

    // Hull main displacement collider (~58% mass)
    this.hullCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.65, 0.65, 5.4)
        .setTranslation(0, 0.35 + initialVessel.comOffsetY * 0.25, initialVessel.comOffsetZ)
        .setMass(initialVessel.massKg * 0.58),
      this.body,
    );

    // Ballast keel collider (~42% mass low below waterline for authentic righting moment)
    this.keelCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.22, 0.92, 1.1)
        .setTranslation(0, -1.25 + initialVessel.comOffsetY, 0.15 + initialVessel.comOffsetZ)
        .setMass(initialVessel.massKg * 0.42),
      this.body,
    );

    this.initBuoyancyElements();

    this.debugVectors = {
      buoyancyElements: this.buoyancyElements,
      aeroForce: new THREE.Vector3(),
      aeroOrigin: new THREE.Vector3(),
      apparentWind: new THREE.Vector3(),
      keelLift: new THREE.Vector3(),
      hydroDrag: new THREE.Vector3(),
    };
  }

  /**
   * Distributes 24 volumetric buoyancy cells along the 12m Aster S-01 hull stations.
   * Total volume (~14.5 m^3) gives comfortable reserve buoyancy (~14,800 kg max displacement)
   * so nominal 6,800 kg floats cleanly near the designed waterline (y ~ 0).
   */
  private initBuoyancyElements(): void {
    // Stations from Bow (-Z) to Stern (+Z)
    const stations: Array<{ z: number; halfBeam: number; keelY: number; vol: number }> = [
      { z: -5.1, halfBeam: 0.28, keelY: -0.22, vol: 0.28 },
      { z: -3.6, halfBeam: 0.72, keelY: -0.45, vol: 0.62 },
      { z: -1.8, halfBeam: 1.25, keelY: -0.58, vol: 0.92 },
      { z: 0.0, halfBeam: 1.52, keelY: -0.64, vol: 1.08 },
      { z: 1.9, halfBeam: 1.44, keelY: -0.56, vol: 0.98 },
      { z: 3.7, halfBeam: 1.18, keelY: -0.42, vol: 0.78 },
      { z: 5.2, halfBeam: 0.88, keelY: -0.25, vol: 0.54 },
    ];

    for (const st of stations) {
      // Port, Centerline, Starboard cells at each station
      const lateralOffsets =
        st.halfBeam < 0.45 ? [0] : [-st.halfBeam * 0.72, 0, st.halfBeam * 0.72];
      const perCellVol = st.vol / lateralOffsets.length * 1.45;
      for (const lx of lateralOffsets) {
        const yOff = lx === 0 ? st.keelY : st.keelY * 0.55;
        this.buoyancyElements.push({
          localX: lx,
          localY: yOff,
          localZ: st.z,
          radius: 0.46,
          volumeM3: perCellVol,
          worldX: lx,
          worldY: yOff,
          worldZ: st.z,
          submergedRatio: 0,
        });
      }
    }

    // Add 3 upper deck reserve buoyancy cells (prevents hull from ever sinking/capsizing under extreme waves)
    this.buoyancyElements.push(
      { localX: -1.25, localY: 0.62, localZ: -0.4, radius: 0.45, volumeM3: 0.85, worldX: 0, worldY: 0, worldZ: 0, submergedRatio: 0 },
      { localX: 1.25, localY: 0.62, localZ: -0.4, radius: 0.45, volumeM3: 0.85, worldX: 0, worldY: 0, worldZ: 0, submergedRatio: 0 },
      { localX: 0, localY: 0.72, localZ: -4.2, radius: 0.48, volumeM3: 0.75, worldX: 0, worldY: 0, worldZ: 0, submergedRatio: 0 },
    );
  }

  public syncMassProperties(vessel: VesselConfig): void {
    if (
      Math.abs(vessel.massKg - this.lastMassKg) > 5 ||
      Math.abs(vessel.comOffsetY - this.lastComY) > 0.005 ||
      Math.abs(vessel.comOffsetZ - this.lastComZ) > 0.005
    ) {
      this.lastMassKg = vessel.massKg;
      this.lastComY = vessel.comOffsetY;
      this.lastComZ = vessel.comOffsetZ;
      this.hullCollider.setMass(vessel.massKg * 0.58);
      this.keelCollider.setMass(vessel.massKg * 0.42);
      this.hullCollider.setTranslationWrtParent({
        x: 0,
        y: 0.35 + vessel.comOffsetY * 0.25,
        z: vessel.comOffsetZ,
      });
      this.keelCollider.setTranslationWrtParent({
        x: 0,
        y: -1.25 + vessel.comOffsetY,
        z: 0.15 + vessel.comOffsetZ,
      });
    }
  }

  public getWorld(): RAPIER.World {
    return this.world;
  }

  public setMoored(moored: boolean, anchorX?: number, anchorZ?: number): void {
    this.moored = moored;
    if (anchorX !== undefined && anchorZ !== undefined) {
      this.mooringX = anchorX;
      this.mooringZ = anchorZ;
    } else if (moored) {
      const t = this.body.translation();
      this.mooringX = t.x;
      this.mooringZ = t.z;
    }
  }

  public shiftOrigin(dx: number, dz: number): void {
    const t = this.body.translation();
    this.body.setTranslation({ x: t.x - dx, y: t.y, z: t.z - dz }, true);
    this.mooringX -= dx;
    this.mooringZ -= dz;
  }

  public applyExternalBump(pushX: number, pushZ: number): number {
    const t = this.body.translation();
    const lv = this.body.linvel();
    const len = Math.hypot(pushX, pushZ);
    if (len < 1e-5) return 0;
    const nx = pushX / len;
    const nz = pushZ / len;
    const vn = lv.x * nx + lv.z * nz;
    const impactSpeed = vn < 0 ? -vn : 0;

    this.body.setTranslation({ x: t.x + pushX, y: t.y, z: t.z + pushZ }, true);
    if (vn < 0) {
      this.body.setLinvel(
        {
          x: lv.x - 1.35 * vn * nx,
          y: lv.y * 0.85,
          z: lv.z - 1.35 * vn * nz,
        },
        true,
      );
    }
    return impactSpeed;
  }

  public resetVessel(x = 0, z = 0, headingDeg = 0, moored = false): void {
    const yawRad = (-headingDeg * Math.PI) / 180;
    this._euler.set(0, yawRad, 0, 'YXZ');
    this._quat.setFromEuler(this._euler);

    this.body.setTranslation({ x, y: 0.28, z }, true);
    this.body.setRotation({ x: this._quat.x, y: this._quat.y, z: this._quat.z, w: this._quat.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.currentBoomAngleRad = 0.25;
    this.currentRudderRad = 0;
    this.moored = moored;
    this.mooringX = x;
    this.mooringZ = z;
  }

  public step(
    dt: number,
    ocean: OceanConfig,
    wind: WindConfig,
    vessel: VesselConfig,
    controls: ControlInputs,
    modifiers?: DamagePerformanceModifiers,
  ): void {
    this.simTime += dt;
    this.syncMassProperties(vessel);

    this.body.resetForces(true);
    this.body.resetTorques(true);

    // Extract current pose & velocities
    const t = this.body.translation();
    const r = this.body.rotation();
    const lv = this.body.linvel();
    const av = this.body.angvel();

    this._pos.set(t.x, t.y, t.z);
    this._quat.set(r.x, r.y, r.z, r.w);
    this._linVel.set(lv.x, lv.y, lv.z);
    this._angVel.set(av.x, av.y, av.z);

    this._forward.set(0, 0, -1).applyQuaternion(this._quat).normalize();
    this._right.set(1, 0, 0).applyQuaternion(this._quat).normalize();
    this._up.set(0, 1, 0).applyQuaternion(this._quat).normalize();

    // Smooth rudder actuation
    const maxRudderRad = (34 * Math.PI) / 180;
    const targetRudderRad = controls.rudderTarget * maxRudderRad;
    this.currentRudderRad += (targetRudderRad - this.currentRudderRad) * (1 - Math.exp(-8.5 * dt));

    // 1. Volumetric Buoyancy Elements
    let totalBuoyancyN = 0;
    let submergedCount = 0;
    let avgWaterVelX = 0;
    let avgWaterVelY = 0;
    let avgWaterVelZ = 0;
    let waveHAccum = 0;

    for (let i = 0; i < this.buoyancyElements.length; i++) {
      const el = this.buoyancyElements[i];
      this._elemWorld.set(el.localX, el.localY, el.localZ).applyQuaternion(this._quat).add(this._pos);
      el.worldX = this._elemWorld.x;
      el.worldY = this._elemWorld.y;
      el.worldZ = this._elemWorld.z;

      sampleOcean(el.worldX, el.worldZ, this.simTime, ocean, this.waveSample);
      waveHAccum += this.waveSample.height;

      const depth = this.waveSample.height - el.worldY;
      const submerged = Math.max(0, Math.min(1, (depth + el.radius) / (2 * el.radius)));
      el.submergedRatio = submerged;

      if (submerged > 0.001) {
        submergedCount++;
        avgWaterVelX += this.waveSample.velX;
        avgWaterVelY += this.waveSample.velY;
        avgWaterVelZ += this.waveSample.velZ;

        // Archimedes upward force
        const buoyForce = ocean.waterDensity * GRAVITY * el.volumeM3 * submerged;

        // Point velocity = linVel + angVel x (elemWorld - pos)
        this._rVec.copy(this._elemWorld).sub(this._pos);
        this._pointVel.crossVectors(this._angVel, this._rVec).add(this._linVel);

        // Local vertical heave damping against water orbital velocity
        const relVy = this._pointVel.y - this.waveSample.velY;
        const vertDamp = -relVy * 950 * submerged * vessel.hullDamping;

        const netUp = Math.max(-buoyForce * 0.5, buoyForce + vertDamp);
        totalBuoyancyN += buoyForce;

        this.body.addForceAtPoint(
          { x: 0, y: netUp, z: 0 },
          { x: el.worldX, y: el.worldY, z: el.worldZ },
          true,
        );
      }
    }

    this.lastWaveHeightAtBoat = waveHAccum / this.buoyancyElements.length;
    this.lastBuoyancyTotalN = totalBuoyancyN;
    this.lastSubmergedCount = submergedCount;

    const submersionFactor = submergedCount / this.buoyancyElements.length;
    if (submergedCount > 0) {
      avgWaterVelX /= submergedCount;
      avgWaterVelY /= submergedCount;
      avgWaterVelZ /= submergedCount;
    }

    // 2. Hydrodynamic Hull Drag, Keel Anti-Leeway Lift & Rudder Steering
    this._relWaterVel.set(
      this._linVel.x - avgWaterVelX,
      this._linVel.y - avgWaterVelY,
      this._linVel.z - avgWaterVelZ,
    );

    const surgeSpeed = this._relWaterVel.dot(this._forward);
    const swaySpeed = this._relWaterVel.dot(this._right);
    const heaveSpeed = this._relWaterVel.dot(this._up);
    const horizSpeed = Math.hypot(surgeSpeed, swaySpeed);

    let dragMagTotal = 0;
    let keelLiftN = 0;

    if (submersionFactor > 0.05) {
      const dMul =
        vessel.hullDamping *
        Math.min(1.2, submersionFactor * 1.4) *
        (modifiers?.dragPenaltyScale ?? 1);

      // Longitudinal hull drag (streamlined bow vs flat transom reverse)
      const surgeCd = surgeSpeed >= 0 ? 48 : 95;
      const surgeDrag = -(surgeCd * surgeSpeed * Math.abs(surgeSpeed) + 85 * surgeSpeed) * dMul;

      // Lateral hull + keel drag (very high lateral resistance to prevent sideways skidding)
      const swayDrag = -(620 * swaySpeed * Math.abs(swaySpeed) + 520 * swaySpeed) * dMul;

      // Vertical hull damping
      const heaveDrag = -(480 * heaveSpeed * Math.abs(heaveSpeed) + 420 * heaveSpeed) * dMul;

      // Keel hydrodynamic anti-leeway lift (acts at keel depth y = -1.1m)
      // Converts leeway angle into strong restoring force + realistic heel resistance
      const leewayRad = Math.atan2(swaySpeed, Math.max(0.4, Math.abs(surgeSpeed)));
      const keelCl = Math.sin(2 * leewayRad) * 1.35;
      const keelArea = 2.6;
      const keelForceLat = -0.5 * ocean.waterDensity * horizSpeed * horizSpeed * keelArea * keelCl * 0.45;
      keelLiftN = Math.abs(keelForceLat);

      this._forceVec
        .set(0, 0, 0)
        .addScaledVector(this._forward, surgeDrag)
        .addScaledVector(this._right, swayDrag + keelForceLat)
        .addScaledVector(this._up, heaveDrag);

      dragMagTotal = this._forceVec.length();
      this.debugVectors.hydroDrag.copy(this._forceVec);
      this.debugVectors.keelLift.copy(this._right).multiplyScalar(keelForceLat);

      // Apply keel + sway drag slightly below CoM so leeway/keel reacts with sails
      this._elemWorld.set(0, -0.55, 0.1).applyQuaternion(this._quat).add(this._pos);
      this.body.addForceAtPoint(
        { x: this._forceVec.x, y: this._forceVec.y, z: this._forceVec.z },
        { x: this._elemWorld.x, y: this._elemWorld.y, z: this._elemWorld.z },
        true,
      );

      // Angular hydrodynamic damping (Roll, Pitch, Yaw)
      const localRollRate = this._angVel.dot(this._forward);
      const localPitchRate = this._angVel.dot(this._right);
      const localYawRate = this._angVel.dot(this._up);

      this._torqueVec
        .set(0, 0, 0)
        .addScaledVector(this._forward, -localRollRate * 11500 * dMul)
        .addScaledVector(this._right, -localPitchRate * 18500 * dMul)
        .addScaledVector(this._up, -localYawRate * (14500 + 3800 * horizSpeed) * dMul);

      this.body.addTorque(
        { x: this._torqueVec.x, y: this._torqueVec.y, z: this._torqueVec.z },
        true,
      );
    } else {
      this.debugVectors.hydroDrag.set(0, 0, 0);
      this.debugVectors.keelLift.set(0, 0, 0);
    }
    this.lastDragTotalN = dragMagTotal;
    this.lastKeelLiftN = keelLiftN;

    // 3. Auxiliary Motor & Articulated Rudder
    const auxThrustN =
      controls.throttle *
      vessel.maxAuxThrustN *
      (modifiers?.engineThrustScale ?? 1) *
      (submersionFactor > 0.15 ? 1 : 0);
    this.lastAuxThrustN = auxThrustN;

    if (Math.abs(auxThrustN) > 1) {
      this._elemWorld.set(0, -0.45, 4.6).applyQuaternion(this._quat).add(this._pos);
      this.body.addForceAtPoint(
        {
          x: this._forward.x * auxThrustN,
          y: this._forward.y * auxThrustN,
          z: this._forward.z * auxThrustN,
        },
        { x: this._elemWorld.x, y: this._elemWorld.y, z: this._elemWorld.z },
        true,
      );
    }

    // Rudder effectiveness scales with boat water speed + auxiliary propwash + rudder integrity
    if (submersionFactor > 0.1) {
      const propWashSpeed = Math.max(0, controls.throttle) * 2.4;
      const flowOverRudder = Math.abs(surgeSpeed) + propWashSpeed;
      const rudderDirSign = surgeSpeed >= -0.35 ? 1 : -1;
      // Rudder deflection to +angle (D key -> starboard turn) creates lateral force at stern (-right) -> clockwise yaw (-Y)
      const rudderLatForce =
        -Math.sin(this.currentRudderRad) *
        0.5 *
        ocean.waterDensity *
        0.55 *
        flowOverRudder *
        Math.max(0.8, flowOverRudder) *
        rudderDirSign *
        (modifiers?.rudderAuthorityScale ?? 1);

      this._elemWorld.set(0, -0.5, 4.95).applyQuaternion(this._quat).add(this._pos);
      this.body.addForceAtPoint(
        {
          x: this._right.x * rudderLatForce,
          y: 0,
          z: this._right.z * rudderLatForce,
        },
        { x: this._elemWorld.x, y: this._elemWorld.y, z: this._elemWorld.z },
        true,
      );
    }

    // 4. WindField & Sail Aerodynamics
    const coeWorldX = this._pos.x + this._up.x * 5.8;
    const coeWorldY = this._pos.y + this._up.y * 5.8;
    const coeWorldZ = this._pos.z + this._up.z * 5.8;

    sampleWindField(
      coeWorldX,
      Math.max(1, coeWorldY),
      coeWorldZ,
      this.simTime,
      this._linVel.x,
      this._linVel.y,
      this._linVel.z,
      this._forward.x,
      this._forward.z,
      this._right.x,
      this._right.z,
      wind,
      this.windSample,
    );

    const effectiveControls =
      modifiers && controls.sailArea > modifiers.maxSafeSailArea
        ? { ...controls, sailArea: modifiers.maxSafeSailArea }
        : controls;

    computeSailAerodynamics(
      this.windSample,
      effectiveControls,
      this._forward.x,
      this._forward.z,
      this._right.x,
      this._right.z,
      this._up.x,
      this._up.y,
      this._up.z,
      this.currentBoomAngleRad,
      dt,
      this.aeroResult,
    );
    this.currentBoomAngleRad = this.aeroResult.boomAngleRad;

    const sailEff = modifiers?.sailEfficiencyScale ?? 1;
    if (sailEff !== 1) {
      this.aeroResult.forceWorldX *= sailEff;
      this.aeroResult.forceWorldY *= sailEff;
      this.aeroResult.forceWorldZ *= sailEff;
      this.aeroResult.totalForceN *= sailEff;
      this.aeroResult.forwardForceN *= sailEff;
      this.aeroResult.lateralForceN *= sailEff;
    }

    this.debugVectors.apparentWind.set(
      this.windSample.apparentX,
      this.windSample.apparentY,
      this.windSample.apparentZ,
    );
    this.debugVectors.aeroForce.set(
      this.aeroResult.forceWorldX,
      this.aeroResult.forceWorldY,
      this.aeroResult.forceWorldZ,
    );

    if (this.aeroResult.totalForceN > 0.5) {
      // Apply aerodynamic force at Center of Effort (high on mast -> realistic heel!)
      this._elemWorld
        .set(0, this.aeroResult.centerOfEffortY, this.aeroResult.centerOfEffortZ)
        .applyQuaternion(this._quat)
        .add(this._pos);
      this.debugVectors.aeroOrigin.copy(this._elemWorld);

      this.body.addForceAtPoint(
        {
          x: this.aeroResult.forceWorldX,
          y: this.aeroResult.forceWorldY,
          z: this.aeroResult.forceWorldZ,
        },
        { x: this._elemWorld.x, y: this._elemWorld.y, z: this._elemWorld.z },
        true,
      );
    } else {
      this.debugVectors.aeroOrigin.copy(this._pos).addScaledVector(this._up, 4);
    }

    // 5. Gentle hydrostatic righting safeguard if extreme storm waves ever roll > 78 deg
    if (this._up.y < 0.25) {
      const rightingTorque = (0.35 - this._up.y) * 28000;
      const rollSign = this._right.y >= 0 ? 1 : -1;
      this.body.addTorque(
        {
          x: this._forward.x * rightingTorque * rollSign,
          y: 0,
          z: this._forward.z * rightingTorque * rollSign,
        },
        true,
      );
    }

    // 5b. Gentle spring mooring lines when berthed at pier (keeps heave/roll/pitch natural!)
    if (this.moored) {
      const dxM = this.mooringX - this._pos.x;
      const dzM = this.mooringZ - this._pos.z;
      this.body.addForce(
        {
          x: dxM * 3200 - this._linVel.x * 4200,
          y: 0,
          z: dzM * 3200 - this._linVel.z * 4200,
        },
        true,
      );
    }

    // Step Rapier 3D world
    this.world.timestep = dt;
    this.world.step();

    // Accumulate sailed distance
    const horizStepDist = Math.hypot(this._linVel.x, this._linVel.z) * dt;
    this.distanceMeters += horizStepDist;
  }

  public getPose(outPos: THREE.Vector3, outQuat: THREE.Quaternion): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    outPos.set(t.x, t.y, t.z);
    outQuat.set(r.x, r.y, r.z, r.w);
  }

  public getBoomAngleRad(): number {
    return this.currentBoomAngleRad;
  }

  public getJibAngleRad(): number {
    return this.aeroResult.jibAngleRad;
  }

  public getRudderAngleRad(): number {
    return this.currentRudderRad;
  }

  public getClothPressure(): number {
    return this.aeroResult.clothPressure;
  }

  public getLuffingFactor(): number {
    return this.aeroResult.luffingFactor;
  }

  public getSimTime(): number {
    return this.simTime;
  }

  public fillTelemetry(
    fps: number,
    wind: WindConfig,
    controls: ControlInputs,
    weatherPreset: WeatherPresetId,
    out: TelemetrySnapshot,
  ): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    const lv = this.body.linvel();
    const av = this.body.angvel();

    this._quat.set(r.x, r.y, r.z, r.w);
    this._euler.setFromQuaternion(this._quat, 'YXZ');

    // Heading: yaw=0 -> 0° North (-Z), yaw=-PI/2 -> 90° East (+X)
    let headingDeg = (-this._euler.y * 180) / Math.PI;
    headingDeg = ((headingDeg % 360) + 360) % 360;

    const speedMs = Math.hypot(lv.x, lv.z);
    let cogDeg = headingDeg;
    if (speedMs > 0.2) {
      cogDeg = (Math.atan2(lv.x, -lv.z) * 180) / Math.PI;
      cogDeg = ((cogDeg % 360) + 360) % 360;
    }

    let leewayDeg = cogDeg - headingDeg;
    if (leewayDeg > 180) leewayDeg -= 360;
    if (leewayDeg < -180) leewayDeg += 360;

    out.timestamp = Date.now();
    out.fps = Math.round(fps);
    out.simTime = this.simTime;
    out.posX = t.x;
    out.posZ = t.z;
    out.posY = t.y;
    out.distanceNm = this.distanceMeters / 1852;
    out.speedMs = speedMs;
    out.speedKnots = speedMs * MS_TO_KNOTS;
    out.headingDeg = headingDeg;
    out.courseOverGroundDeg = cogDeg;
    out.leewayDeg = leewayDeg;
    out.rollDeg = (this._euler.z * 180) / Math.PI;
    out.pitchDeg = (this._euler.x * 180) / Math.PI;
    out.yawRateDegS = (-av.y * 180) / Math.PI;

    out.trueWindKnots = this.windSample.trueSpeedMs * MS_TO_KNOTS;
    out.trueWindDirDeg = wind.directionDeg;
    out.apparentWindKnots = this.windSample.apparentSpeedMs * MS_TO_KNOTS;
    out.apparentWindRelDeg = (this.windSample.apparentRelAngleRad * 180) / Math.PI;
    out.boomAngleDeg = (this.currentBoomAngleRad * 180) / Math.PI;
    out.sailAreaPct = Math.round(controls.sailArea * 100);
    out.sailTrimPct = Math.round(controls.sailTrim * 100);
    out.inNoGoZone = this.aeroResult.inNoGoZone;
    out.luffingFactor = this.aeroResult.luffingFactor;

    out.aeroForceN = this.aeroResult.totalForceN;
    out.aeroForwardN = this.aeroResult.forwardForceN;
    out.aeroLateralN = this.aeroResult.lateralForceN;
    out.buoyancyForceN = this.lastBuoyancyTotalN;
    out.hydroDragN = this.lastDragTotalN;
    out.keelLiftN = this.lastKeelLiftN;
    out.auxThrustN = this.lastAuxThrustN;
    out.submergedElements = this.lastSubmergedCount;
    out.totalElements = this.buoyancyElements.length;

    out.throttle = controls.throttle;
    out.rudderDeg = (this.currentRudderRad * 180) / Math.PI;
    out.waveHeightAtBoat = this.lastWaveHeightAtBoat;
    out.weatherPreset = weatherPreset;
  }

  public dispose(): void {
    this.world.free();
  }
}
