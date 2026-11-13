import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { createWaveSample, sampleOcean, WaveSample } from './oceanSolver';
import { CharacterAnimState, OceanConfig } from './types';

export interface CharacterMoveInput {
  forward: number;  // -1..1 relative to camera yaw
  right: number;    // -1..1 relative to camera yaw
  sprint: boolean;
  jumpPressed: boolean;
  ascendHeld?: boolean;
  descendHeld?: boolean;
  cameraYaw: number;
}

/**
 * Rapier 3D KinematicCharacterController + Buoyant Swimming & Underwater Diving for Kael Rivera.
 * Supports gravity, ground snapping, stair autostepping, sprint, jump, port collisions,
 * water entry, surface swimming, underwater oxygen diving, and vessel helm attachment.
 */
export class KaelCharacterController {
  private readonly world: RAPIER.World;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;

  public readonly position = new THREE.Vector3(-24.0, 1.48, 9.5);
  public headingRad = Math.PI * 0.5;
  public verticalVelocity = 0;
  public horizontalSpeed = 0;
  public grounded = true;
  public animState: CharacterAnimState = 'idle';

  // Swimming & Diving state
  public inWater = false;
  public underwater = false;
  public oxygenSeconds = 45;
  public maxOxygenSeconds = 45;
  public waterDepthM = 0;
  public maxSafeDepthM = 6.5;
  public pressureAtm = 1.0;
  public waterTempC = 23.5;
  public decompressionRiskPct = 0;
  public flashlightOn = false;
  public depthLimitBlocked = false;

  private boardAnimTimer = 0;
  private readonly _desiredMove = new THREE.Vector3();
  private readonly _helmLocalOffset = new THREE.Vector3(0.45, 1.02, 4.18);
  private readonly _tempVec = new THREE.Vector3();
  private readonly waveSample: WaveSample = createWaveSample();

  private readonly centerOffsetY = 0.84;

