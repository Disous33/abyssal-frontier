import * as THREE from 'three';
import { createWaveSample, sampleOcean, WaveSample } from './oceanSolver';
import { OceanConfig, SonarContact, SubmarineTelemetrySnapshot } from './types';

export interface SubmarineInput {
  throttle: number; // -1..1 (W/S)
  steer: number;    // -1..1 (A/D)
  ascend: boolean;  // Q
  descend: boolean; // E
}

export interface SonarSceneObject {
  id: string;
  label: string;
  kind: SonarContact['kind'];
  x: number;
  y: number;
  z: number;
}

/**
 * Dedicated 3D underwater physics & sonar controller for the NEREID S-1 research submersible.
 * Separate dynamics from surface sailboats: dynamic ballast trim, quadratic hydrodynamic drag,
 * twin-thruster propulsion, depth/pressure calculation, battery management, and active sonar
 * querying real world scene targets.
 */
export class SubmarineController {
  public readonly position = new THREE.Vector3(24.0, -1.8, 18.0);
  public readonly velocity = new THREE.Vector3(0, 0, 0);
  public headingRad = Math.PI; // Facing south toward channel exit
  public pitchRad = 0;
  public rollRad = 0;

  public readonly modelName = 'NEREID S-1';
  public ballastPct = 50; // 0 = buoyant surface, 50 = neutral, 100 = dive heavy
  public batteryPct = 100;
  public hullPct = 100;
  public maxSafeDepthM = 85;
  public headlightsOn = true;
  public armBusy = false;
  private armTimer = 0;

  public sonarSweepDeg = 0;
  public sonarRangeM = 340;
  public sonarContacts: SonarContact[] = [];
  private lastSonarScanTime = -10;

  private readonly waveSample: WaveSample = createWaveSample();

