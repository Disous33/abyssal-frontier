import * as THREE from 'three';

/**
 * Procedural NEREID S-1 research submarine mesh with panoramic acrylic nose dome,
 * conning sail, shrouded twin thrusters, rear hydroplanes, robotic manipulator arm,
 * and dual LED headlights.
 */
export class SubmarineMesh {
  public readonly root = new THREE.Group();
  private readonly armPivot = new THREE.Group();
  private readonly propLeft = new THREE.Group();
  private readonly propRight = new THREE.Group();
  private readonly headlightMat: THREE.MeshStandardMaterial;
  private readonly spotLight: THREE.SpotLight | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(
    hullColorHex = 0xeab308,
    trimColorHex = 0x1e293b,
    isSoftwareGl = false,
  ) {
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: hullColorHex,
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 0.72,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: trimColorHex,
      roughness: 0.42,
      metalness: 0.65,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.85,
    });
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1.0,
    });
    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0xbae6fd,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.materials.push(hullMat, trimMat, steelMat, domeMat, this.headlightMat);

    // 1. Main Cylindrical Pressure Hull + Tapered Tail Cone
    const hullGeo = new THREE.CylinderGeometry(0.92, 0.92, 3.2, 18);
    hullGeo.rotateX(Math.PI / 2);
    const tailGeo = new THREE.ConeGeometry(0.92, 1.9, 18);
    tailGeo.rotateX(Math.PI / 2);
    const domeGeo = new THREE.SphereGeometry(0.88, 18, 14);
    const frameRingGeo = new THREE.TorusGeometry(0.93, 0.06, 8, 22);
    this.geometries.push(hullGeo, tailGeo, domeGeo, frameRingGeo);

    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    const tail = new THREE.Mesh(tailGeo, hullMat);
    tail.position.z = 2.55;
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.z = -1.6;
    const ringF = new THREE.Mesh(frameRingGeo, trimMat);
    ringF.position.z = -1.55;
    const ringA = new THREE.Mesh(frameRingGeo, trimMat);
    ringA.position.z = 1.55;
    this.root.add(hull, tail, dome, ringF, ringA);

    // 2. Upper Conning Sail & Hatch + Beacon Mast
    const sailGeo = new THREE.BoxGeometry(0.75, 0.68, 1.35);
    const hatchGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.14, 12);
    const mastGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.75, 6);
    this.geometries.push(sailGeo, hatchGeo, mastGeo);

    const sail = new THREE.Mesh(sailGeo, trimMat);
    sail.position.set(0, 1.12, -0.15);
    const hatch = new THREE.Mesh(hatchGeo, steelMat);
    hatch.position.set(0, 1.48, -0.15);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(0, 1.82, 0.25);
    this.root.add(sail, hatch, mast);

    // 3. Lower Skids / Landing Runners
    const skidGeo = new THREE.BoxGeometry(0.12, 0.14, 3.1);
    const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6);
    this.geometries.push(skidGeo, strutGeo);
    for (const sx of [-0.68, 0.68]) {
      const skid = new THREE.Mesh(skidGeo, trimMat);
      skid.position.set(sx, -1.16, 0);
      this.root.add(skid);
      for (const sz of [-0.95, 0.95]) {
        const strut = new THREE.Mesh(strutGeo, steelMat);
        strut.position.set(sx, -0.94, sz);
        this.root.add(strut);
      }
    }

    // 4. Aft Cruciform Stabilizer Fins
    const finHGeo = new THREE.BoxGeometry(2.1, 0.08, 0.65);
    const finVGeo = new THREE.BoxGeometry(0.08, 1.6, 0.65);
    this.geometries.push(finHGeo, finVGeo);
    const finH = new THREE.Mesh(finHGeo, trimMat);
    finH.position.set(0, 0, 2.75);
    const finV = new THREE.Mesh(finVGeo, trimMat);
    finV.position.set(0, 0, 2.75);
    this.root.add(finH, finV);

    // 5. Shrouded Side Thrusters + Spinning Propellers
    const shroudGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.62, 12, 1, true);
    shroudGeo.rotateX(Math.PI / 2);
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.38, 0.02);
    this.geometries.push(shroudGeo, bladeGeo);

    const buildThruster = (sideX: number, propTarget: THREE.Group) => {
      const shroud = new THREE.Mesh(shroudGeo, trimMat);
      shroud.position.set(sideX, 0.08, 0.75);
      this.root.add(shroud);
      propTarget.position.set(sideX, 0.08, 0.75);
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, steelMat);
        blade.rotation.z = (b * Math.PI * 2) / 3;
        propTarget.add(blade);
      }
      this.root.add(propTarget);
    };
    buildThruster(-1.18, this.propLeft);
    buildThruster(1.18, this.propRight);

    // 6. Front Articulated Robotic Manipulator Arm
    this.armPivot.position.set(0.42, -0.58, -1.35);
    const armSegGeo = new THREE.BoxGeometry(0.11, 0.11, 0.95);
    armSegGeo.translate(0, 0, -0.45);
    const clawGeo = new THREE.BoxGeometry(0.22, 0.08, 0.24);
    this.geometries.push(armSegGeo, clawGeo);
    const armSeg = new THREE.Mesh(armSegGeo, steelMat);
    const claw = new THREE.Mesh(clawGeo, hullMat);
    claw.position.set(0, 0, -0.95);
    this.armPivot.add(armSeg, claw);
    this.root.add(this.armPivot);

    // 7. Twin LED Headlights + Real SpotLight underwater
    const lampGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10);
    lampGeo.rotateX(Math.PI / 2);
    this.geometries.push(lampGeo);
    for (const lx of [-0.48, 0.48]) {
      const lamp = new THREE.Mesh(lampGeo, this.headlightMat);
      lamp.position.set(lx, 0.35, -1.65);
      this.root.add(lamp);
    }

    if (!isSoftwareGl) {
      this.spotLight = new THREE.SpotLight(0xcffafe, 8.5, 65, Math.PI * 0.24, 0.45, 1.2);
      this.spotLight.position.set(0, 0.35, -1.75);
      this.spotLight.target.position.set(0, -1.2, -16);
      this.root.add(this.spotLight, this.spotLight.target);
    }
  }

  public update(
    dt: number,
    time: number,
    x: number,
    y: number,
    z: number,
    headingRad: number,
    pitchRad: number,
    rollRad: number,
    speedKnots: number,
    headlightsOn: boolean,
    armBusy: boolean,
  ): void {
    this.root.position.set(x, y, z);
    this.root.rotation.set(pitchRad, headingRad, rollRad, 'YXZ');

    const spinRate = (1.5 + Math.abs(speedKnots) * 2.8) * dt;
    this.propLeft.rotation.z += spinRate;
    this.propRight.rotation.z -= spinRate;

    this.headlightMat.emissiveIntensity = headlightsOn ? 2.4 : 0.15;
    if (this.spotLight) {
      this.spotLight.intensity = headlightsOn ? 12.0 : 0.0;
    }

    if (armBusy) {
      this.armPivot.rotation.x = -0.15 + Math.sin(time * 9) * 0.22;
      this.armPivot.rotation.y = Math.cos(time * 7) * 0.25;
    } else {
      this.armPivot.rotation.x = 0.28;
      this.armPivot.rotation.y = 0;
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
