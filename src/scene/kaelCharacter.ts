import * as THREE from 'three';
import { CharacterAnimState } from '../sim/types';

export interface HumanoidAppearance {
  jacketHex: number;
  accentHex: number;
  pantsHex: number;
  skinHex: number;
  hairHex: number;
}

export const KAEL_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0x0f3b4f, // Deep petrol maritime jacket
  accentHex: 0xd99b26, // Amber safety trim
  pantsHex: 0x1e293b,
  skinHex: 0xd8a37e,
  hairHex: 0x1b1714,
};

export const HELENA_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0xf1f5f9, // Harbor commander white/navy uniform
  accentHex: 0xb45309,
  pantsHex: 0x0f172a,
  skinHex: 0xc98f6d,
  hairHex: 0x3b261d,
};

export const TOMAS_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0x9a3412, // Dockyard engineer rust coverall
  accentHex: 0xfbbf24,
  pantsHex: 0x334155,
  skinHex: 0xb57c58,
  hairHex: 0x1f2937,
};

export const CLARA_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0x0e7490, // Gear merchant teal windbreaker
  accentHex: 0x38bdf8,
  pantsHex: 0x1e293b,
  skinHex: 0xd9a07b,
  hairHex: 0x451a03,
};

export const BENTO_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0x3f6212, // Port market olive vest
  accentHex: 0xeab308,
  pantsHex: 0x292524,
  skinHex: 0x8d583b,
  hairHex: 0x0f172a,
};

export const DOCKWORKER_APPEARANCE: HumanoidAppearance = {
  jacketHex: 0xca8a04, // High-vis dockworker vest
  accentHex: 0xfef08a,
  pantsHex: 0x1e293b,
  skinHex: 0xb9825e,
  hairHex: 0x1c1917,
};

/**
 * Articulated hierarchical 3D skeletal human character (Kael Rivera & Port NPCs).
 * Features sculpted facial features, maritime harness/belt/VHF pouch, joint spheres,
 * scuba equipment toggles, and velocity-matched procedural animation blending.
 */
export class ArticulatedCharacterRig {
  public readonly root = new THREE.Group();

  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly forearmL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly forearmR = new THREE.Group();
  private readonly thighL = new THREE.Group();
  private readonly shinL = new THREE.Group();
  private readonly thighR = new THREE.Group();
  private readonly shinR = new THREE.Group();

  private readonly scubaTankMesh: THREE.Mesh;
  private readonly diveMaskMesh: THREE.Mesh;