  public resetAt(x: number, y: number, z: number, headingDeg = 180): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.headingRad = (headingDeg * Math.PI) / 180;
    this.pitchRad = 0;
    this.rollRad = 0;
    this.ballastPct = 52;
  }

  public shiftOrigin(dx: number, dz: number): void {
    this.position.x -= dx;
    this.position.z -= dz;
  }

  public triggerArm(): void {
    this.armTimer = 0.75;
    this.armBusy = true;
  }

  public getDepthM(time: number, ocean: OceanConfig): number {
    sampleOcean(this.position.x, this.position.z, time, ocean, this.waveSample);
    return Math.max(0, this.waveSample.height - this.position.y);
  }

  public step(
    dt: number,
    time: number,
    ocean: OceanConfig,
    input: SubmarineInput,
    sonarLevel: number,
    propellerLevel: number,
    subSkillLevel: number,
    sceneTargets: SonarSceneObject[],
    seabedFloorY = -42,
  ): { crushWarning: boolean } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    const massKg = 4400;
    this.sonarRangeM = 320 + (sonarLevel - 1) * 110 + (subSkillLevel - 1) * 18;
    const batteryDrainScale = Math.max(0.55, 1 - (subSkillLevel - 1) * 0.05);

    // Ballast & vertical thrust (Q = ascend / reduce ballast, E = descend / flood ballast)
    if (input.ascend) {
      this.ballastPct = Math.max(15, this.ballastPct - 42 * safeDt);
    } else if (input.descend) {
      this.ballastPct = Math.min(92, this.ballastPct + 42 * safeDt);
    } else {
      // Gently trim back toward neutral 50% when depth keys released
      this.ballastPct += (50 - this.ballastPct) * (1 - Math.exp(-1.8 * safeDt));
    }

    const canPower = this.batteryPct > 0.5;
    const thrustPower = canPower ? (4600 * (1 + (propellerLevel - 1) * 0.16)) : 0;

    // Heading yaw steering (A/D)
    const speedHoriz = Math.hypot(this.velocity.x, this.velocity.z);
    const turnAuth = 0.55 + Math.min(1, speedHoriz / 4.5) * 0.45;
    const yawRate = -input.steer * 0.85 * turnAuth;
    this.headingRad = (this.headingRad + yawRate * safeDt + Math.PI * 2) % (Math.PI * 2);

    const fwdX = -Math.sin(this.headingRad);
    const fwdZ = -Math.cos(this.headingRad);

    // Thruster force along forward axis
    const fx = fwdX * input.throttle * thrustPower;
    const fz = fwdZ * input.throttle * thrustPower;

    // Vertical buoyancy / ballast force (50% ballast = neutral buoyancy)
    const ballastForceY = (50 - this.ballastPct) * 85;
    const directDiveY = input.ascend ? 2100 : input.descend ? -2100 : 0;
    let fy = ballastForceY + directDiveY;

    // Ocean current drift
    const curRad = (ocean.currentDirDeg * Math.PI) / 180;
    const curVx = Math.sin(curRad) * ocean.currentSpeed * 0.65;
    const curVz = -Math.cos(curRad) * ocean.currentSpeed * 0.65;

    // Quadratic hydrodynamic drag relative to current
    const relVx = this.velocity.x - curVx;
    const relVz = this.velocity.z - curVz;
    const dragX = -relVx * Math.abs(relVx) * 260 - relVx * 720;
    const dragY = -this.velocity.y * Math.abs(this.velocity.y) * 520 - this.velocity.y * 1450;
    const dragZ = -relVz * Math.abs(relVz) * 260 - relVz * 720;

    // Surface hydrostatic cap so sub doesn't launch above waves
    sampleOcean(this.position.x, this.position.z, time, ocean, this.waveSample);
    const maxSubY = this.waveSample.height - 0.35;
    if (this.position.y > maxSubY) {
      fy -= (this.position.y - maxSubY) * 14000;
    }

    const ax = (fx + dragX) / massKg;
    const ay = (fy + dragY) / massKg;
    const az = (fz + dragZ) / massKg;

    this.velocity.x += ax * safeDt;
    this.velocity.y += ay * safeDt;
    this.velocity.z += az * safeDt;

    this.position.x += this.velocity.x * safeDt;
    this.position.y += this.velocity.y * safeDt;
    this.position.z += this.velocity.z * safeDt;

    if (this.position.y < seabedFloorY) {
      this.position.y = seabedFloorY;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    if (this.position.y > this.waveSample.height + 0.15) {
      this.position.y = this.waveSample.height + 0.15;
    }

    // Dynamic pitch & roll response
    const targetPitch = THREE.MathUtils.clamp(this.velocity.y * 0.095, -0.45, 0.45);
    const targetRoll = THREE.MathUtils.clamp(-input.steer * 0.14 * Math.min(1, speedHoriz / 4), -0.25, 0.25);
    this.pitchRad += (targetPitch - this.pitchRad) * (1 - Math.exp(-5 * safeDt));
    this.rollRad += (targetRoll - this.rollRad) * (1 - Math.exp(-6 * safeDt));

    // Battery consumption (recharge gently at surface)
    const depthM = Math.max(0, this.waveSample.height - this.position.y);
    const loadPct =
      (Math.abs(input.throttle) * 0.42 + (this.headlightsOn ? 0.08 : 0) + 0.04) * batteryDrainScale;
    if (depthM < 1.1 && Math.abs(input.throttle) < 0.1) {
      this.batteryPct = Math.min(100, this.batteryPct + safeDt * 1.4);
    } else {
      this.batteryPct = Math.max(0, this.batteryPct - loadPct * safeDt);
    }

    // Approximate hydrostatic pressure crush check beyond maxSafeDepthM
    let crushWarning = false;
    if (depthM > this.maxSafeDepthM) {
      crushWarning = true;
      const excess = (depthM - this.maxSafeDepthM) * 0.12;
      this.hullPct = Math.max(8, this.hullPct - excess * safeDt);
    }

    if (this.armTimer > 0) {
      this.armTimer = Math.max(0, this.armTimer - safeDt);
      this.armBusy = this.armTimer > 0;
    }

    // Active sonar sweep & real scene scan every ~0.25s
    this.sonarSweepDeg = (this.sonarSweepDeg + safeDt * 145) % 360;
    if (time - this.lastSonarScanTime >= 0.25) {
      this.lastSonarScanTime = time;
      this.updateSonarScan(sceneTargets);
    }

    return { crushWarning };
  }

  public updateSonarScan(sceneTargets: SonarSceneObject[]): void {
    const contacts: SonarContact[] = [];
    for (const t of sceneTargets) {
      const dx = t.x - this.position.x;
      const dy = t.y - this.position.y;
      const dz = t.z - this.position.z;
      const distM = Math.hypot(dx, dy, dz);
      if (distM > this.sonarRangeM) continue;

      const bearingRad = Math.atan2(dx, -dz);
      const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;
      const headingDeg = ((this.headingRad * 180) / Math.PI + 360) % 360;
      const relAngleDeg = ((bearingDeg - headingDeg + 540) % 360) - 180;

      contacts.push({
        id: t.id,
        label: t.label,
        kind: t.kind,
        x: t.x,
        y: t.y,
        z: t.z,
        distM: Math.round(distM),
        bearingDeg: Math.round(bearingDeg),
        relAngleDeg: Math.round(relAngleDeg),
      });
    }
    contacts.sort((a, b) => a.distM - b.distM);
    this.sonarContacts = contacts.slice(0, 14);
  }

  public getSnapshot(
    active: boolean,
    unlocked: boolean,
    time: number,
    ocean: OceanConfig,
  ): SubmarineTelemetrySnapshot {
    const depthM = this.getDepthM(time, ocean);
    const speedMs = Math.hypot(this.velocity.x, this.velocity.z);
    return {
      active,
      unlocked,
      modelName: this.modelName,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      headingDeg: Math.round((((this.headingRad * 180) / Math.PI) % 360 + 360) % 360),
      pitchDeg: Math.round((this.pitchRad * 180) / Math.PI),
      speedKnots: Math.round(speedMs * 1.94384 * 10) / 10,
      depthM: Math.round(depthM * 10) / 10,
      maxSafeDepthM: this.maxSafeDepthM,
      pressureAtm: Math.round((1 + depthM / 10) * 10) / 10,
      ballastPct: Math.round(this.ballastPct),
      batteryPct: Math.round(this.batteryPct),
      hullPct: Math.round(this.hullPct),
      headlightsOn: this.headlightsOn,
      sonarSweepDeg: Math.round(this.sonarSweepDeg),
      sonarRangeM: Math.round(this.sonarRangeM),
      sonarContacts: this.sonarContacts,
      armBusy: this.armBusy,
    };
  }
}
