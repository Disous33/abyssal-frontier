import * as THREE from 'three';
import { createWaveSample, sampleOcean, WaveSample } from '../sim/oceanSolver';
import { SonarSceneObject } from '../sim/submarineController';
import { OceanConfig, UnderwaterNodeSnapshot } from '../sim/types';

interface InternalDiveNode extends UnderwaterNodeSnapshot {
  baseX: number;
  baseZ: number;
  beaconMesh: THREE.Mesh;
}

/**
 * Renders functional underwater diving & submarine exploration zones in Santos Bay:
 * 1) Recife do Píer (45, -6.5, 55): shallow training reef (-9 m seabed)
 * 2) Caverna Submarina Ponta Grossa (-145, -12.0, 290): rock cave arch + compass relic
 * 3) Destroços da Laje Norte (-210, -7.8, 520): shallow wreck + protected reef
 * 4) Fossa Submarina Nereus (120, -18.5, 720): deep trench (-24 m seabed) for NEREID S-1
 * 5) Naufrágio Profundo Nereus-Alpha (-280, -23.5, 880): deep ocean wreck (-26 m seabed)
 */
export class UnderwaterAreaScene {
  public readonly group = new THREE.Group();

  private readonly nodes: InternalDiveNode[] = [];
  private readonly surfaceBuoys: Array<{ mesh: THREE.Group; baseX: number; baseZ: number }> = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly waveSample: WaveSample = createWaveSample();

