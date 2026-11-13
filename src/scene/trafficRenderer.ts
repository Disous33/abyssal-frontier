import * as THREE from 'three';
import { createWaveSample, sampleOcean, WaveSample } from '../sim/oceanSolver';
import { DynamicOceanEvent, NpcVesselSnapshot, OceanConfig } from '../sim/types';

/**
 * Renders AI maritime traffic vessels with stepped hull superstructures, bridge glazing,
 * funnels, cargo stacks, speed-coupled Kelvin wake ribbons, night-boosted navigation lights,
 * the abandoned Barcaça Nereus-04 wreck, and active DynamicOceanEvent 3D props.
 */
export class TrafficRenderer {
  public readonly group = new THREE.Group();

  private readonly shipMeshes = new Map<string, { root: THREE.Group; wake: THREE.Mesh }>();
  private readonly nereusBargeGroup = new THREE.Group();
  private readonly eventGroup = new THREE.Group();
  private readonly eventRingMesh: THREE.Mesh;
  private readonly eventCoreGroup = new THREE.Group();

  private readonly portLightMat: THREE.MeshStandardMaterial;
  private readonly stbdLightMat: THREE.MeshStandardMaterial;
  private readonly mastLightMat: THREE.MeshStandardMaterial;

  private nereusPos = { x: 215, z: 610 };
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly waveSample: WaveSample = createWaveSample();

