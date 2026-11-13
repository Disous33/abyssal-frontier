import * as THREE from 'three';
import { SailClothSolver } from '../sim/clothSolver';
import { ProceduralTextureSet } from './proceduralTextures';

interface HullStation {
  z: number;
  halfBeam: number;
  sheerY: number;
  keelY: number;
  bilgeFullness: number; // 0 = sharp V bow, 1 = U/rounded midship
}

const HULL_STATIONS: HullStation[] = [
  { z: -6.05, halfBeam: 0.02, sheerY: 1.28, keelY: 0.12, bilgeFullness: 0.1 },
  { z: -5.3, halfBeam: 0.34, sheerY: 1.22, keelY: -0.22, bilgeFullness: 0.25 },
  { z: -4.2, halfBeam: 0.78, sheerY: 1.15, keelY: -0.45, bilgeFullness: 0.45 },
  { z: -2.8, halfBeam: 1.24, sheerY: 1.07, keelY: -0.62, bilgeFullness: 0.7 },
  { z: -1.2, halfBeam: 1.56, sheerY: 1.01, keelY: -0.72, bilgeFullness: 0.85 },
  { z: 0.4, halfBeam: 1.66, sheerY: 0.98, keelY: -0.72, bilgeFullness: 0.88 },
  { z: 2.0, halfBeam: 1.58, sheerY: 0.97, keelY: -0.60, bilgeFullness: 0.85 },
  { z: 3.6, halfBeam: 1.38, sheerY: 0.98, keelY: -0.42, bilgeFullness: 0.80 },
  { z: 4.9, halfBeam: 1.16, sheerY: 1.00, keelY: -0.22, bilgeFullness: 0.76 },
  { z: 5.75, halfBeam: 0.98, sheerY: 1.02, keelY: -0.08, bilgeFullness: 0.74 },
];

/**
 * Generates a lofted 3D yacht hull geometry from naval stations.
 */