  constructor() {
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0x163842,
      roughness: 0.96,
      metalness: 0.02,
    });
    const deepSandMat = new THREE.MeshStandardMaterial({
      color: 0x0b2129,
      roughness: 0.98,
      metalness: 0.02,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x26444c,
      roughness: 0.9,
      metalness: 0.06,
    });
    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x1e6b52,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });
    const wreckSteelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.72,
      metalness: 0.55,
    });
    const buoyMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.35,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.85,
    });
    const capsuleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.65,
    });

    this.materials.push(
      sandMat,
      deepSandMat,
      rockMat,
      kelpMat,
      wreckSteelMat,
      buoyMat,
      brassMat,
      capsuleMat,
    );

    // 1. Stepped Seabed Shelves (Coastal shelf Y=-9.2m near shore/bay, Outer deep shelf Y=-28m)
    const shelfGeo = new THREE.PlaneGeometry(1400, 760);
    shelfGeo.rotateX(-Math.PI / 2);
    const deepGeo = new THREE.PlaneGeometry(2400, 1800);
    deepGeo.rotateX(-Math.PI / 2);
    this.geometries.push(shelfGeo, deepGeo);

    const coastalSeabed = new THREE.Mesh(shelfGeo, sandMat);
    coastalSeabed.position.set(0, -9.2, 220);
    coastalSeabed.receiveShadow = true;
    this.group.add(coastalSeabed);

    const deepSeabed = new THREE.Mesh(deepGeo, deepSandMat);
    deepSeabed.position.set(0, -28.0, 960);
    deepSeabed.receiveShadow = true;
    this.group.add(deepSeabed);

    // 2. Instanced Reef Rocks & Kelp across Coastal Shelf, Cave & Trench
    const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
    const kelpGeo = new THREE.BoxGeometry(0.28, 3.2, 0.06);
    this.geometries.push(rockGeo, kelpGeo);

    const rockCoords: Array<[number, number, number]> = [
      // Pier Reef training site
      [42, -8.3, 52], [48, -8.1, 58], [39, -8.4, 59], [50, -8.5, 49], [45, -8.6, 62],
      // Caverna Ponta Grossa (-145, 290)
      [-151, -8.8, 285], [-139, -8.6, 294], [-148, -9.2, 298], [-142, -9.0, 282],
      // Laje Norte wreck reef
      [-216, -8.2, 515], [-203, -8.0, 526], [-219, -8.3, 528], [-200, -8.4, 512],
      [-208, -8.5, 535], [-222, -8.2, 518],
      // Fossa Submarina Nereus (120, 720)
      [112, -25.5, 715], [128, -25.2, 726], [116, -26.0, 730], [125, -26.2, 710],
      // Naufrágio Profundo (-280, 880)
      [-288, -26.4, 875], [-272, -26.1, 886], [-278, -26.5, 892],
    ];
    const rocksInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCoords.length);
    const dummy = new THREE.Object3D();
    rockCoords.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(i * 0.4, i * 1.1, 0);
      dummy.scale.set(1 + (i % 3) * 0.4, 0.7 + (i % 2) * 0.4, 1 + (i % 2) * 0.5);
      dummy.updateMatrix();
      rocksInst.setMatrixAt(i, dummy.matrix);
    });
    rocksInst.computeBoundingSphere();
    this.group.add(rocksInst);

    const kelpCoords: Array<[number, number, number]> = [
      [41, -7.4, 54], [43, -7.4, 58], [47, -7.4, 52], [49, -7.4, 57], [44, -7.4, 60],
      [-149, -7.5, 288], [-141, -7.5, 292], [-146, -7.5, 296],
      [-214, -7.4, 517], [-205, -7.4, 523], [-212, -7.4, 528], [-207, -7.4, 514], [-218, -7.4, 522], [-202, -7.4, 519],
    ];
    const kelpInst = new THREE.InstancedMesh(kelpGeo, kelpMat, kelpCoords.length);
    kelpCoords.forEach(([kx, ky, kz], i) => {
      dummy.position.set(kx, ky, kz);
      dummy.rotation.set(0.08 * Math.sin(i), i * 0.7, 0.1 * Math.cos(i));
      dummy.scale.set(1, 0.8 + (i % 3) * 0.25, 1);
      dummy.updateMatrix();
      kelpInst.setMatrixAt(i, dummy.matrix);
    });
    kelpInst.computeBoundingSphere();
    this.group.add(kelpInst);

    // 3. Caverna Submarina Ponta Grossa (-145, -10.5, 290)
    const archPillarGeo = new THREE.BoxGeometry(3.8, 7.5, 9.5);
    const archRoofGeo = new THREE.BoxGeometry(11.5, 2.8, 10.0);
    this.geometries.push(archPillarGeo, archRoofGeo);
    const caveGroup = new THREE.Group();
    caveGroup.position.set(-145, -11.5, 290);
    const leftWall = new THREE.Mesh(archPillarGeo, rockMat);
    leftWall.position.set(-4.2, 2.2, 0);
    const rightWall = new THREE.Mesh(archPillarGeo, rockMat);
    rightWall.position.set(4.2, 2.2, 0);
    const caveRoof = new THREE.Mesh(archRoofGeo, rockMat);
    caveRoof.position.set(0, 6.0, 0);
    caveGroup.add(leftWall, rightWall, caveRoof);
    this.group.add(caveGroup);

    // 4. Sunken Wreck Structure at Laje Norte (-210, -8.2, 520) + Deep Wreck Nereus-Alpha (-280, -25.8, 880)
    const hullFloorGeo = new THREE.BoxGeometry(6.5, 0.5, 16.0);
    const ribGeo = new THREE.BoxGeometry(6.8, 2.4, 0.45);
    const containerGeo = new THREE.BoxGeometry(2.5, 2.4, 5.6);
    this.geometries.push(hullFloorGeo, ribGeo, containerGeo);

    const buildWreck = (wx: number, wy: number, wz: number, rotY: number, scale = 1.0) => {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      wg.rotation.set(0.06, rotY, -0.14);
      wg.scale.setScalar(scale);

      wg.add(new THREE.Mesh(hullFloorGeo, wreckSteelMat));
      for (let z = -6; z <= 6; z += 3) {
        const rib = new THREE.Mesh(ribGeo, wreckSteelMat);
        rib.position.set(0, 1.2, z);
        wg.add(rib);
      }
      const sunkenContainer = new THREE.Mesh(containerGeo, wreckSteelMat);
      sunkenContainer.position.set(5.5, 0.4, -2.5);
      sunkenContainer.rotation.y = 0.6;
      wg.add(sunkenContainer);
      this.group.add(wg);
    };
    buildWreck(-210, -8.2, 520, 0.42, 1.0);
    buildWreck(-280, -25.8, 880, -0.78, 1.45);

    // 5. Fossa Submarina Nereus Research Beacon (120, -24.5, 720)
    const stationGeo = new THREE.CylinderGeometry(1.4, 1.8, 3.6, 10);
    this.geometries.push(stationGeo);
    const trenchBeacon = new THREE.Mesh(stationGeo, wreckSteelMat);
    trenchBeacon.position.set(120, -24.5, 720);
    this.group.add(trenchBeacon);

    // 6. Surface Dive Marker Buoys
    const buoyConeGeo = new THREE.ConeGeometry(0.65, 1.5, 10);
    const buoyRingGeo = new THREE.TorusGeometry(0.85, 0.14, 8, 20);
    buoyRingGeo.rotateX(Math.PI / 2);
    this.geometries.push(buoyConeGeo, buoyRingGeo);

    const addSurfaceBuoy = (bx: number, bz: number) => {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(buoyConeGeo, buoyMat);
      cone.position.y = 0.7;
      const ring = new THREE.Mesh(buoyRingGeo, brassMat);
      ring.position.y = 0.05;
      g.add(cone, ring);
      g.position.set(bx, 0, bz);
      this.group.add(g);
      this.surfaceBuoys.push({ mesh: g, baseX: bx, baseZ: bz });
    };
    addSurfaceBuoy(45, 55);
    addSurfaceBuoy(-145, 290);
    addSurfaceBuoy(-210, 520);
    addSurfaceBuoy(120, 720);
    addSurfaceBuoy(-280, 880);

    // 7. Collectible Underwater Nodes
    const valveGeo = new THREE.TorusKnotGeometry(0.42, 0.14, 36, 8);
    const capsuleGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.05, 12);
    const compassGeo = new THREE.OctahedronGeometry(0.48, 0);
    this.geometries.push(valveGeo, capsuleGeo, compassGeo);

    const registerNode = (
      id: string,
      label: string,
      itemId: string,
      x: number,
      y: number,
      z: number,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.nodes.push({
        id,
        label,
        itemId,
        x,
        y,
        z,
        baseX: x,
        baseZ: z,
        collected: false,
        beaconMesh: mesh,
      });
    };

    registerNode(
      'node_pier_valve',
      'Válvula Naval de Bronze (Recife do Píer)',
      'salvage_brass_valve',
      45,
      -7.4,
      55,
      valveGeo,
      brassMat,
    );
    registerNode(
      'node_cave_relic',
      'Sextante & Bússola Histórica (Caverna Ponta Grossa)',
      'relic_maritime_compass',
      -145,
      -10.2,
      290,
      compassGeo,
      brassMat,
    );
    registerNode(
      'node_laje_capsule',
      'Cápsula de Dados Submarina Nereus',
      'clue_nereus_capsule',
      -210,
      -7.1,
      520,
      capsuleGeo,
      capsuleMat,
    );
    registerNode(
      'node_laje_valve',
      'Válvula Naval de Bronze (Destroços Sul)',
      'salvage_brass_valve',
      -204,
      -7.6,
      523,
      valveGeo,
      brassMat,
    );
    registerNode(
      'node_deep_blackbox',
      'Caixa-Preta Nereus-Alpha (Naufrágio Profundo)',
      'clue_nereus_blackbox',
      -280,
      -23.5,
      880,
      capsuleGeo,
      capsuleMat,
    );
  }

  public getSeabedFloorYAt(worldX: number, worldZ: number): number {
    const lz = worldZ - this.group.position.z;
    if (lz < 590) return -9.0;
    return -27.5;
  }

  public getEnvironmentInfoAt(
    worldX: number,
    worldY: number,
    worldZ: number,
    hasMask: boolean,
    hasFlashlight: boolean,
  ): { name: string; visibilityM: number; lowVisibilityZone: boolean } {
    const lx = worldX - this.group.position.x;
    const lz = worldZ - this.group.position.z;

    const inCave = Math.hypot(lx - -145, lz - 290) < 34;
    const inDeepWreck = Math.hypot(lx - -280, lz - 880) < 55;
    const inTrench = Math.hypot(lx - 120, lz - 720) < 55;
    const inLaje = Math.hypot(lx - -210, lz - 520) < 50;
    const inPierReef = Math.hypot(lx - 45, lz - 55) < 42;

    const lowVis = inCave || inDeepWreck || worldY < -13;
    let baseVis = hasMask ? 28 : 16;
    if (lowVis) {
      baseVis = hasFlashlight ? (hasMask ? 26 : 18) : 7.5;
    }

    const name = inCave
      ? 'Caverna Submarina Ponta Grossa'
      : inDeepWreck
        ? 'Naufrágio Profundo Nereus-Alpha'
        : inTrench
          ? 'Fossa Submarina Nereus'
          : inLaje
            ? 'Santuário & Destroços da Laje Norte'
            : inPierReef
              ? 'Recife Costeiro do Píer'
              : 'Leito Arenoso da Baía de Santos';

    return { name, visibilityM: baseVis, lowVisibilityZone: lowVis };
  }

  public getSonarSceneTargets(): SonarSceneObject[] {
    const offX = this.group.position.x;
    const offZ = this.group.position.z;
    const list: SonarSceneObject[] = [
      { id: 'sonar_pier_reef', label: 'Recife do Píer', kind: 'reef', x: 45 + offX, y: -7.5, z: 55 + offZ },
      { id: 'sonar_cave', label: 'Caverna Ponta Grossa', kind: 'terrain', x: -145 + offX, y: -10.5, z: 290 + offZ },
      { id: 'sonar_laje_wreck', label: 'Destroços Laje Norte', kind: 'wreck', x: -210 + offX, y: -7.8, z: 520 + offZ },
      { id: 'sonar_trench', label: 'Fossa Submarina Nereus', kind: 'terrain', x: 120 + offX, y: -20, z: 720 + offZ },
      { id: 'sonar_deep_wreck', label: 'Naufrágio Nereus-Alpha', kind: 'wreck', x: -280 + offX, y: -24, z: 880 + offZ },
    ];
    for (const n of this.nodes) {
      if (!n.collected) {
        list.push({
          id: n.id,
          label: n.label,
          kind: 'collectible',
          x: n.x,
          y: n.y,
          z: n.z,
        });
      }
    }
    return list;
  }

  public shiftOrigin(dx: number, dz: number): void {
    this.group.position.x -= dx;
    this.group.position.z -= dz;
    for (const n of this.nodes) {
      n.x -= dx;
      n.z -= dz;
    }
  }

  public getCollectedIds(): string[] {
    return this.nodes.filter((n) => n.collected).map((n) => n.id);
  }

  public setCollectedIds(ids: string[]): void {
    const set = new Set(ids);
    for (const n of this.nodes) {
      n.collected = set.has(n.id);
      n.beaconMesh.visible = !n.collected;
    }
  }

  public collectNode(id: string): UnderwaterNodeSnapshot | null {
    const n = this.nodes.find((item) => item.id === id && !item.collected);
    if (!n) return null;
    n.collected = true;
    n.beaconMesh.visible = false;
    return {
      id: n.id,
      label: n.label,
      itemId: n.itemId,
      x: n.x,
      y: n.y,
      z: n.z,
      collected: true,
    };
  }

  public findNearestCollectible(
    x: number,
    y: number,
    z: number,
    maxDist = 4.2,
  ): UnderwaterNodeSnapshot | null {
    let best: InternalDiveNode | null = null;
    let bestDist = maxDist;
    for (const n of this.nodes) {
      if (n.collected) continue;
      const d = Math.hypot(n.x - x, n.y - y, n.z - z);
      if (d <= bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (!best) return null;
    return {
      id: best.id,
      label: best.label,
      itemId: best.itemId,
      x: best.x,
      y: best.y,
      z: best.z,
      collected: best.collected,
    };
  }

  public getNodesSnapshot(): UnderwaterNodeSnapshot[] {
    return this.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      itemId: n.itemId,
      x: n.x,
      y: n.y,
      z: n.z,
      collected: n.collected,
    }));
  }

  public update(time: number, ocean: OceanConfig): void {
    const offX = this.group.position.x;
    const offZ = this.group.position.z;

    for (const b of this.surfaceBuoys) {
      sampleOcean(b.baseX + offX, b.baseZ + offZ, time, ocean, this.waveSample);
      b.mesh.position.y = this.waveSample.height + 0.05;
      b.mesh.rotation.z = this.waveSample.normalX * 0.45;
      b.mesh.rotation.x = -this.waveSample.normalZ * 0.45;
    }

    for (const n of this.nodes) {
      if (!n.collected) {
        n.beaconMesh.rotation.y = time * 1.4;
        n.beaconMesh.position.y = n.y + Math.sin(time * 2.2) * 0.16;
      }
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
