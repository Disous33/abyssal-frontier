import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { createWaveSample, sampleOcean, WaveSample } from '../sim/oceanSolver';
import { InteractableType, OceanConfig } from '../sim/types';
import {
  ArticulatedCharacterRig,
  BENTO_APPEARANCE,
  CLARA_APPEARANCE,
  DOCKWORKER_APPEARANCE,
  HELENA_APPEARANCE,
  TOMAS_APPEARANCE,
} from './kaelCharacter';
import { ProceduralTextureSet } from './proceduralTextures';

export interface SafeDisembarkZone {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surfaceY: number;
}

export interface PortInteractable {
  id: InteractableType;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

interface CollisionAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Playable Living Port Area inspired by Porto de Santos (Ponta da Praia / Cais Inicial).
 * Upgraded in 0.6 with PBR textured concrete/asphalt/timber/containers, dockside props,
 * mooring ropes, gantry crane cables/trolleys, coastal palms, and night floodlights.
 */
export class PortOfSantosScene {
  public readonly group = new THREE.Group();
  public readonly safeZones: SafeDisembarkZone[] = [];
  public readonly interactables: PortInteractable[] = [];

  private readonly mooredBoatGroup = new THREE.Group();
  private readonly checkpointGroup = new THREE.Group();
  private readonly checkpointRing: THREE.Mesh;
  private readonly floodLights: THREE.PointLight[] = [];
  private readonly lampGlowMat: THREE.MeshStandardMaterial;

  private readonly helenaRig: ArticulatedCharacterRig;
  private readonly tomasRig: ArticulatedCharacterRig;
  private readonly claraRig: ArticulatedCharacterRig;
  private readonly bentoRig: ArticulatedCharacterRig;
  private readonly worker1Rig: ArticulatedCharacterRig;
  private readonly worker2Rig: ArticulatedCharacterRig;

  private readonly vesselBlockers: CollisionAABB[] = [
    { minX: -88, maxX: -12, minZ: -65, maxZ: 55 },
    { minX: -6, maxX: 13.0, minZ: 4, maxZ: 14 },
    { minX: -12, maxX: 11, minZ: -22, maxZ: -16 },
  ];