  constructor() {
    const hullNavyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.58, metalness: 0.28 });
    const hullRustMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.72, metalness: 0.22 });
    const hullWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.48, metalness: 0.16 });
    const hullNereusMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.45 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const bridgeGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x091620,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 0.9,
    });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 });
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.portLightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.7,
    });
    this.stbdLightMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.7,
    });
    this.mastLightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.85,
    });

    const eventMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      roughness: 0.35,
    });
    const dolphinMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.25, metalness: 0.2 });

    this.materials.push(
      hullNavyMat,
      hullRustMat,
      hullWhiteMat,
      hullNereusMat,
      cabinMat,
      bridgeGlassMat,
      orangeMat,
      wakeMat,
      this.portLightMat,
      this.stbdLightMat,
      this.mastLightMat,
      eventMat,
      dolphinMat,
    );

    const buildShip = (
      id: string,
      length: number,
      beam: number,
      hullMat: THREE.Material,
      accentMat: THREE.Material,
    ) => {
      const ship = new THREE.Group();
      const hullGeo = new THREE.BoxGeometry(beam, 1.55, length);
      const bulwarkGeo = new THREE.BoxGeometry(beam * 0.96, 0.42, length * 0.92);
      const bowGeo = new THREE.ConeGeometry(beam * 0.54, length * 0.28, 4);
      bowGeo.rotateY(Math.PI / 4);
      bowGeo.rotateX(-Math.PI / 2);
      const cabGeo = new THREE.BoxGeometry(beam * 0.72, 1.65, length * 0.34);
      const bridgeWinGeo = new THREE.BoxGeometry(beam * 0.74, 0.48, length * 0.26);
      const funnelGeo = new THREE.CylinderGeometry(beam * 0.1, beam * 0.13, 1.35, 8);
      const mastGeo = new THREE.CylinderGeometry(0.08, 0.11, 3.8, 6);
      const navLightGeo = new THREE.SphereGeometry(0.18, 6, 6);
      const wakeGeo = new THREE.ConeGeometry(beam * 1.45, length * 1.35, 3, 1, true);
      wakeGeo.rotateX(Math.PI / 2);
      this.geometries.push(hullGeo, bulwarkGeo, bowGeo, cabGeo, bridgeWinGeo, funnelGeo, mastGeo, navLightGeo, wakeGeo);

      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.42;
      hull.castShadow = true;

      const bulwark = new THREE.Mesh(bulwarkGeo, accentMat);
      bulwark.position.y = 1.25;

      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(0, 0.48, -length * 0.57);

      const cabin = new THREE.Mesh(cabGeo, accentMat);
      cabin.position.set(0, 2.0, length * 0.1);
      cabin.castShadow = true;

      const bridgeWin = new THREE.Mesh(bridgeWinGeo, bridgeGlassMat);
      bridgeWin.position.set(0, 2.38, length * 0.08);

      const funnel = new THREE.Mesh(funnelGeo, hullNereusMat);
      funnel.position.set(0, 2.8, length * 0.24);

      const mast = new THREE.Mesh(mastGeo, cabinMat);
      mast.position.set(0, 3.45, -length * 0.04);

      const portLight = new THREE.Mesh(navLightGeo, this.portLightMat);
      portLight.position.set(-beam * 0.52, 1.5, -length * 0.15);

      const stbdLight = new THREE.Mesh(navLightGeo, this.stbdLightMat);
      stbdLight.position.set(beam * 0.52, 1.5, -length * 0.15);

      const mastLight = new THREE.Mesh(navLightGeo, this.mastLightMat);
      mastLight.position.set(0, 5.28, -length * 0.04);

      const wake = new THREE.Mesh(wakeGeo, wakeMat);
      wake.position.set(0, 0.12, length * 0.92);
      wake.scale.set(1, 0.05, 1);

      ship.add(hull, bulwark, bow, cabin, bridgeWin, funnel, mast, portLight, stbdLight, mastLight, wake);
      this.group.add(ship);
      this.shipMeshes.set(id, { root: ship, wake });
    };

    buildShip('npc_balsa_guaruja', 18, 5.2, hullWhiteMat, orangeMat);
    buildShip('npc_rebocador_atlantico', 13, 3.8, hullRustMat, cabinMat);
    buildShip('npc_pesqueiro_caicara', 11, 3.1, hullNavyMat, cabinMat);
    buildShip('npc_patrulha_sp07', 14.5, 3.4, hullWhiteMat, hullNavyMat);
    buildShip('npc_carga_nereus', 19, 4.8, hullNereusMat, orangeMat);

    // Abandoned Barcaça Nereus-04 at (215, 0, 610)
    const bargeHullGeo = new THREE.BoxGeometry(5.4, 1.8, 16.5);
    const bargeCabGeo = new THREE.BoxGeometry(3.4, 2.0, 4.2);
    const bargeContGeo = new THREE.BoxGeometry(2.4, 2.2, 5.8);
    const beaconGeo = new THREE.SphereGeometry(0.45, 10, 10);
    this.geometries.push(bargeHullGeo, bargeCabGeo, bargeContGeo, beaconGeo);

    const bHull = new THREE.Mesh(bargeHullGeo, hullNereusMat);
    bHull.position.y = 0.4;
    const bCab = new THREE.Mesh(bargeCabGeo, hullRustMat);
    bCab.position.set(0, 2.1, 4.8);
    const bCont = new THREE.Mesh(bargeContGeo, orangeMat);
    bCont.position.set(-0.6, 2.2, -2.4);
    bCont.rotation.y = 0.22;
    const bBeacon = new THREE.Mesh(beaconGeo, eventMat);
    bBeacon.position.set(0, 3.6, 4.8);
    this.nereusBargeGroup.add(bHull, bCab, bCont, bBeacon);
    this.nereusBargeGroup.position.set(this.nereusPos.x, 0, this.nereusPos.z);
    this.nereusBargeGroup.rotation.set(0.05, 0.72, 0.12);
    this.group.add(this.nereusBargeGroup);

    // Dynamic Ocean Event 3D Indicator
    const ringGeo = new THREE.TorusGeometry(6.2, 0.28, 10, 32);
    ringGeo.rotateX(Math.PI / 2);
    const crateGeo = new THREE.BoxGeometry(2.2, 1.8, 2.2);
    const dolphinGeo = new THREE.CapsuleGeometry(0.28, 1.2, 6, 8);
    dolphinGeo.rotateX(Math.PI / 2);
    this.geometries.push(ringGeo, crateGeo, dolphinGeo);

    this.eventRingMesh = new THREE.Mesh(ringGeo, eventMat);
    this.eventRingMesh.position.y = 0.45;
    const crateMesh = new THREE.Mesh(crateGeo, orangeMat);
    crateMesh.position.y = 0.8;
    const d1 = new THREE.Mesh(dolphinGeo, dolphinMat);
    d1.position.set(-2.5, 0.6, 0);
    const d2 = new THREE.Mesh(dolphinGeo, dolphinMat);
    d2.position.set(2.5, 0.8, 1.5);
    this.eventCoreGroup.add(crateMesh, d1, d2);
    this.eventGroup.add(this.eventRingMesh, this.eventCoreGroup);
    this.eventGroup.visible = false;
    this.group.add(this.eventGroup);
  }

  public shiftOrigin(dx: number, dz: number): void {
    this.nereusPos.x -= dx;
    this.nereusPos.z -= dz;
    this.nereusBargeGroup.position.x = this.nereusPos.x;
    this.nereusBargeGroup.position.z = this.nereusPos.z;
  }

  public update(
    time: number,
    ocean: OceanConfig,
    snapshots: NpcVesselSnapshot[],
    activeEvent: DynamicOceanEvent | null,
    nightFactor = 0,
  ): void {
    const navGlow = 0.65 + nightFactor * 2.6;
    this.portLightMat.emissiveIntensity = navGlow;
    this.stbdLightMat.emissiveIntensity = navGlow;
    this.mastLightMat.emissiveIntensity = navGlow * 1.15;

    for (const s of snapshots) {
      const entry = this.shipMeshes.get(s.id);
      if (!entry) continue;
      sampleOcean(s.x, s.z, time, ocean, this.waveSample);
      entry.root.position.set(s.x, this.waveSample.height + 0.05, s.z);
      entry.root.rotation.y = (-s.headingDeg * Math.PI) / 180;
      entry.root.rotation.z = this.waveSample.normalX * 0.25;
      entry.root.rotation.x = -this.waveSample.normalZ * 0.25;

      const wakeScale = THREE.MathUtils.clamp(s.speedKnots / 6.0, 0.0, 1.4);
      entry.wake.visible = wakeScale > 0.08;
      entry.wake.scale.set(0.75 + wakeScale * 0.35, 0.05, Math.max(0.15, wakeScale));
    }

    sampleOcean(this.nereusPos.x, this.nereusPos.z, time, ocean, this.waveSample);
    this.nereusBargeGroup.position.y = this.waveSample.height - 0.1;

    if (activeEvent && activeEvent.active) {
      this.eventGroup.visible = true;
      sampleOcean(activeEvent.x, activeEvent.z, time, ocean, this.waveSample);
      this.eventGroup.position.set(activeEvent.x, this.waveSample.height + 0.1, activeEvent.z);
      this.eventRingMesh.rotation.z = time * 0.9;
      if (activeEvent.type === 'marine_wildlife') {
        this.eventCoreGroup.children[0].visible = false;
        this.eventCoreGroup.children[1].visible = true;
        this.eventCoreGroup.children[2].visible = true;
        this.eventCoreGroup.children[1].position.y = Math.max(-0.4, Math.sin(time * 3.1) * 1.6);
        this.eventCoreGroup.children[2].position.y = Math.max(-0.4, Math.sin(time * 3.1 + 1.4) * 1.6);
      } else {
        this.eventCoreGroup.children[0].visible = true;
        this.eventCoreGroup.children[1].visible = false;
        this.eventCoreGroup.children[2].visible = false;
        this.eventCoreGroup.children[0].rotation.y = time * 0.5;
      }
    } else {
      this.eventGroup.visible = false;
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