  constructor(world: RAPIER.World, spawnX = -24.0, spawnY = 1.48, spawnZ = 9.5) {
    this.world = world;
    this.position.set(spawnX, spawnY, spawnZ);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        spawnX,
        spawnY + this.centerOffsetY,
        spawnZ,
      ),
    );

    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.52, 0.32),
      this.body,
    );

    this.controller = world.createCharacterController(0.04);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((52 * Math.PI) / 180);
    this.controller.enableAutostep(0.48, 0.25, true);
    this.controller.enableSnapToGround(0.35);
  }

  public triggerBoardAnim(): void {
    this.boardAnimTimer = 0.42;
  }

  private syncBodyTranslationImmediate(x: number, y: number, z: number): void {
    this.body.setTranslation({ x, y, z }, true);
    const w = this.world as unknown as {
      propagateModifiedBodyPositionsToColliders?: () => void;
      updateSceneQueries?: () => void;
    };
    w.propagateModifiedBodyPositionsToColliders?.();
    w.updateSceneQueries?.();
  }

  public teleportOnFoot(x: number, y: number, z: number, headingRad?: number): void {
    this.position.set(x, y, z);
    this.verticalVelocity = 0;
    this.horizontalSpeed = 0;
    this.inWater = false;
    this.underwater = false;
    this.oxygenSeconds = this.maxOxygenSeconds;
    this.waterDepthM = 0;
    this.decompressionRiskPct = 0;
    this.depthLimitBlocked = false;
    if (headingRad !== undefined) this.headingRad = headingRad;
    this.collider.setEnabled(true);
    this.syncBodyTranslationImmediate(x, y + this.centerOffsetY, z);
  }

  public enterWaterAt(x: number, z: number, time: number, ocean: OceanConfig): void {
    sampleOcean(x, z, time, ocean, this.waveSample);
    const y = this.waveSample.height - 0.55;
    this.position.set(x, y, z);
    this.verticalVelocity = 0;
    this.horizontalSpeed = 0;
    this.inWater = true;
    this.underwater = false;
    this.grounded = false;
    this.decompressionRiskPct = 0;
    this.collider.setEnabled(true);
    this.syncBodyTranslationImmediate(x, y + this.centerOffsetY, z);
  }

  public setAboardMode(aboard: boolean): void {
    this.collider.setEnabled(!aboard);
    if (aboard) {
      this.inWater = false;
      this.underwater = false;
      this.oxygenSeconds = this.maxOxygenSeconds;
      this.waterDepthM = 0;
      this.decompressionRiskPct = 0;
    }
  }

  /**
   * Steps terrestrial walking/running/jumping with Rapier collision resolution.
   * Transitions naturally into swimming if Kael steps off a pier/quay into harbor water.
   */
  public stepOnFoot(
    dt: number,
    input: CharacterMoveInput,
    time = 0,
    ocean?: OceanConfig,
  ): { enteredWater: boolean } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));

    const fwdX = -Math.sin(input.cameraYaw);
    const fwdZ = -Math.cos(input.cameraYaw);
    const rgtX = Math.cos(input.cameraYaw);
    const rgtZ = -Math.sin(input.cameraYaw);

    let moveX = fwdX * input.forward + rgtX * input.right;
    let moveZ = fwdZ * input.forward + rgtZ * input.right;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1e-4) {
      moveX /= len;
      moveZ /= len;
    }

    const targetSpeed = len > 0.05 ? (input.sprint ? 6.8 : 3.8) : 0;
    this.horizontalSpeed += (targetSpeed - this.horizontalSpeed) * (1 - Math.exp(-12 * safeDt));

    if (len > 0.05) {
      const targetHeading = Math.atan2(moveX, moveZ);
      const diff = ((targetHeading - this.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.headingRad += diff * (1 - Math.exp(-12 * safeDt));
    }

    if (this.grounded) {
      this.verticalVelocity = -0.5;
      if (input.jumpPressed) {
        this.verticalVelocity = 6.2;
        this.grounded = false;
      }
    } else {
      this.verticalVelocity = Math.max(-20, this.verticalVelocity - 18.0 * safeDt);
    }

    this._desiredMove.set(
      moveX * this.horizontalSpeed * safeDt,
      this.verticalVelocity * safeDt,
      moveZ * this.horizontalSpeed * safeDt,
    );

    this.controller.computeColliderMovement(this.collider, {
      x: this._desiredMove.x,
      y: this._desiredMove.y,
      z: this._desiredMove.z,
    });

    const corrected = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();

    const cur = this.body.translation();
    const nextX = cur.x + corrected.x;
    const nextY = cur.y + corrected.y;
    const nextZ = cur.z + corrected.z;
    const feetY = nextY - this.centerOffsetY;

    let surfaceY = 0;
    if (ocean) {
      sampleOcean(nextX, nextZ, time, ocean, this.waveSample);
      surfaceY = this.waveSample.height;
    }

    if (feetY < surfaceY - 0.35) {
      this.inWater = true;
      this.underwater = false;
      this.grounded = false;
      this.verticalVelocity = 0;
      const swimY = surfaceY - 0.55;
      this.body.setTranslation({ x: nextX, y: swimY + this.centerOffsetY, z: nextZ }, true);
      this.position.set(nextX, swimY, nextZ);
      this.animState = 'swim';
      return { enteredWater: true };
    }

    this.body.setTranslation({ x: nextX, y: nextY, z: nextZ }, true);
    this.position.set(nextX, feetY, nextZ);

    if (this.boardAnimTimer > 0) {
      this.boardAnimTimer = Math.max(0, this.boardAnimTimer - safeDt);
      this.animState = 'board';
    } else if (!this.grounded && this.verticalVelocity > 0.5) {
      this.animState = 'jump';
    } else if (this.horizontalSpeed > 4.9) {
      this.animState = 'run';
    } else if (this.horizontalSpeed > 0.35) {
      this.animState = 'walk';
    } else {
      this.animState = 'idle';
    }
    return { enteredWater: false };
  }

  /**
   * Steps buoyant surface swimming and underwater diving with oxygen, equipment depth limits,
   * ocean current drift, pressure, and simplified decompression mechanics.
   */
  public stepInWater(
    dt: number,
    time: number,
    ocean: OceanConfig,
    input: CharacterMoveInput,
    hasDiveMask: boolean,
    hasScubaTank: boolean,
    hasDiveComputer = false,
    divingSkillLevel = 1,
  ): { oxygenDepleted: boolean } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    const skillAirBoost = 1 + (Math.max(1, divingSkillLevel) - 1) * 0.06;
    this.maxOxygenSeconds = Math.round((hasScubaTank ? 150 : 45) * skillAirBoost);

    // Equipment-gated safe diving depth (prevents unrealistic deep dives without gear)
    this.maxSafeDepthM = hasScubaTank
      ? hasDiveComputer
        ? 18.0
        : 13.5
      : hasDiveMask
        ? 9.0
        : 7.0;

    const fwdX = -Math.sin(input.cameraYaw);
    const fwdZ = -Math.cos(input.cameraYaw);
    const rgtX = Math.cos(input.cameraYaw);
    const rgtZ = -Math.sin(input.cameraYaw);

    let moveX = fwdX * input.forward + rgtX * input.right;
    let moveZ = fwdZ * input.forward + rgtZ * input.right;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1e-4) {
      moveX /= len;
      moveZ /= len;
    }

    const maskBoost = hasDiveMask ? 1.25 : 1.0;
    const targetSpeed = len > 0.05 ? (input.sprint ? 3.9 : 2.6) * maskBoost : 0;
    this.horizontalSpeed += (targetSpeed - this.horizontalSpeed) * (1 - Math.exp(-6 * safeDt));

    if (len > 0.05) {
      const targetHeading = Math.atan2(moveX, moveZ);
      const diff = ((targetHeading - this.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.headingRad += diff * (1 - Math.exp(-8 * safeDt));
    }

    sampleOcean(this.position.x, this.position.z, time, ocean, this.waveSample);
    const surfaceY = this.waveSample.height - 0.55;

    let targetVy = 0;
    if (input.descendHeld) {
      targetVy = -2.4 * maskBoost;
    } else if (input.ascendHeld) {
      targetVy = 2.6 * maskBoost;
    } else if (this.position.y < surfaceY - 0.4 && this.underwater) {
      targetVy = 0.05;
    } else {
      targetVy = (surfaceY - this.position.y) * 5.0;
    }

    this.verticalVelocity += (targetVy - this.verticalVelocity) * (1 - Math.exp(-7 * safeDt));

    // Ocean current advection underwater & surface
    const curRad = (ocean.currentDirDeg * Math.PI) / 180;
    const curDriftScale = this.underwater ? 0.35 : 0.55;
    const curVx = Math.sin(curRad) * ocean.currentSpeed * curDriftScale;
    const curVz = -Math.cos(curRad) * ocean.currentSpeed * curDriftScale;

    this._desiredMove.set(
      (moveX * this.horizontalSpeed + curVx) * safeDt,
      this.verticalVelocity * safeDt,
      (moveZ * this.horizontalSpeed + curVz) * safeDt,
    );

    this.controller.computeColliderMovement(this.collider, {
      x: this._desiredMove.x,
      y: this._desiredMove.y,
      z: this._desiredMove.z,
    });

    const corrected = this.controller.computedMovement();
    const cur = this.body.translation();
    const nextX = cur.x + corrected.x;

    // Enforce seabed floor (-16m coastal pocket / -8.8m inner reefs) & equipment depth cap
    const maxAllowedFloorY = Math.max(-16.5, this.waveSample.height - this.maxSafeDepthM - 0.8);
    const minCenterY = maxAllowedFloorY + this.centerOffsetY;
    const maxCenterY = surfaceY + 0.35 + this.centerOffsetY;
    const rawY = cur.y + corrected.y;
    this.depthLimitBlocked = Boolean(input.descendHeld && rawY <= minCenterY + 0.15);
    const nextY = Math.max(minCenterY, Math.min(maxCenterY, rawY));
    const nextZ = cur.z + corrected.z;

    this.body.setTranslation({ x: nextX, y: nextY, z: nextZ }, true);
    this.position.set(nextX, nextY - this.centerOffsetY, nextZ);

    this.waterDepthM = Math.max(0, this.waveSample.height - this.position.y - 0.6);
    this.underwater = this.waterDepthM > 0.65;
    this.pressureAtm = Math.round((1 + this.waterDepthM / 10) * 100) / 100;
    this.waterTempC = Math.round((23.8 - Math.min(6.5, this.waterDepthM * 0.28)) * 10) / 10;

    // Simplified gameplay decompression indicator (ascend smoothly at shallow stop)
    if (this.waterDepthM > 8.5) {
      const rate = hasDiveComputer ? 1.6 : 2.9;
      this.decompressionRiskPct = Math.min(100, this.decompressionRiskPct + rate * safeDt);
    } else if (this.waterDepthM <= 4.0) {
      this.decompressionRiskPct = Math.max(0, this.decompressionRiskPct - 6.5 * safeDt);
    }

    let oxygenDepleted = false;
    if (this.underwater) {
      const pressureAirDrain = 1 + Math.max(0, this.waterDepthM - 5) * 0.04;
      this.oxygenSeconds = Math.max(0, this.oxygenSeconds - safeDt * pressureAirDrain);
      if (this.oxygenSeconds <= 0) {
        oxygenDepleted = true;
        this.position.y = surfaceY;
        this.body.setTranslation({ x: nextX, y: surfaceY + this.centerOffsetY, z: nextZ }, true);
        this.underwater = false;
        this.oxygenSeconds = this.maxOxygenSeconds * 0.4;
      }
    } else {
      this.oxygenSeconds = Math.min(this.maxOxygenSeconds, this.oxygenSeconds + safeDt * 18);
    }

    this.animState = this.underwater ? 'dive' : 'swim';
    return { oxygenDepleted };
  }

  /**
   * Positions Kael smoothly in the Aster S-01 cockpit helm when sailing.
   */
  public syncAboardVessel(
    dt: number,
    boatPos: THREE.Vector3,
    boatQuat: THREE.Quaternion,
    boatEulerY: number,
  ): void {
    this._tempVec.copy(this._helmLocalOffset).applyQuaternion(boatQuat).add(boatPos);
    this.position.copy(this._tempVec);
    this.headingRad = boatEulerY + Math.PI;
    this.grounded = true;
    this.inWater = false;
    this.underwater = false;
    this.horizontalSpeed = 0;

    if (this.boardAnimTimer > 0) {
      this.boardAnimTimer = Math.max(0, this.boardAnimTimer - dt);
      this.animState = 'board';
    } else {
      this.animState = 'steer';
    }
  }

  public dispose(): void {
    try {
      this.world.removeCharacterController(this.controller);
      this.world.removeRigidBody(this.body);
    } catch {
      // Ignore if world disposed
    }
  }
}
