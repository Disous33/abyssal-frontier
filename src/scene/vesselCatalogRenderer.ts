import * as THREE from 'three';
import { SubmarineMesh } from './submarineMesh';

export interface BuiltVesselMesh {
  group: THREE.Group;
  propellerGroup: THREE.Group | null;
  cannonPivot: THREE.Group | null;
  fireGroup: THREE.Group;
  dispose: () => void;
}

/**
 * Builds distinct multi-part composite 3D geometry for every vessel in VESSEL_CATALOG,
 * usable both in the live world (SurfaceVesselVisuals) and the Naval Dealership 3D preview.
 */
export function buildCatalogVesselMesh(
  specId: string,
  hullColorHex: number,
  trimColorHex: number,
  weaponLevel = 0,
  isSoftwareGl = false,
): BuiltVesselMesh {
  if (specId === 'nereid_s1') {
    const sub = new SubmarineMesh(hullColorHex, trimColorHex, isSoftwareGl);
    const fireGroup = new THREE.Group();
    fireGroup.visible = false;
    return {
      group: sub.root,
      propellerGroup: null,
      cannonPivot: null,
      fireGroup,
      dispose: () => sub.dispose(),
    };
  }

  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: hullColorHex,
    roughness: 0.26,
    metalness: 0.16,
    clearcoat: 0.78,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColorHex,
    roughness: 0.4,
    metalness: 0.35,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xc29b6f,
    roughness: 0.76,
    metalness: 0.04,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f2537,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.86,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.28,
    metalness: 0.85,
  });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.38,
    metalness: 0.82,
  });
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  materials.push(hullMat, trimMat, deckMat, glassMat, steelMat, gunMetalMat, fireMat);

  const propellerGroup = new THREE.Group();
  let cannonPivot: THREE.Group | null = null;

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const addBowCone = (r: number, h: number, y: number, z: number, mat: THREE.Material) => {
    const g = new THREE.ConeGeometry(r, h, 4);
    g.rotateY(Math.PI / 4);
    g.rotateX(-Math.PI / 2);
    geometries.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  if (specId === 'badejo_f1') {
    // 8.2m Coastal Fishing Boat: wide cockpit, forward wheelhouse, aft rod holders & awning
    addBox(2.75, 1.05, 6.8, 0, 0.28, 0.4, hullMat);
    addBowCone(1.85, 2.5, 0.34, -4.15, hullMat);
    addBox(2.85, 0.16, 6.9, 0, 0.84, 0.4, trimMat);
    addBox(2.45, 0.08, 6.4, 0, 0.82, 0.4, deckMat);
    // Forward cabin
    addBox(1.85, 1.35, 2.35, 0, 1.5, -1.2, hullMat);
    addBox(1.9, 0.42, 1.85, 0, 1.72, -1.35, glassMat);
    addBox(2.0, 0.14, 2.75, 0, 2.22, -1.1, trimMat);
    // Aft fishing arch & awning
    addBox(2.3, 0.08, 2.2, 0, 2.25, 2.2, trimMat);
    for (const sx of [-1.05, 1.05]) {
      addBox(0.08, 1.45, 0.08, sx, 1.52, 1.2, steelMat);
      addBox(0.08, 1.45, 0.08, sx, 1.52, 3.2, steelMat);
    }
    propellerGroup.position.set(0, -0.32, 3.9);
  } else if (specId === 'marlin_r4') {
    // 9.6m Sleek V-hull High-Speed Interceptor
    addBox(2.45, 0.88, 7.2, 0, 0.25, 0.6, hullMat);
    addBowCone(1.68, 3.4, 0.32, -4.5, hullMat);
    addBox(2.52, 0.14, 7.25, 0, 0.72, 0.6, trimMat);
    addBox(2.1, 0.06, 6.6, 0, 0.7, 0.6, deckMat);
    // Low aerodynamic windshield & twin bolsters
    const glass = addBox(1.9, 0.48, 1.4, 0, 1.05, -0.65, glassMat);
    glass.rotation.x = -0.45;
    addBox(1.85, 0.22, 1.6, 0, 2.02, 1.8, trimMat); // Radar spoiler arch
    for (const sx of [-0.88, 0.88]) {
      addBox(0.12, 1.35, 0.28, sx, 1.38, 1.75, trimMat);
    }
    propellerGroup.position.set(0, -0.25, 4.35);
  } else if (specId === 'atlas_t2') {
    // 15.2m Heavy Offshore Workboat / Tug
    addBox(4.3, 1.65, 11.4, 0, 0.45, 0.8, hullMat);
    addBowCone(2.95, 3.4, 0.5, -6.5, hullMat);
    addBox(4.48, 0.28, 11.55, 0, 1.24, 0.8, trimMat);
    addBox(3.9, 0.08, 10.6, 0, 1.3, 0.8, deckMat);
    // Tall command bridge + twin exhaust stacks
    addBox(2.85, 2.25, 3.8, 0, 2.4, -2.0, hullMat);
    addBox(2.95, 0.58, 3.2, 0, 2.85, -2.1, glassMat);
    addBox(3.1, 0.2, 4.1, 0, 3.58, -2.0, trimMat);
    for (const sx of [-0.9, 0.9]) {
      addBox(0.32, 1.75, 0.32, sx, 2.35, 0.7, gunMetalMat);
    }
    // Cargo crane A-frame aft
    addBox(3.4, 0.18, 0.18, 0, 3.4, 5.2, trimMat);
    for (const sx of [-1.6, 1.6]) {
      addBox(0.18, 2.2, 0.18, sx, 2.35, 5.2, trimMat);
    }
    propellerGroup.position.set(0, -0.55, 6.6);
  } else if (specId === 'atlantis_y8') {
    // 20.5m Long-Range Expedition Yacht
    addBox(4.6, 1.75, 15.5, 0, 0.55, 0.6, hullMat);
    addBowCone(3.15, 4.8, 0.62, -9.4, hullMat);
    addBox(4.72, 0.22, 15.6, 0, 1.38, 0.6, trimMat);
    addBox(4.2, 0.08, 14.5, 0, 1.44, 0.6, deckMat);
    // Main saloon deck + upper flybridge
    addBox(3.4, 1.45, 7.6, 0, 2.15, 0.2, hullMat);
    addBox(3.48, 0.56, 6.8, 0, 2.25, -0.1, glassMat);
    addBox(2.75, 1.05, 4.8, 0, 3.35, 0.6, hullMat);
    addBox(2.82, 0.4, 4.2, 0, 3.45, 0.4, glassMat);
    addBox(2.6, 0.18, 2.8, 0, 4.05, 1.4, trimMat);
    propellerGroup.position.set(0, -0.5, 8.45);
  } else {
    // Aster S-01 fallback preview representation
    addBox(3.1, 1.15, 9.2, 0, 0.35, 0.3, hullMat);
    addBowCone(2.1, 2.8, 0.4, -5.6, hullMat);
    addBox(3.2, 0.14, 9.3, 0, 0.92, 0.3, trimMat);
    addBox(2.8, 0.06, 8.6, 0, 0.94, 0.3, deckMat);
    addBox(1.85, 0.52, 3.4, 0, 1.22, -0.2, hullMat);
    addBox(0.16, 10.2, 0.16, 0, 6.0, -0.3, gunMetalMat);
    propellerGroup.position.set(0, -0.45, 4.9);
  }

  // Spinning 3-blade propeller
  const bladeGeo = new THREE.BoxGeometry(0.06, 0.42, 0.02);
  geometries.push(bladeGeo);
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(bladeGeo, steelMat);
    blade.rotation.z = (b * Math.PI * 2) / 3;
    propellerGroup.add(blade);
  }
  group.add(propellerGroup);

  // Optional Foredeck Defensive Cannon Turret
  if (weaponLevel > 0) {
    cannonPivot = new THREE.Group();
    const bowZ = specId === 'atlantis_y8' ? -6.2 : specId === 'atlas_t2' ? -4.8 : -3.4;
    const deckY = specId === 'atlantis_y8' ? 1.52 : specId === 'atlas_t2' ? 1.38 : 0.9;
    cannonPivot.position.set(0, deckY, bowZ);
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.35, 10), gunMetalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.35, 8), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.14, -0.68);
    geometries.push(turretBase.geometry, barrel.geometry);
    cannonPivot.add(turretBase, barrel);
    group.add(cannonPivot);
  }

  // Deck fire flame indicator when taking combat fire damage
  const fireGroup = new THREE.Group();
  fireGroup.position.set(0, 1.5, 1.2);
  const flameGeo = new THREE.ConeGeometry(0.55, 1.6, 6);
  geometries.push(flameGeo);
  const flameMesh = new THREE.Mesh(flameGeo, fireMat);
  fireGroup.add(flameMesh);
  fireGroup.visible = false;
  group.add(fireGroup);

  return {
    group,
    propellerGroup,
    cannonPivot,
    fireGroup,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/**
 * Live-world wrapper for active non-sailboat surface vessels (Badejo, Marlin, Atlas, Atlantis).
 */
export class SurfaceVesselVisuals {
  public readonly root = new THREE.Group();
  private currentBuilt: BuiltVesselMesh | null = null;
  private currentKey = '';

  public ensureModel(
    specId: string,
    hullColorHex: number,
    trimColorHex: number,
    weaponLevel: number,
    isSoftwareGl: boolean,
  ): void {
    const key = `${specId}_${hullColorHex}_${trimColorHex}_${weaponLevel}`;
    if (key === this.currentKey && this.currentBuilt) return;
    if (this.currentBuilt) {
      this.root.remove(this.currentBuilt.group);
      this.currentBuilt.dispose();
    }
    this.currentBuilt = buildCatalogVesselMesh(
      specId,
      hullColorHex,
      trimColorHex,
      weaponLevel,
      isSoftwareGl,
    );
    this.root.add(this.currentBuilt.group);
    this.currentKey = key;
  }

  public update(
    dt: number,
    time: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    throttle: number,
    activeFires: number,
  ): void {
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);
    if (!this.currentBuilt) return;

    if (this.currentBuilt.propellerGroup && Math.abs(throttle) > 0.02) {
      this.currentBuilt.propellerGroup.rotation.z += dt * throttle * 26;
    }

    this.currentBuilt.fireGroup.visible = activeFires > 0;
    if (activeFires > 0) {
      const flick = 0.85 + Math.sin(time * 18) * 0.25;
      this.currentBuilt.fireGroup.scale.set(flick, 0.9 + Math.cos(time * 15) * 0.3, flick);
    }
  }

  public dispose(): void {
    if (this.currentBuilt) {
      this.currentBuilt.dispose();
      this.currentBuilt = null;
    }
  }
}