  private animPhase = 0;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(appearance: HumanoidAppearance = KAEL_APPEARANCE) {
    const jacketMat = new THREE.MeshStandardMaterial({
      color: appearance.jacketHex,
      roughness: 0.58,
      metalness: 0.08,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: appearance.accentHex,
      roughness: 0.38,
      metalness: 0.32,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: appearance.pantsHex,
      roughness: 0.78,
      metalness: 0.04,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: appearance.skinHex,
      roughness: 0.62,
      metalness: 0.02,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: appearance.hairHex,
      roughness: 0.86,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.48,
      metalness: 0.16,
    });
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.3,
      metalness: 0.72,
    });
    const maskMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.35,
      clearcoat: 0.9,
    });

    this.materials.push(jacketMat, accentMat, pantsMat, skinMat, hairMat, bootMat, tankMat, maskMat);

    // Hips at ~0.92m above feet
    this.hips.position.set(0, 0.92, 0);
    this.root.add(this.hips);

    const pelvisGeo = new THREE.CylinderGeometry(0.15, 0.14, 0.18, 12);
    const beltGeo = new THREE.CylinderGeometry(0.158, 0.155, 0.055, 12);
    const buckleGeo = new THREE.BoxGeometry(0.065, 0.048, 0.03);
    const pouchGeo = new THREE.BoxGeometry(0.06, 0.11, 0.05);
    this.geometries.push(pelvisGeo, beltGeo, buckleGeo, pouchGeo);

    const pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvisMesh.castShadow = true;
    const beltMesh = new THREE.Mesh(beltGeo, bootMat);
    beltMesh.position.y = 0.06;
    const buckleMesh = new THREE.Mesh(buckleGeo, accentMat);
    buckleMesh.position.set(0, 0.06, 0.148);
    const pouchMesh = new THREE.Mesh(pouchGeo, bootMat);
    pouchMesh.position.set(0.155, 0.05, 0.02);
    this.hips.add(pelvisMesh, beltMesh, buckleMesh, pouchMesh);

    // Torso / Jacket + Maritime Harness
    this.torso.position.set(0, 0.08, 0);
    this.hips.add(this.torso);

    const chestGeo = new THREE.CylinderGeometry(0.19, 0.145, 0.44, 14);
    chestGeo.scale(1.18, 1, 0.72);
    chestGeo.translate(0, 0.22, 0);
    const placketGeo = new THREE.BoxGeometry(0.032, 0.41, 0.02);
    const strapGeo = new THREE.BoxGeometry(0.045, 0.42, 0.24);
    this.geometries.push(chestGeo, placketGeo, strapGeo);

    const chestMesh = new THREE.Mesh(chestGeo, jacketMat);
    chestMesh.castShadow = true;
    const placketMesh = new THREE.Mesh(placketGeo, accentMat);
    placketMesh.position.set(0, 0.22, 0.13);
    this.torso.add(chestMesh, placketMesh);

    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(strapGeo, accentMat);
      strap.position.set(side * 0.095, 0.23, 0);
      this.torso.add(strap);
    }

    // Optional Scuba Tank on back (-Z)
    const tankGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.44, 12);
    this.geometries.push(tankGeo);
    this.scubaTankMesh = new THREE.Mesh(tankGeo, tankMat);
    this.scubaTankMesh.position.set(0, 0.24, -0.175);
    this.scubaTankMesh.visible = false;
    this.torso.add(this.scubaTankMesh);

    // Collar trim
    const trimGeo = new THREE.TorusGeometry(0.145, 0.028, 8, 16);
    trimGeo.rotateX(Math.PI / 2);
    this.geometries.push(trimGeo);
    const collarTrim = new THREE.Mesh(trimGeo, jacketMat);
    collarTrim.position.set(0, 0.435, 0);
    this.torso.add(collarTrim);

    // Neck & Sculpted Head (nose bridge, brow, ears, hair cap)
    this.headGroup.position.set(0, 0.48, 0);
    this.torso.add(this.headGroup);

    const neckGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.10, 10);
    neckGeo.translate(0, 0.04, 0);
    const headGeo = new THREE.SphereGeometry(0.12, 16, 14);
    headGeo.scale(0.88, 1.07, 0.95);
    headGeo.translate(0, 0.17, 0);
    const noseGeo = new THREE.BoxGeometry(0.024, 0.036, 0.03);
    noseGeo.translate(0, 0.165, 0.114);
    const hairGeo = new THREE.SphereGeometry(0.126, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    hairGeo.translate(0, 0.186, -0.012);
    const visorGeo = new THREE.BoxGeometry(0.136, 0.03, 0.035);
    visorGeo.translate(0, 0.188, 0.105);
    const maskGeo = new THREE.BoxGeometry(0.16, 0.065, 0.05);
    maskGeo.translate(0, 0.185, 0.112);
    this.geometries.push(neckGeo, headGeo, noseGeo, hairGeo, visorGeo, maskGeo);

    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    const visorMesh = new THREE.Mesh(visorGeo, bootMat);
    this.diveMaskMesh = new THREE.Mesh(maskGeo, maskMat);
    this.diveMaskMesh.visible = false;
    this.headGroup.add(neckMesh, headMesh, noseMesh, hairMesh, visorMesh, this.diveMaskMesh);

    // Arms with Shoulder & Elbow Joint Spheres
    const shoulderGeo = new THREE.SphereGeometry(0.055, 10, 8);
    const upperArmGeo = new THREE.CylinderGeometry(0.052, 0.044, 0.27, 10);
    upperArmGeo.translate(0, -0.135, 0);
    const elbowGeo = new THREE.SphereGeometry(0.043, 8, 8);
    const forearmGeo = new THREE.CylinderGeometry(0.042, 0.034, 0.25, 10);
    forearmGeo.translate(0, -0.125, 0);
    const handGeo = new THREE.SphereGeometry(0.038, 8, 8);
    handGeo.translate(0, -0.26, 0);
    this.geometries.push(shoulderGeo, upperArmGeo, elbowGeo, forearmGeo, handGeo);

    const buildArm = (side: number, armPivot: THREE.Group, forearmPivot: THREE.Group) => {
      armPivot.position.set(side * 0.24, 0.40, 0);
      const shoulder = new THREE.Mesh(shoulderGeo, jacketMat);
      const upper = new THREE.Mesh(upperArmGeo, jacketMat);
      upper.castShadow = true;
      armPivot.add(shoulder, upper);

      forearmPivot.position.set(0, -0.27, 0);
      const elbow = new THREE.Mesh(elbowGeo, jacketMat);
      const fore = new THREE.Mesh(forearmGeo, jacketMat);
      fore.castShadow = true;
      const hand = new THREE.Mesh(handGeo, skinMat);
      forearmPivot.add(elbow, fore, hand);
      armPivot.add(forearmPivot);
      this.torso.add(armPivot);
    };

    buildArm(-1, this.armL, this.forearmL);
    buildArm(1, this.armR, this.forearmR);

    // Legs with Knee Spheres & Maritime Boots — +Z is character forward
    const thighGeo = new THREE.CylinderGeometry(0.078, 0.062, 0.42, 10);
    thighGeo.translate(0, -0.21, 0);
    const kneeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const shinGeo = new THREE.CylinderGeometry(0.058, 0.046, 0.40, 10);
    shinGeo.translate(0, -0.20, 0);
    const bootGeo = new THREE.BoxGeometry(0.105, 0.092, 0.22);
    bootGeo.translate(0, -0.43, 0.038);
    this.geometries.push(thighGeo, kneeGeo, shinGeo, bootGeo);

    const buildLeg = (side: number, thighPivot: THREE.Group, shinPivot: THREE.Group) => {
      thighPivot.position.set(side * 0.105, -0.05, 0);
      const thigh = new THREE.Mesh(thighGeo, pantsMat);
      thigh.castShadow = true;
      thighPivot.add(thigh);

      shinPivot.position.set(0, -0.42, 0);
      const knee = new THREE.Mesh(kneeGeo, pantsMat);
      const shin = new THREE.Mesh(shinGeo, pantsMat);
      shin.castShadow = true;
      const boot = new THREE.Mesh(bootGeo, bootMat);
      boot.castShadow = true;
      shinPivot.add(knee, shin, boot);
      thighPivot.add(shinPivot);
      this.hips.add(thighPivot);
    };

    buildLeg(-1, this.thighL, this.shinL);
    buildLeg(1, this.thighR, this.shinR);
  }

  public setDivingGearEquipped(hasMask: boolean, hasTank: boolean): void {
    this.diveMaskMesh.visible = hasMask;
    this.scubaTankMesh.visible = hasTank;
  }

  public updateAnimation(
    dt: number,
    time: number,
    animState: CharacterAnimState,
    horizontalSpeed: number,
    steerWheelRad = 0,
  ): void {
    // Velocity-matched gait cadence prevents foot sliding across wooden planks and quay stone
    const rate =
      animState === 'run'
        ? Math.max(7.5, horizontalSpeed * 1.75)
        : animState === 'walk'
          ? Math.max(4.5, horizontalSpeed * 2.0)
          : animState === 'swim' || animState === 'dive'
            ? 5.4
            : 2.0;
    this.animPhase += dt * rate;
    const damp = 1 - Math.exp(-13 * dt);

    let targetHipsY = 0.92;
    let targetHipsRotX = 0;
    let targetTorsoX = 0;
    let targetTorsoY = 0;
    let targetHeadY = 0;
    let targetArmLX = 0;
    let targetArmRX = 0;
    let targetArmLZ = 0.10;
    let targetArmRZ = -0.10;
    let targetForeLX = -0.22;
    let targetForeRX = -0.22;
    let targetThighLX = 0;
    let targetThighRX = 0;
    let targetShinLX = 0;
    let targetShinRX = 0;

    if (animState === 'idle') {
      const breath = Math.sin(time * 2.1);
      targetHipsY = 0.92 + breath * 0.012;
      targetTorsoY = Math.sin(time * 0.65) * 0.045;
      targetHeadY = Math.sin(time * 0.45) * 0.08;
      targetArmLX = Math.sin(time * 1.4) * 0.03;
      targetArmRX = -Math.sin(time * 1.4) * 0.03;
      targetForeLX = -0.26;
      targetForeRX = -0.26;
    } else if (animState === 'turn') {
      const s = Math.sin(this.animPhase * 2.2);
      targetHipsY = 0.91;
      targetTorsoY = s * 0.18;
      targetThighLX = s * 0.16;
      targetThighRX = -s * 0.16;
      targetShinLX = 0.14;
      targetShinRX = 0.14;
      targetArmLZ = 0.16;
      targetArmRZ = -0.16;
    } else if (animState === 'interact') {
      targetHipsY = 0.91;
      targetTorsoX = 0.14;
      targetArmRX = -0.78 + Math.sin(time * 5.0) * 0.08;
      targetForeRX = -0.45;
      targetArmLX = -0.18;
      targetForeLX = -0.35;
    } else if (animState === 'walk' || animState === 'run') {
      const amp = animState === 'run' ? 0.78 : Math.min(0.56, 0.22 + horizontalSpeed * 0.1);
      const s = Math.sin(this.animPhase);
      const c = Math.cos(this.animPhase);
      targetHipsY = 0.92 + Math.abs(c) * (animState === 'run' ? 0.068 : 0.032);
      targetTorsoX = animState === 'run' ? 0.16 : 0.055;
      targetTorsoY = s * 0.1;

      targetThighLX = s * amp;
      targetThighRX = -s * amp;
      targetShinLX = Math.max(0, -c * amp * 1.15) + 0.08;
      targetShinRX = Math.max(0, c * amp * 1.15) + 0.08;

      targetArmLX = -s * amp * 0.85;
      targetArmRX = s * amp * 0.85;
      targetForeLX = animState === 'run' ? -0.88 : -0.46;
      targetForeRX = animState === 'run' ? -0.88 : -0.46;
    } else if (animState === 'jump') {
      targetHipsY = 0.98;
      targetTorsoX = 0.12;
      targetThighLX = 0.45;
      targetThighRX = -0.25;
      targetShinLX = 0.65;
      targetShinRX = 0.45;
      targetArmLX = 0.55;
      targetArmRX = 0.55;
      targetArmLZ = 0.45;
      targetArmRZ = -0.45;
    } else if (animState === 'board') {
      targetHipsY = 1.02;
      targetTorsoX = 0.18;
      targetThighLX = 0.55;
      targetShinLX = 0.7;
      targetArmLX = -0.6;
      targetArmRX = -0.4;
    } else if (animState === 'steer') {
      targetHipsY = 0.90;
      targetTorsoX = 0.08;
      targetArmLX = -0.85 - steerWheelRad * 0.25;
      targetArmRX = -0.85 + steerWheelRad * 0.25;
      targetArmLZ = -0.12;
      targetArmRZ = 0.12;
      targetForeLX = -0.55;
      targetForeRX = -0.55;
      targetThighLX = 0.08;
      targetThighRX = -0.08;
    } else if (animState === 'swim' || animState === 'dive') {
      const s = Math.sin(this.animPhase);
      const c = Math.cos(this.animPhase);
      const moving = horizontalSpeed > 0.35;
      targetHipsY = 0.42;
      targetHipsRotX = animState === 'dive' ? 1.25 : 1.05;
      targetTorsoX = -0.22;
      targetArmLX = moving ? -1.4 + s * 0.75 : -0.65 + Math.sin(time * 2.5) * 0.15;
      targetArmRX = moving ? -1.4 - s * 0.75 : -0.65 - Math.sin(time * 2.5) * 0.15;
      targetArmLZ = 0.35 + c * 0.2;
      targetArmRZ = -0.35 - c * 0.2;
      targetForeLX = -0.35;
      targetForeRX = -0.35;
      targetThighLX = moving ? s * 0.45 : Math.sin(time * 3.2) * 0.18;
      targetThighRX = moving ? -s * 0.45 : -Math.sin(time * 3.2) * 0.18;
      targetShinLX = 0.25;
      targetShinRX = 0.25;
    }

    this.hips.position.y += (targetHipsY - this.hips.position.y) * damp;
    this.hips.rotation.x += (targetHipsRotX - this.hips.rotation.x) * damp;
    this.torso.rotation.x += (targetTorsoX - this.torso.rotation.x) * damp;
    this.torso.rotation.y += (targetTorsoY - this.torso.rotation.y) * damp;
    this.headGroup.rotation.y += (targetHeadY - this.headGroup.rotation.y) * damp;

    this.armL.rotation.x += (targetArmLX - this.armL.rotation.x) * damp;
    this.armR.rotation.x += (targetArmRX - this.armR.rotation.x) * damp;
    this.armL.rotation.z += (targetArmLZ - this.armL.rotation.z) * damp;
    this.armR.rotation.z += (targetArmRZ - this.armR.rotation.z) * damp;
    this.forearmL.rotation.x += (targetForeLX - this.forearmL.rotation.x) * damp;
    this.forearmR.rotation.x += (targetForeRX - this.forearmR.rotation.x) * damp;

    this.thighL.rotation.x += (targetThighLX - this.thighL.rotation.x) * damp;
    this.thighR.rotation.x += (targetThighRX - this.thighR.rotation.x) * damp;
    this.shinL.rotation.x += (targetShinLX - this.shinL.rotation.x) * damp;
    this.shinR.rotation.x += (targetShinRX - this.shinR.rotation.x) * damp;
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