function buildLoftedHullGeometry(ringPoints = 19): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s < HULL_STATIONS.length; s++) {
    const st = HULL_STATIONS[s];
    const v = s / (HULL_STATIONS.length - 1);

    for (let i = 0; i < ringPoints; i++) {
      const t = (i / (ringPoints - 1)) * 2 - 1;
      const absT = Math.abs(t);
      const sign = t < 0 ? -1 : 1;

      const xShape = Math.pow(absT, 1.0 - 0.42 * st.bilgeFullness);
      const yShape = Math.pow(absT, 1.35 + 0.75 * st.bilgeFullness);

      const x = sign * st.halfBeam * xShape;
      const y = st.keelY + (st.sheerY - st.keelY) * yShape;

      positions.push(x, y, st.z);
      uvs.push(i / (ringPoints - 1), v);
    }
  }

  for (let s = 0; s < HULL_STATIONS.length - 1; s++) {
    for (let i = 0; i < ringPoints - 1; i++) {
      const a = s * ringPoints + i;
      const b = a + 1;
      const c = (s + 1) * ringPoints + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const sternBase = (HULL_STATIONS.length - 1) * ringPoints;
  const sternCenterIdx = positions.length / 3;
  const lastSt = HULL_STATIONS[HULL_STATIONS.length - 1];
  positions.push(0, (lastSt.sheerY + lastSt.keelY) * 0.55, lastSt.z);
  uvs.push(0.5, 1);
  for (let i = 0; i < ringPoints - 1; i++) {
    indices.push(sternBase + i, sternCenterIdx, sternBase + i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the cambered teak deck surface matching the hull sheer line.
 */
function buildDeckGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = 9;

  for (let s = 0; s < HULL_STATIONS.length; s++) {
    const st = HULL_STATIONS[s];
    const v = s / (HULL_STATIONS.length - 1);
    for (let c = 0; c < cols; c++) {
      const t = (c / (cols - 1)) * 2 - 1;
      const x = t * st.halfBeam * 0.985;
      const camber = (1 - t * t) * 0.09;
      const inCockpit = st.z > 1.8 && st.z < 5.1 && Math.abs(t) < 0.62;
      const y = st.sheerY + camber - (inCockpit ? 0.24 : 0);
      positions.push(x, y, st.z);
      uvs.push(c / (cols - 1), v * 2.5);
    }
  }

  for (let s = 0; s < HULL_STATIONS.length - 1; s++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = s * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Procedural 12m Aster S-01 Sloop composite Three.js vessel with 3-level LOD,
 * stainless bow pulpit/stanchions/lifelines, cockpit coaming & binnacle,
 * anchor assembly, boarding ladder, navigation lights, and backlit XPBD cloth sails.
 */
export class AsterS01Vessel {
  public readonly root = new THREE.Group();
  private readonly lod = new THREE.LOD();
  private readonly boomPivot: THREE.Group;
  private readonly rudderPivot: THREE.Group;
  private readonly wheelPort: THREE.Group;
  private readonly wheelStbd: THREE.Group;
  private readonly propellerGroup: THREE.Group;
  private readonly windexPivot: THREE.Group;

  private readonly navPortMat: THREE.MeshStandardMaterial;
  private readonly navStbdMat: THREE.MeshStandardMaterial;
  private readonly navSternMat: THREE.MeshStandardMaterial;
  private readonly navMastMat: THREE.MeshStandardMaterial;
  private hullMat!: THREE.MeshPhysicalMaterial;
  private bootStripeMat!: THREE.MeshStandardMaterial;
  private readonly cannonGroup = new THREE.Group();
  private readonly fireGroup = new THREE.Group();

  public readonly mainsailCloth: SailClothSolver;
  public readonly jibCloth: SailClothSolver;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(textures: ProceduralTextureSet, isSoftwareGl: boolean) {
    // Shared calibrated PBR materials
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f2c3d,
      roughness: 0.24,
      roughnessMap: textures.hullRoughness,
      metalness: 0.14,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      side: THREE.DoubleSide,
    });
    const bootStripeMat = new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      roughness: 0.28,
      metalness: 0.68,
    });
    this.hullMat = hullMat;
    this.bootStripeMat = bootStripeMat;
    const deckMat = new THREE.MeshStandardMaterial({
      map: textures.teakDeck,
      normalMap: textures.teakNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const cabinMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8edf2,
      roughness: 0.26,
      metalness: 0.06,
      clearcoat: 0.62,
    });
    const windowMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1924,
      roughness: 0.06,
      metalness: 0.18,
      clearcoat: 1.0,
      opacity: isSoftwareGl ? 0.78 : 0.9,
      transparent: true,
    });
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.78,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.2,
      metalness: 0.92,
    });
    const keelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.55,
      metalness: 0.45,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0xc8c2b4,
      roughness: 0.85,
      metalness: 0.02,
    });
    const sailMat = new THREE.MeshPhysicalMaterial({
      map: textures.sailcloth,
      normalMap: textures.sailNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      color: 0xf8fafc,
      roughness: 0.65,
      metalness: 0.0,
      sheen: 0.8,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xe2e8f0),
      side: THREE.DoubleSide,
    });
    sailMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          vec3 sailTranslucent = diffuseColor.rgb * vec3(0.14, 0.16, 0.18);
          gl_FragColor.rgb += sailTranslucent * (1.0 - abs(vNormal.z)) * 0.35;
          #include <dithering_fragment>
        `,
      );
    };

    this.navPortMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    this.navStbdMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    this.navSternMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    this.navMastMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });

    this.materials.push(
      hullMat,
      bootStripeMat,
      deckMat,
      cabinMat,
      windowMat,
      mastMat,
      steelMat,
      keelMat,
      cushionMat,
      sailMat,
      this.navPortMat,
      this.navStbdMat,
      this.navSternMat,
      this.navMastMat,
    );

    const highGroup = new THREE.Group();
    const medGroup = new THREE.Group();
    const lowGroup = new THREE.Group();

    // 1. Lofted Hull (shared high/med + simplified low)
    const hullGeo = buildLoftedHullGeometry(19);
    const hullLowGeo = buildLoftedHullGeometry(9);
    this.geometries.push(hullGeo, hullLowGeo);

    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    highGroup.add(hullMesh);

    const hullMed = new THREE.Mesh(hullGeo, hullMat);
    hullMed.castShadow = true;
    medGroup.add(hullMed);

    const hullLow = new THREE.Mesh(hullLowGeo, hullMat);
    lowGroup.add(hullLow);

    // 2. Brass Waterline Boot Stripe & Gunwale Rubrail
    const stripeCurvePoints = HULL_STATIONS.map(
      (st) => new THREE.Vector3(st.halfBeam * 0.99, st.sheerY - 0.06, st.z),
    );
    const stripeCurveR = new THREE.CatmullRomCurve3(stripeCurvePoints);
    const stripeCurveL = new THREE.CatmullRomCurve3(
      stripeCurvePoints.map((p) => new THREE.Vector3(-p.x, p.y, p.z)),
    );
    const stripeGeoR = new THREE.TubeGeometry(stripeCurveR, 28, 0.034, 6, false);
    const stripeGeoL = new THREE.TubeGeometry(stripeCurveL, 28, 0.034, 6, false);
    this.geometries.push(stripeGeoR, stripeGeoL);
    highGroup.add(new THREE.Mesh(stripeGeoR, bootStripeMat), new THREE.Mesh(stripeGeoL, bootStripeMat));
    medGroup.add(new THREE.Mesh(stripeGeoR, bootStripeMat), new THREE.Mesh(stripeGeoL, bootStripeMat));

    // 3. Teak Deck & Cockpit
    const deckGeo = buildDeckGeometry();
    this.geometries.push(deckGeo);
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.receiveShadow = true;
    highGroup.add(deckMesh);
    medGroup.add(new THREE.Mesh(deckGeo, deckMat));

    // Cockpit bench cushions & teak coaming combing
    const benchGeo = new THREE.BoxGeometry(0.42, 0.14, 2.75);
    const coamingGeo = new THREE.BoxGeometry(0.08, 0.24, 3.0);
    this.geometries.push(benchGeo, coamingGeo);
    for (const side of [-1, 1]) {
      const bench = new THREE.Mesh(benchGeo, cushionMat);
      bench.position.set(side * 0.72, 0.86, 3.35);
      bench.receiveShadow = true;
      highGroup.add(bench);

      const coaming = new THREE.Mesh(coamingGeo, cabinMat);
      coaming.position.set(side * 1.0, 1.04, 3.35);
      highGroup.add(coaming);
    }

    // 4. Sculpted Coachroof Cabin + Optical Windows + Grab Rails
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-0.98, 0);
    cabinShape.lineTo(0.98, 0);
    cabinShape.lineTo(0.76, 0.44);
    cabinShape.lineTo(-0.76, 0.44);
    cabinShape.closePath();

    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
      depth: 3.3,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    cabinGeo.translate(0, 0.96, -1.75);
    this.geometries.push(cabinGeo);
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.castShadow = true;
    cabinMesh.receiveShadow = true;
    highGroup.add(cabinMesh);
    medGroup.add(new THREE.Mesh(cabinGeo, cabinMat));

    const winGeo = new THREE.BoxGeometry(1.94, 0.16, 2.35);
    const hatchGeo = new THREE.BoxGeometry(0.76, 0.08, 0.72);
    this.geometries.push(winGeo, hatchGeo);
    const winMesh = new THREE.Mesh(winGeo, windowMat);
    winMesh.position.set(0, 1.23, -0.05);
    const hatchMesh = new THREE.Mesh(hatchGeo, windowMat);
    hatchMesh.position.set(0, 1.44, -2.55);
    highGroup.add(winMesh, hatchMesh);
    medGroup.add(new THREE.Mesh(winGeo, windowMat));

    // Cabin grab rails
    const railGeo = new THREE.CylinderGeometry(0.018, 0.018, 2.4, 8);
    railGeo.rotateX(Math.PI / 2);
    this.geometries.push(railGeo);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, steelMat);
      rail.position.set(side * 0.64, 1.5, -0.1);
      highGroup.add(rail);
    }

    // Bow Pulpit, Stanchions, Lifelines & Anchor Assembly (High LOD)
    const stanchionGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6);
    this.geometries.push(stanchionGeo);
    const lifelinePortPts: THREE.Vector3[] = [];
    const lifelineStbdPts: THREE.Vector3[] = [];
    for (const sIdx of [1, 2, 3, 4, 5, 6, 8, 9]) {
      const st = HULL_STATIONS[sIdx];
      const topY = st.sheerY + 0.6;
      const sx = st.halfBeam * 0.94;
      lifelineStbdPts.push(new THREE.Vector3(sx, topY, st.z));
      lifelinePortPts.push(new THREE.Vector3(-sx, topY, st.z));
      for (const side of [-1, 1]) {
        const stanchion = new THREE.Mesh(stanchionGeo, steelMat);
        stanchion.position.set(side * sx, st.sheerY + 0.3, st.z);
        highGroup.add(stanchion);
      }
    }
    const linePortGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lifelinePortPts), 20, 0.011, 5, false);
    const lineStbdGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lifelineStbdPts), 20, 0.011, 5, false);
    const bowPulpitGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.34, 1.82, -5.28),
        new THREE.Vector3(0, 1.88, -6.02),
        new THREE.Vector3(0.34, 1.82, -5.28),
      ]),
      12,
      0.016,
      6,
      false,
    );
    const anchorRollerGeo = new THREE.BoxGeometry(0.16, 0.1, 0.45);
    const anchorFlukeGeo = new THREE.ConeGeometry(0.14, 0.34, 4);
    anchorFlukeGeo.rotateX(-Math.PI * 0.55);
    const ladderRailGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.95, 6);
    this.geometries.push(linePortGeo, lineStbdGeo, bowPulpitGeo, anchorRollerGeo, anchorFlukeGeo, ladderRailGeo);
    highGroup.add(
      new THREE.Mesh(linePortGeo, steelMat),
      new THREE.Mesh(lineStbdGeo, steelMat),
      new THREE.Mesh(bowPulpitGeo, steelMat),
    );

    const anchorRoller = new THREE.Mesh(anchorRollerGeo, steelMat);
    anchorRoller.position.set(0, 1.32, -6.05);
    const anchorFluke = new THREE.Mesh(anchorFlukeGeo, steelMat);
    anchorFluke.position.set(0, 1.24, -6.22);
    highGroup.add(anchorRoller, anchorFluke);

    for (const lx of [-0.22, 0.22]) {
      const lRail = new THREE.Mesh(ladderRailGeo, steelMat);
      lRail.position.set(lx, 0.58, 5.82);
      lRail.rotation.x = 0.12;
      highGroup.add(lRail);
    }

    // Navigation Lights (Port Red, Starboard Green, Stern White, Masthead Anchor Light)
    const navLampGeo = new THREE.SphereGeometry(0.065, 8, 8);
    this.geometries.push(navLampGeo);
    const portLamp = new THREE.Mesh(navLampGeo, this.navPortMat);
    portLamp.position.set(-0.36, 1.85, -5.3);
    const stbdLamp = new THREE.Mesh(navLampGeo, this.navStbdMat);
    stbdLamp.position.set(0.36, 1.85, -5.3);
    const sternLamp = new THREE.Mesh(navLampGeo, this.navSternMat);
    sternLamp.position.set(0, 1.12, 5.76);
    const mastLamp = new THREE.Mesh(navLampGeo, this.navMastMat);
    mastLamp.position.set(0, 12.42, -0.35);
    highGroup.add(portLamp, stbdLamp, sternLamp, mastLamp);

    // 5. Deep Fin Keel & Torpedo Ballast Bulb
    const keelGeo = new THREE.BoxGeometry(0.16, 1.45, 1.55);
    const bulbGeo = new THREE.CapsuleGeometry(0.24, 1.6, 8, 14);
    bulbGeo.rotateX(Math.PI / 2);
    this.geometries.push(keelGeo, bulbGeo);

    for (const grp of [highGroup, medGroup, lowGroup]) {
      const km = new THREE.Mesh(keelGeo, keelMat);
      km.position.set(0, -1.25, 0.15);
      const bm = new THREE.Mesh(bulbGeo, keelMat);
      bm.position.set(0, -1.96, 0.2);
      grp.add(km, bm);
    }

    // 6. Articulated Spade Rudder (attached to root so rudder rotation always works across LODs)
    this.rudderPivot = new THREE.Group();
    this.rudderPivot.position.set(0, -0.15, 4.95);
    const rudderGeo = new THREE.BoxGeometry(0.09, 1.25, 0.58);
    rudderGeo.translate(0, -0.68, 0.22);
    this.geometries.push(rudderGeo);
    const rudderMesh = new THREE.Mesh(rudderGeo, keelMat);
    this.rudderPivot.add(rudderMesh);
    this.root.add(this.rudderPivot);

    // 7. Auxiliary Saildrive & Spinning Folding Propeller
    const strutGeo = new THREE.BoxGeometry(0.08, 0.55, 0.3);
    this.geometries.push(strutGeo);
    const strutMesh = new THREE.Mesh(strutGeo, keelMat);
    strutMesh.position.set(0, -0.52, 3.85);
    highGroup.add(strutMesh);

    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.set(0, -0.74, 4.05);
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.38, 0.02);
    this.geometries.push(bladeGeo);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, bootStripeMat);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      blade.rotation.y = 0.35;
      this.propellerGroup.add(blade);
    }
    this.root.add(this.propellerGroup);

    // 8. Twin Helm Pedestals, Compass Binnacles & Rotating Steering Wheels
    const pedGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.85, 10);
    const compassGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const wheelRimGeo = new THREE.TorusGeometry(0.38, 0.022, 8, 24);
    const spokeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.74, 6);
    this.geometries.push(pedGeo, compassGeo, wheelRimGeo, spokeGeo);

    const makeHelm = (xPos: number) => {
      const ped = new THREE.Mesh(pedGeo, cabinMat);
      ped.position.set(xPos, 1.18, 4.15);
      highGroup.add(ped);

      const compass = new THREE.Mesh(compassGeo, windowMat);
      compass.position.set(xPos, 1.62, 4.12);
      highGroup.add(compass);

      const wheel = new THREE.Group();
      wheel.position.set(xPos, 1.48, 4.30);
      wheel.add(new THREE.Mesh(wheelRimGeo, steelMat));
      for (let s = 0; s < 3; s++) {
        const sp = new THREE.Mesh(spokeGeo, steelMat);
        sp.rotation.z = (s * Math.PI) / 3;
        wheel.add(sp);
      }
      this.root.add(wheel);
      return wheel;
    };
    this.wheelPort = makeHelm(-0.62);
    this.wheelStbd = makeHelm(0.62);

    // 9. Tapered Mast, Double Spreaders, Standing Rigging & Windex
    const mastGeo = new THREE.CylinderGeometry(0.075, 0.115, 11.4, 12);
    this.geometries.push(mastGeo);
    for (const grp of [highGroup, medGroup, lowGroup]) {
      const mm = new THREE.Mesh(mastGeo, mastMat);
      mm.position.set(0, 6.7, -0.35);
      mm.castShadow = grp !== lowGroup;
      grp.add(mm);
    }

    const spreaderGeo = new THREE.CylinderGeometry(0.022, 0.032, 2.2, 8);
    spreaderGeo.rotateZ(Math.PI / 2);
    this.geometries.push(spreaderGeo);
    const sp1 = new THREE.Mesh(spreaderGeo, steelMat);
    sp1.position.set(0, 5.2, -0.35);
    const sp2 = new THREE.Mesh(spreaderGeo, steelMat);
    sp2.scale.set(0.74, 1, 1);
    sp2.position.set(0, 8.6, -0.35);
    highGroup.add(sp1, sp2);

    const stayMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.72 });
    this.materials.push(stayMat);
    const riggingPts = [
      new THREE.Vector3(0, 1.35, -5.6), new THREE.Vector3(0, 11.4, -0.42),
      new THREE.Vector3(0, 1.05, 5.65), new THREE.Vector3(0, 12.2, -0.35),
      new THREE.Vector3(-1.52, 1.02, 0.05), new THREE.Vector3(-0.08, 11.6, -0.35),
      new THREE.Vector3(1.52, 1.02, 0.05), new THREE.Vector3(0.08, 11.6, -0.35),
    ];
    const stayGeo = new THREE.BufferGeometry().setFromPoints(riggingPts);
    this.geometries.push(stayGeo);
    highGroup.add(new THREE.LineSegments(stayGeo, stayMat));

    this.windexPivot = new THREE.Group();
    this.windexPivot.position.set(0, 12.55, -0.35);
    const vaneGeo = new THREE.ConeGeometry(0.06, 0.45, 6);
    vaneGeo.rotateX(Math.PI / 2);
    this.geometries.push(vaneGeo);
    const vaneMesh = new THREE.Mesh(vaneGeo, bootStripeMat);
    this.windexPivot.add(vaneMesh);
    this.root.add(this.windexPivot);

    // 10. Articulated Boom, Gooseneck & Boom Vang
    this.boomPivot = new THREE.Group();
    this.boomPivot.position.set(0, 2.12, -0.35);
    const boomGeo = new THREE.CylinderGeometry(0.055, 0.068, 4.45, 10);
    boomGeo.rotateX(Math.PI / 2);
    boomGeo.translate(0, 0, 2.22);
    const vangGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.25, 6);
    vangGeo.rotateX(Math.PI * 0.25);
    vangGeo.translate(0, -0.42, 0.45);
    this.geometries.push(boomGeo, vangGeo);
    const boomMesh = new THREE.Mesh(boomGeo, mastMat);
    boomMesh.castShadow = true;
    const vangMesh = new THREE.Mesh(vangGeo, steelMat);
    this.boomPivot.add(boomMesh, vangMesh);
    this.root.add(this.boomPivot);

    // Register LOD tiers
    this.lod.addLevel(highGroup, 0);
    this.lod.addLevel(medGroup, 55);
    this.lod.addLevel(lowGroup, 145);
    this.root.add(this.lod);

    // 11. High-Res XPBD Deformable Mainsail & Jib
    this.mainsailCloth = new SailClothSolver({ cols: 11, rows: 14, isJib: false });
    this.jibCloth = new SailClothSolver({ cols: 8, rows: 12, isJib: true });

    const mainsailMesh = new THREE.Mesh(this.mainsailCloth.getGeometry(), sailMat);
    mainsailMesh.castShadow = true;
    mainsailMesh.receiveShadow = true;
    mainsailMesh.frustumCulled = false;

    const jibMesh = new THREE.Mesh(this.jibCloth.getGeometry(), sailMat);
    jibMesh.castShadow = true;
    jibMesh.receiveShadow = true;
    jibMesh.frustumCulled = false;

    this.root.add(mainsailMesh, jibMesh);

    // 12. Optional Foredeck Defensive Cannon Turret + Combat Fire Plume
    this.cannonGroup.position.set(0, 1.24, -4.15);
    const turretGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.28, 10);
    const barrelGeo = new THREE.CylinderGeometry(0.055, 0.075, 1.15, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const fireGeo = new THREE.ConeGeometry(0.45, 1.4, 6);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.86 });
    this.geometries.push(turretGeo, barrelGeo, fireGeo);
    this.materials.push(fireMat);

    const turretMesh = new THREE.Mesh(turretGeo, keelMat);
    const barrelMesh = new THREE.Mesh(barrelGeo, steelMat);
    barrelMesh.position.set(0, 0.12, -0.58);
    this.cannonGroup.add(turretMesh, barrelMesh);
    this.cannonGroup.visible = false;
    this.root.add(this.cannonGroup);

    this.fireGroup.position.set(0, 1.45, 1.2);
    this.fireGroup.add(new THREE.Mesh(fireGeo, fireMat));
    this.fireGroup.visible = false;
    this.root.add(this.fireGroup);
  }

  public setHullPaint(hullColorHex: number, trimColorHex: number): void {
    this.hullMat.color.setHex(hullColorHex);
    this.bootStripeMat.color.setHex(trimColorHex);
  }

  public setWeaponEquipped(weaponLevel: number, activeFires = 0, time = 0): void {
    this.cannonGroup.visible = weaponLevel > 0;
    this.fireGroup.visible = activeFires > 0;
    if (activeFires > 0) {
      const s = 0.85 + Math.sin(time * 18) * 0.25;
      this.fireGroup.scale.set(s, 0.9 + Math.cos(time * 15) * 0.3, s);
    }
  }

  public updateVisuals(
    dt: number,
    time: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    boomAngleRad: number,
    jibAngleRad: number,
    rudderAngleRad: number,
    apparentWindRelRad: number,
    sailArea: number,
    clothPressure: number,
    luffingFactor: number,
    turbulence: number,
    throttle: number,
    nightFactor = 0,
  ): void {
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);

    // Update navigation lights emissive boost at night
    const navBoost = 0.45 + nightFactor * 2.4;
    this.navPortMat.emissiveIntensity = navBoost;
    this.navStbdMat.emissiveIntensity = navBoost;
    this.navSternMat.emissiveIntensity = navBoost * 0.9;
    this.navMastMat.emissiveIntensity = navBoost * 1.15;

    // Boom, Rudder, Helm Wheels, Propeller, Masthead Windex
    this.boomPivot.rotation.y = boomAngleRad;
    this.rudderPivot.rotation.y = rudderAngleRad;
    this.wheelPort.rotation.z = -rudderAngleRad * 2.8;
    this.wheelStbd.rotation.z = -rudderAngleRad * 2.8;
    this.windexPivot.rotation.y = -apparentWindRelRad;
    if (Math.abs(throttle) > 0.02) {
      this.propellerGroup.rotation.z += dt * throttle * 24.0;
    }

    // Step XPBD cloth deformation for Mainsail & Jib
    this.mainsailCloth.step(
      dt,
      time,
      boomAngleRad,
      sailArea,
      clothPressure,
      luffingFactor,
      turbulence,
    );
    this.jibCloth.step(
      dt,
      time,
      jibAngleRad,
      sailArea,
      clothPressure * 0.85,
      luffingFactor * 1.15,
      turbulence,
    );
  }

  public dispose(): void {
    this.mainsailCloth.dispose();
    this.jibCloth.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