  private readonly colliders: RAPIER.Collider[] = [];
  private readonly rigidBodies: RAPIER.RigidBody[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly waveSample: WaveSample = createWaveSample();

  public readonly checkpointPos = new THREE.Vector3(95, 0, 340);

  constructor(world: RAPIER.World, textures?: ProceduralTextureSet, isSoftwareGl = false) {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: textures ? 0xdbe2ea : 0x64748b,
      map: textures?.portConcrete ?? null,
      normalMap: textures?.concreteNormal ?? null,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.88,
      metalness: 0.04,
    });
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: textures ? 0xd6dce3 : 0x334155,
      map: textures?.asphalt ?? null,
      roughness: 0.92,
      metalness: 0.02,
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: textures ? 0xb89678 : 0x6d4c33,
      map: textures?.teakDeck ?? null,
      normalMap: textures?.teakNormal ?? null,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.82,
      metalness: 0.02,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.42, metalness: 0.78 });
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.46, metalness: 0.56 });
    const warehouseMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      normalMap: textures?.containerNormal ?? null,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.68,
      metalness: 0.2,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e3a4c, roughness: 0.54, metalness: 0.36 });
    const shopAwningMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55 });
    const marketAwningMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.82 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95, metalness: 0.0 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b6239, roughness: 0.86, metalness: 0.02 });
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.94 });
    const palmLeafMat = new THREE.MeshStandardMaterial({
      color: 0x265933,
      roughness: 0.74,
      side: THREE.DoubleSide,
    });
    this.lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });

    this.materials.push(
      concreteMat,
      asphaltMat,
      timberMat,
      steelMat,
      craneMat,
      warehouseMat,
      roofMat,
      shopAwningMat,
      marketAwningMat,
      rubberMat,
      brassMat,
      ropeMat,
      crateMat,
      palmTrunkMat,
      palmLeafMat,
      this.lampGlowMat,
    );

    const addStaticBox = (
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      castShadow = true,
      addCollider = true,
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      if (addCollider) {
        const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
        const col = world.createCollider(RAPIER.ColliderDesc.cuboid(w * 0.5, h * 0.5, d * 0.5), rb);
        this.rigidBodies.push(rb);
        this.colliders.push(col);
      }
      return mesh;
    };

    // 1. Main Concrete Quay Apron + Asphalt Port Roadway + Safety Coping
    addStaticBox(-50, -1.275, -5, 76, 5.45, 120, concreteMat, false, true);
    addStaticBox(-36, 1.46, -5, 22, 0.04, 114, asphaltMat, false, false);
    addStaticBox(-12.35, 1.465, -5, 0.5, 0.04, 118, craneMat, false, false);

    // 2. Main Timber Boarding Pier & Steps
    addStaticBox(3.25, 0.9, 9, 18.5, 0.3, 10, timberMat, true, true);
    addStaticBox(11.75, 0.72, 9, 2.5, 0.26, 8, timberMat, true, true);
    for (let s = 0; s < 4; s++) {
      const stepX = -11.25 + s * 1.5;
      const stepTopY = 1.35 - s * 0.1;
      addStaticBox(stepX, stepTopY * 0.5, 9, 1.55, stepTopY, 6, timberMat, true, true);
    }

    // 3. North Marina Finger Pier
    addStaticBox(-0.5, 0.9, -19, 23, 0.3, 6, timberMat, true, true);
    addStaticBox(-11.2, 0.625, -19, 1.6, 1.25, 4, timberMat, true, true);

    this.safeZones.push(
      { name: 'Píer Principal (Aster S-01)', minX: -6, maxX: 13.5, minZ: 3, maxZ: 15, surfaceY: 1.08 },
      { name: 'Píer Norte (Marina)', minX: -12, maxX: 11.5, minZ: -23, maxZ: -15, surfaceY: 1.08 },
      { name: 'Cais do Porto de Santos', minX: -24, maxX: -11.5, minZ: -55, maxZ: 48, surfaceY: 1.48 },
    );

    // 4. Instanced Timber Pilings, Rubber Fenders & Mooring Bollards
    const pilingGeo = new THREE.CylinderGeometry(0.22, 0.24, 5.2, 10);
    const fenderGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.1, 10);
    fenderGeo.rotateX(Math.PI / 2);
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.19, 0.48, 10);
    this.geometries.push(pilingGeo, fenderGeo, bollardGeo);

    const pilingCoords: Array<[number, number]> = [
      [-5, 4.2], [2, 4.2], [9, 4.2], [12.3, 4.2],
      [-5, 13.8], [2, 13.8], [9, 13.8], [12.3, 13.8],
      [-8, -16.2], [0, -16.2], [10.6, -16.2],
      [-8, -21.8], [0, -21.8], [10.6, -21.8],
    ];
    const pilingsInst = new THREE.InstancedMesh(pilingGeo, timberMat, pilingCoords.length);
    const dummy = new THREE.Object3D();
    pilingCoords.forEach(([px, pz], idx) => {
      dummy.position.set(px, -0.5, pz);
      dummy.updateMatrix();
      pilingsInst.setMatrixAt(idx, dummy.matrix);
    });
    pilingsInst.computeBoundingSphere();
    this.group.add(pilingsInst);

    const fenderCoords: Array<[number, number, number]> = [
      [13.1, 0.72, 6.2], [13.1, 0.72, 9.0], [13.1, 0.72, 11.8],
      [11.1, 0.72, -17.5], [11.1, 0.72, -20.5],
      [-11.8, 1.0, 2.0], [-11.8, 1.0, -6.0],
    ];
    const fendersInst = new THREE.InstancedMesh(fenderGeo, rubberMat, fenderCoords.length);
    fenderCoords.forEach(([fx, fy, fz], idx) => {
      dummy.position.set(fx, fy, fz);
      dummy.updateMatrix();
      fendersInst.setMatrixAt(idx, dummy.matrix);
    });
    fendersInst.computeBoundingSphere();
    this.group.add(fendersInst);

    const bollardCoords: Array<[number, number, number]> = [
      [11.8, 1.28, 5.0], [11.8, 1.28, 13.0], [2.5, 1.28, 13.4],
      [-13.0, 1.68, 4.0], [-13.0, 1.68, 16.0], [-13.0, 1.68, -14.0],
    ];
    const bollardsInst = new THREE.InstancedMesh(bollardGeo, brassMat, bollardCoords.length);
    bollardCoords.forEach(([bx, by, bz], idx) => {
      dummy.position.set(bx, by, bz);
      dummy.updateMatrix();
      bollardsInst.setMatrixAt(idx, dummy.matrix);
    });
    bollardsInst.computeBoundingSphere();
    this.group.add(bollardsInst);

    // Mooring ropes connecting moored support boat to north finger pier bollards
    const makeMoorRope = (p0: THREE.Vector3, p1: THREE.Vector3) => {
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      mid.y -= 0.22;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, mid, p1]), 10, 0.028, 5, false);
      this.geometries.push(geo);
      this.group.add(new THREE.Mesh(geo, ropeMat));
    };
    makeMoorRope(new THREE.Vector3(10.8, 1.28, -16.8), new THREE.Vector3(13.3, 0.72, -16.2));
    makeMoorRope(new THREE.Vector3(10.8, 1.28, -21.2), new THREE.Vector3(13.3, 0.72, -21.8));

    // 5. Port Warehouses (Capitania & Armazéns Funcionais)
    addStaticBox(-45, 5.2, -28, 22, 7.5, 30, warehouseMat, true, true);
    addStaticBox(-45, 9.6, -28, 23.2, 1.4, 31.2, roofMat, true, false);
    addStaticBox(-45, 4.8, 34, 20, 6.7, 24, warehouseMat, true, true);
    addStaticBox(-45, 8.8, 34, 21.2, 1.3, 25.2, roofMat, true, false);

    // 6. Corrugated Shipping Containers with Colliders
    const containerGeo = new THREE.BoxGeometry(2.44, 2.59, 6.06);
    this.geometries.push(containerGeo);
    const containerPalette = [0x0f5c70, 0xb45309, 0x991b1b, 0x1e3a5f, 0x475569];
    const containerSpecs: Array<[number, number, number, number]> = [
      [-68, 2.75, -36, 0], [-65.2, 2.75, -36, 1], [-68, 5.35, -36, 2],
      [-68, 2.75, -26, 3], [-65.2, 2.75, -26, 0], [-68, 2.75, -16, 4],
      [-68, 2.75, 18, 1], [-65.2, 2.75, 18, 3], [-68, 5.35, 18, 0],
      [-68, 2.75, 28, 2], [-65.2, 2.75, 28, 4], [-68, 2.75, 38, 0],
    ];
    const contMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures?.containerCorrugated ?? null,
      normalMap: textures?.containerNormal ?? null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      metalness: 0.34,
    });
    this.materials.push(contMat);
    const contInst = new THREE.InstancedMesh(containerGeo, contMat, containerSpecs.length);
    const tint = new THREE.Color();
    containerSpecs.forEach(([x, y, z, cIdx], idx) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      contInst.setMatrixAt(idx, dummy.matrix);
      tint.setHex(containerPalette[cIdx % containerPalette.length]);
      contInst.setColorAt(idx, tint);

      const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
      const col = world.createCollider(RAPIER.ColliderDesc.cuboid(1.22, 1.3, 3.03), rb);
      this.rigidBodies.push(rb);
      this.colliders.push(col);
    });
    contInst.computeBoundingSphere();
    this.group.add(contInst);

    // Dockside Wooden Pallets, Cargo Crates & Safety Barriers
    const crateCoords: Array<[number, number, number, number]> = [
      [-17.2, 1.9, 16.5, 0.15],
      [-16.4, 1.9, 17.8, -0.35],
      [-21.2, 1.9, -4.5, 0.2],
      [-16.8, 1.9, 29.0, 0.08],
    ];
    const crateGeo = new THREE.BoxGeometry(1.05, 0.9, 1.05);
    this.geometries.push(crateGeo);
    for (const [cx, cy, cz, rot] of crateCoords) {
      const m = new THREE.Mesh(crateGeo, crateMat);
      m.position.set(cx, cy, cz);
      m.rotation.y = rot;
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }

    // 7. Two Detailed Port Gantry Cranes (with Operator Cab & Hanging Cable Spreader)
    const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 7.2, 6);
    this.geometries.push(cableGeo);
    for (const cz of [-38, 36]) {
      addStaticBox(-24, 9.0, cz, 4.2, 15.0, 4.2, craneMat, true, true);
      addStaticBox(-16, 15.8, cz, 24.0, 1.4, 2.2, craneMat, true, false);
      addStaticBox(-15, 18.2, cz, 1.2, 4.2, 1.6, steelMat, true, false);
      addStaticBox(-9.5, 14.3, cz, 2.2, 1.8, 1.8, warehouseMat, true, false);
      for (const cableZ of [cz - 0.55, cz + 0.55]) {
        const cable = new THREE.Mesh(cableGeo, steelMat);
        cable.position.set(-8.0, 11.2, cableZ);
        this.group.add(cable);
      }
      addStaticBox(-8.0, 7.4, cz, 2.2, 0.55, 4.4, craneMat, true, false);
    }

    // 8. Port Floodlight Poles & Real Night-Responsive Lighting
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 8.0, 8);
    const lampGeo = new THREE.BoxGeometry(0.85, 0.24, 0.44);
    this.geometries.push(poleGeo, lampGeo);
    const polePositions: Array<[number, number, boolean]> = [
      [-14, -40, false],
      [-14, -12, true],
      [-14, 16, true],
      [-14, 42, false],
      [4, 4.6, false],
      [4, 13.4, true],
    ];
    for (const [lx, lz, emitLight] of polePositions) {
      const pole = new THREE.Mesh(poleGeo, steelMat);
      pole.position.set(lx, 5.4, lz);
      const lamp = new THREE.Mesh(lampGeo, this.lampGlowMat);
      lamp.position.set(lx + 0.3, 9.3, lz);
      this.group.add(pole, lamp);

      if (emitLight && !isSoftwareGl) {
        const pl = new THREE.PointLight(0xffdfb0, 0.0, 46, 1.45);
        pl.position.set(lx + 0.6, 8.9, lz);
        this.floodLights.push(pl);
        this.group.add(pl);
      }
    }

    // Coastal Promenade Palms in Concrete Planters along the Waterfront
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 4.8, 7);
    const frondGeo = new THREE.ConeGeometry(1.6, 0.65, 6);
    frondGeo.scale(1.2, 0.45, 0.55);
    this.geometries.push(trunkGeo, frondGeo);
    for (const pz of [-15, 0, 15]) {
      const planter = addStaticBox(-29.5, 1.75, pz, 1.5, 0.6, 1.5, concreteMat, true, false);
      void planter;
      const trunk = new THREE.Mesh(trunkGeo, palmTrunkMat);
      trunk.position.set(-29.5, 4.2, pz);
      trunk.rotation.z = 0.06;
      trunk.castShadow = true;
      this.group.add(trunk);

      for (let f = 0; f < 5; f++) {
        const frond = new THREE.Mesh(frondGeo, palmLeafMat);
        const angle = (f / 5) * Math.PI * 2 + pz * 0.2;
        frond.position.set(-29.7 + Math.cos(angle) * 0.9, 6.55, pz + Math.sin(angle) * 0.9);
        frond.rotation.y = -angle;
        frond.rotation.z = -0.35;
        this.group.add(frond);
      }
    }

    // 9. Functional Port Stations
    addStaticBox(-19.5, 2.85, 23.0, 4.2, 2.8, 8.6, roofMat, true, true);
    addStaticBox(-16.2, 2.25, 19.5, 0.7, 1.6, 1.1, craneMat, true, false);

    addStaticBox(-15.5, 2.05, 2.0, 1.6, 1.2, 2.2, timberMat, true, true);
    addStaticBox(-15.5, 2.68, 2.0, 1.4, 0.08, 2.0, warehouseMat, false, false);

    addStaticBox(-15.5, 2.45, 13.5, 0.24, 2.0, 2.6, timberMat, true, true);
    addStaticBox(-15.32, 2.6, 13.5, 0.08, 1.25, 2.1, warehouseMat, false, false);

    addStaticBox(-27.8, 2.85, -8, 4.4, 2.8, 6.2, warehouseMat, true, true);
    addStaticBox(-25.1, 3.85, -8, 2.2, 0.2, 6.4, shopAwningMat, true, false);

    addStaticBox(-27.8, 2.85, 32, 4.4, 2.8, 6.2, warehouseMat, true, true);
    addStaticBox(-25.1, 3.85, 32, 2.2, 0.2, 6.4, marketAwningMat, true, false);

    // Concessionária Naval & Garagem Booth (south quay beside Oficina)
    addStaticBox(-27.8, 2.85, 16, 4.4, 2.8, 6.2, warehouseMat, true, true);
    addStaticBox(-25.1, 3.85, 16, 2.2, 0.2, 6.4, craneMat, true, false);

    // Doca do Submersível NEREID S-1 Beacon Pillar beside North Marina Finger Pier
    addStaticBox(10.8, 1.85, -16.2, 0.8, 1.8, 0.8, craneMat, true, false);

    // 10. Walkways / Safety Railings along Quay Lip
    addStaticBox(-12.2, 1.95, -39, 0.14, 0.95, 36, steelMat, false, true);
    addStaticBox(-12.2, 1.95, -5, 0.14, 0.95, 18, steelMat, false, true);
    addStaticBox(-12.2, 1.95, 32, 0.14, 0.95, 34, steelMat, false, true);

    // 11. Detailed Moored Harbor Support Boat beside North Finger Pier
    this.buildMooredSupportBoat(rubberMat, warehouseMat, roofMat, craneMat);
    this.mooredBoatGroup.position.set(14.5, 0.15, -19.0);
    this.group.add(this.mooredBoatGroup);

    // 12. Interactive NPCs (Helena, Tomás, Clara, Bento) + 2 Patrolling Dockworkers
    this.helenaRig = new ArticulatedCharacterRig(HELENA_APPEARANCE);
    this.helenaRig.root.position.set(-14.6, 1.45, 7.2);
    this.helenaRig.root.rotation.y = -Math.PI * 0.42;
    this.group.add(this.helenaRig.root);

    this.tomasRig = new ArticulatedCharacterRig(TOMAS_APPEARANCE);
    this.tomasRig.root.position.set(-15.4, 1.45, 25.5);
    this.tomasRig.root.rotation.y = -Math.PI * 0.5;
    this.group.add(this.tomasRig.root);

    this.claraRig = new ArticulatedCharacterRig(CLARA_APPEARANCE);
    this.claraRig.root.position.set(-24.0, 1.45, -8.0);
    this.claraRig.root.rotation.y = Math.PI * 0.5;
    this.group.add(this.claraRig.root);

    this.bentoRig = new ArticulatedCharacterRig(BENTO_APPEARANCE);
    this.bentoRig.root.position.set(-24.0, 1.45, 32.0);
    this.bentoRig.root.rotation.y = Math.PI * 0.5;
    this.group.add(this.bentoRig.root);

    this.worker1Rig = new ArticulatedCharacterRig(DOCKWORKER_APPEARANCE);
    this.worker1Rig.root.position.set(-20.0, 1.45, -25.0);
    this.group.add(this.worker1Rig.root);

    this.worker2Rig = new ArticulatedCharacterRig(DOCKWORKER_APPEARANCE);
    this.worker2Rig.root.position.set(-19.0, 1.45, 42.0);
    this.group.add(this.worker2Rig.root);

    // 13. Mission Checkpoint Gate Buoy
    const cpRingGeo = new THREE.TorusGeometry(6.5, 0.35, 12, 36);
    cpRingGeo.rotateX(Math.PI / 2);
    const cpBeaconGeo = new THREE.CylinderGeometry(0.4, 0.65, 4.2, 10);
    const cpMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    this.geometries.push(cpRingGeo, cpBeaconGeo);
    this.materials.push(cpMat);
    this.checkpointRing = new THREE.Mesh(cpRingGeo, cpMat);
    this.checkpointRing.position.y = 0.65;
    const cpBeacon = new THREE.Mesh(cpBeaconGeo, cpMat);
    cpBeacon.position.set(7.5, 2.0, 0);
    this.checkpointGroup.add(this.checkpointRing, cpBeacon);
    this.checkpointGroup.position.copy(this.checkpointPos);
    this.group.add(this.checkpointGroup);

    // Register Port Interactables
    this.interactables.push(
      {
        id: 'npc_helena',
        label: 'Falar com Comandante Helena Vance',
        sublabel: 'Capitania · Briefings e Campanha',
        x: -14.6,
        y: 1.45,
        z: 7.2,
        radius: 3.4,
      },
      {
        id: 'mission_board',
        label: 'Quadro de Missões Portuário',
        sublabel: 'Contratos de Entrega, Resgate, Patrulha & Pesquisa',
        x: -15.5,
        y: 1.45,
        z: 13.5,
        radius: 3.4,
      },
      {
        id: 'fuel_station',
        label: 'Posto de Abastecimento Naval',
        sublabel: 'Reabastecer Diesel Auxiliar & Carga Elétrica',
        x: -16.2,
        y: 1.45,
        z: 19.5,
        radius: 3.3,
      },
      {
        id: 'dock_service',
        label: 'Oficina Naval · Mecânico Tomás Braga',
        sublabel: 'Reparo de Subsistemas & Melhorias do Aster S-01',
        x: -15.4,
        y: 1.45,
        z: 25.5,
        radius: 3.5,
      },
      {
        id: 'equipment_shop',
        label: 'Loja de Equipamentos · Clara',
        sublabel: 'Máscara, Cilindro de Mergulho, Kits de Reparo & Sonar VHF',
        x: -24.0,
        y: 1.45,
        z: -8.0,
        radius: 3.8,
      },
      {
        id: 'port_market',
        label: 'Mercado Portuário · Bento',
        sublabel: 'Compra/Venda de Carga & Peças Recuperadas',
        x: -24.0,
        y: 1.45,
        z: 32.0,
        radius: 3.8,
      },
      {
        id: 'port_map',
        label: 'Consultar Carta Náutica (Mapa)',
        sublabel: 'Baixada Santista, Tráfego & Eventos',
        x: -15.5,
        y: 1.45,
        z: 2.0,
        radius: 3.2,
      },
      {
        id: 'naval_dealership',
        label: 'Concessionária Naval & Garagem Marítima',
        sublabel: 'Comprar, Vender, Trocar & Personalizar Embarcações e Submersível',
        x: -24.0,
        y: 1.45,
        z: 16.0,
        radius: 3.8,
      },
      {
        id: 'submarine_dock',
        label: 'Doca do Submersível NEREID S-1',
        sublabel: 'Embarcar no Submersível ou Configurar Garagem',
        x: 9.5,
        y: 1.08,
        z: -18.8,
        radius: 3.8,
      },
    );
  }

  private buildMooredSupportBoat(
    hullMat: THREE.Material,
    cabinMat: THREE.Material,
    trimMat: THREE.Material,
    orangeMat: THREE.Material,
  ): void {
    const hullGeo = new THREE.BoxGeometry(2.6, 0.95, 8.2);
    const bowGeo = new THREE.ConeGeometry(1.45, 2.2, 4);
    bowGeo.rotateY(Math.PI / 4);
    bowGeo.rotateX(-Math.PI / 2);
    const cabinGeo = new THREE.BoxGeometry(1.9, 1.25, 3.0);
    const stripeGeo = new THREE.BoxGeometry(2.68, 0.16, 8.25);
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 2.0, 6);
    this.geometries.push(hullGeo, bowGeo, cabinGeo, stripeGeo, mastGeo);

    const hull = new THREE.Mesh(hullGeo, trimMat);
    const bow = new THREE.Mesh(bowGeo, trimMat);
    bow.position.set(0, 0.04, -5.0);
    const gunwale = new THREE.Mesh(stripeGeo, orangeMat);
    gunwale.position.y = 0.42;
    const fenderTrim = new THREE.Mesh(stripeGeo, hullMat);
    fenderTrim.position.y = 0.18;

    const cab = new THREE.Mesh(cabinGeo, cabinMat);
    cab.position.set(0, 1.05, -0.5);
    const mast = new THREE.Mesh(mastGeo, hullMat);
    mast.position.set(0, 2.4, -0.5);
    this.mooredBoatGroup.add(hull, bow, gunwale, fenderTrim, cab, mast);
  }

  public isPointOverSafePier(x: number, z: number): SafeDisembarkZone | null {
    const offX = this.group.position.x;
    const offZ = this.group.position.z;
    const lx = x - offX;
    const lz = z - offZ;
    for (const zZone of this.safeZones) {
      if (lx >= zZone.minX && lx <= zZone.maxX && lz >= zZone.minZ && lz <= zZone.maxZ) {
        return zZone;
      }
    }
    return null;
  }

  public checkVesselCollision(
    boatWorldX: number,
    boatWorldZ: number,
    radius = 2.35,
  ): { hit: boolean; pushX: number; pushZ: number } {
    const lx = boatWorldX - this.group.position.x;
    const lz = boatWorldZ - this.group.position.z;

    for (const box of this.vesselBlockers) {
      const cx = Math.max(box.minX, Math.min(box.maxX, lx));
      const cz = Math.max(box.minZ, Math.min(box.maxZ, lz));
      const dx = lx - cx;
      const dz = lz - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        if (dist > 1e-4) {
          const overlap = radius - dist;
          return { hit: true, pushX: (dx / dist) * overlap, pushZ: (dz / dist) * overlap };
        }
        return { hit: true, pushX: radius, pushZ: 0 };
      }
    }
    return { hit: false, pushX: 0, pushZ: 0 };
  }

  public isWaterShallow(boatWorldX: number, boatWorldZ: number): boolean {
    const lx = boatWorldX - this.group.position.x;
    const lz = boatWorldZ - this.group.position.z;
    if (lx < -92 && lz > -400 && lz < 400) return true;
    if (lx > 420 && lz > -240 && lz < 180) return true;
    if (Math.hypot(lx - -265, lz - 525) < 28) return true;
    return false;
  }

  public update(
    dt: number,
    time: number,
    ocean: OceanConfig,
    showCheckpoint: boolean,
    nightFactor = 0,
  ): void {
    // Harbor night floodlights
    const lightPower = THREE.MathUtils.clamp(nightFactor, 0, 1);
    this.lampGlowMat.emissiveIntensity = 0.35 + lightPower * 2.8;
    for (const pl of this.floodLights) {
      pl.intensity = lightPower * 26.0;
    }

    // Animate moored support boat on harbor waves
    sampleOcean(14.5 + this.group.position.x, -19.0 + this.group.position.z, time, ocean, this.waveSample);
    this.mooredBoatGroup.position.y = this.waveSample.height + 0.1;
    this.mooredBoatGroup.rotation.z = this.waveSample.normalX * 0.4;
    this.mooredBoatGroup.rotation.x = -this.waveSample.normalZ * 0.4;

    // Animate Stationary Functional NPCs
    this.helenaRig.updateAnimation(dt, time, 'idle', 0);
    this.tomasRig.updateAnimation(dt, time + 1.5, 'idle', 0);
    this.claraRig.updateAnimation(dt, time + 0.8, 'idle', 0);
    this.bentoRig.updateAnimation(dt, time + 2.3, 'idle', 0);

    // Animate Patrolling Dockworkers along Quay Apron
    const w1Phase = time * 0.22;
    const w1Z = -22 + Math.sin(w1Phase) * 14;
    const w1Dir = Math.cos(w1Phase) >= 0 ? 0 : Math.PI;
    this.worker1Rig.root.position.set(-20.0, 1.45, w1Z);
    this.worker1Rig.root.rotation.y = w1Dir;
    this.worker1Rig.updateAnimation(dt, time, 'walk', 2.4);

    const w2Phase = time * 0.18 + 1.2;
    const w2X = -22 + Math.sin(w2Phase) * 8;
    const w2Dir = Math.cos(w2Phase) >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    this.worker2Rig.root.position.set(w2X, 1.45, 41.0);
    this.worker2Rig.root.rotation.y = w2Dir;
    this.worker2Rig.updateAnimation(dt, time + 0.7, 'walk', 2.1);

    // Animate Checkpoint Ring on waves
    this.checkpointGroup.visible = showCheckpoint;
    if (showCheckpoint) {
      sampleOcean(
        this.checkpointPos.x + this.group.position.x,
        this.checkpointPos.z + this.group.position.z,
        time,
        ocean,
        this.waveSample,
      );
      this.checkpointGroup.position.y = this.waveSample.height + 0.25;
      this.checkpointRing.rotation.z = time * 0.8;
    }
  }

  public dispose(world?: RAPIER.World): void {
    if (world) {
      for (const rb of this.rigidBodies) {
        try {
          world.removeRigidBody(rb);
        } catch {
          // Ignore if world already freed
        }
      }
    }
    this.helenaRig.dispose();
    this.tomasRig.dispose();
    this.claraRig.dispose();
    this.bentoRig.dispose();
    this.worker1Rig.dispose();
    this.worker2Rig.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
