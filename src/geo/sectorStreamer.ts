import * as THREE from 'three';
import { BAIXADA_SANTISTA_POLYGONS, GeoLandPolygon } from './baixadaSantistaData';
import { GeoWorldManager } from './geoWorldManager';

const SECTOR_SIZE_M = 1200;
const ACTIVE_RADIUS_SECTORS = 2;
const MAX_CACHED_SECTORS = 18;

interface CachedSectorRecord {
  key: string;
  sx: number;
  sz: number;
  source: 'osm' | 'regional-wgs84';
  buildings: Array<{ x: number; z: number; w: number; d: number; h: number }>;
  loadedAt: number;
}

interface ActiveSectorMesh {
  key: string;
  sx: number;
  sz: number;
  group: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

/**
 * Streams regional terrain landforms & optional OpenStreetMap Overpass urban/port
 * building footprints by 1.2km x 1.2km sectors with coastal rocky shorelines,
 * multi-peak Serra do Mar relief ridges, instanced Mata Atlântica trees, and
 * live configurable vegetation density.
 */
export class GeographicSectorStreamer {
  public readonly group = new THREE.Group();

  private readonly geoWorld: GeoWorldManager;
  private readonly landGroup = new THREE.Group();
  private readonly vegetationGroup = new THREE.Group();
  private readonly activeSectors = new Map<string, ActiveSectorMesh>();
  private readonly sectorCache = new Map<string, CachedSectorRecord>();
  private readonly loadingKeys = new Set<string>();

  private treeTrunksInst: THREE.InstancedMesh | null = null;
  private treeCrownsInst: THREE.InstancedMesh | null = null;
  private totalTreeInstances = 0;
  private vegetationDensity = 1.0;

  private lastCenterKey = '';
  private centerSx = 0;
  private centerSz = 0;
  private disposed = false;
  private onlineMapsEnabled = false;
  private requestEpoch = 0;
  private readonly pendingRequests = new Map<string, AbortController>();
  public currentDataSource = 'Base Vetorial Regional WGS84 (Baixada Santista)';

  private readonly sharedBuildingMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.78,
    metalness: 0.14,
  });

  private readonly baseLandGeos: THREE.BufferGeometry[] = [];
  private readonly baseLandMats: THREE.Material[] = [];

  constructor(geoWorld: GeoWorldManager, initialVegetationDensity = 1.0) {
    this.geoWorld = geoWorld;
    this.vegetationDensity = initialVegetationDensity;
    this.group.add(this.landGroup);
    this.landGroup.add(this.vegetationGroup);
    this.buildRegionalCoastlines();
    this.buildCoastalRocksAndVegetation();
  }

  public setVegetationDensity(density: number): void {
    this.vegetationDensity = THREE.MathUtils.clamp(density, 0, 1.5);
    if (this.treeTrunksInst && this.treeCrownsInst) {
      const visibleCount = Math.min(
        this.totalTreeInstances,
        Math.round(this.totalTreeInstances * Math.min(1, this.vegetationDensity / 1.5 + 0.0) * (this.vegetationDensity <= 0 ? 0 : Math.min(1, this.vegetationDensity))),
      );
      this.treeTrunksInst.count = visibleCount;
      this.treeCrownsInst.count = visibleCount;
      this.vegetationGroup.visible = visibleCount > 0;
    }
  }

  private buildRegionalCoastlines(): void {
    for (const poly of BAIXADA_SANTISTA_POLYGONS) {
      this.createLandMesh(poly);
    }
  }

  private createLandMesh(poly: GeoLandPolygon): void {
    const shape = new THREE.Shape();
    const localPts = poly.coordinates.map((c) => this.geoWorld.geoToLocal(c.lat, c.lon));
    if (localPts.length < 3) return;

    shape.moveTo(localPts[0].x, -localPts[0].z);
    for (let i = 1; i < localPts.length; i++) {
      shape.lineTo(localPts[i].x, -localPts[i].z);
    }
    shape.closePath();

    // Main coastal landmass
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: poly.elevationM + 2.2,
      bevelEnabled: true,
      bevelThickness: 0.45,
      bevelSize: 6.0,
      bevelSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -2.2, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: poly.colorHex,
      roughness: 0.88,
      metalness: 0.04,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.landGroup.add(mesh);
    this.baseLandGeos.push(geo);
    this.baseLandMats.push(mat);

    // Subtle sandy shoreline shelf slightly below top elevation
    const sandGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.4,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 13.5,
      bevelSegments: 1,
    });
    sandGeo.rotateX(-Math.PI / 2);
    sandGeo.translate(0, -1.25, 0);
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xc2ab84,
      roughness: 0.94,
      metalness: 0.01,
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.receiveShadow = true;
    this.landGroup.add(sandMesh);
    this.baseLandGeos.push(sandGeo);
    this.baseLandMats.push(sandMat);

    // Multi-peak Serra do Mar coastal hillside ridges inland
    if (poly.maxHillM > 25) {
      let cx = 0;
      let cz = 0;
      for (const p of localPts) {
        cx += p.x;
        cz += p.z;
      }
      cx /= localPts.length;
      cz /= localPts.length;

      const ridgeMat = new THREE.MeshStandardMaterial({
        color: 0x1a3328,
        roughness: 0.93,
        metalness: 0.02,
      });
      this.baseLandMats.push(ridgeMat);

      for (let peak = 0; peak < 3; peak++) {
        const scaleH = poly.maxHillM * (1.0 - peak * 0.22);
        const rad = Math.min(540, scaleH * 5.6);
        const hillGeo = new THREE.ConeGeometry(rad, scaleH, 9, 2);
        // Subtle organic ridge perturbation
        const posAttr = hillGeo.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < posAttr.count; v++) {
          const vx = posAttr.getX(v);
          const vy = posAttr.getY(v);
          const vz = posAttr.getZ(v);
          if (vy < scaleH * 0.45) {
            const warp = 1.0 + Math.sin(vx * 0.015 + vz * 0.02 + peak) * 0.16;
            posAttr.setX(v, vx * warp);
            posAttr.setZ(v, vz * warp);
          }
        }
        hillGeo.computeVertexNormals();

        const offAngle = peak * 2.1 + poly.id.length;
        const offDist = peak === 0 ? 0 : rad * 0.55;
        const hill = new THREE.Mesh(hillGeo, ridgeMat);
        hill.position.set(
          cx + Math.cos(offAngle) * offDist,
          scaleH * 0.43,
          cz + Math.sin(offAngle) * offDist,
        );
        hill.rotation.y = offAngle;
        this.landGroup.add(hill);
        this.baseLandGeos.push(hillGeo);
      }
    }
  }

  /**
   * Generates instanced Mata Atlântica coastal vegetation & rocky outcrops
   * strictly outside the playable harbor quay and open shipping channels.
   */
  private buildCoastalRocksAndVegetation(): void {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 4.0, 6);
    trunkGeo.translate(0, 2.0, 0);
    const crownGeo = new THREE.DodecahedronGeometry(2.3, 1);
    crownGeo.scale(1.15, 0.72, 1.15);
    crownGeo.translate(0, 4.4, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.94 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });

    const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
    rockGeo.scale(1.3, 0.65, 1.1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.92, metalness: 0.04 });

    this.baseLandGeos.push(trunkGeo, crownGeo, rockGeo);
    this.baseLandMats.push(trunkMat, crownMat, rockMat);

    const treeSpots: Array<[number, number, number]> = [];
    // Coastal Serra / Ponta da Praia / Guarujá slopes + Ilha das Palmas
    for (let i = 0; i < 160; i++) {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const frac = seed - Math.floor(seed);
      const frac2 = Math.abs(Math.sin(i * 78.233));

      let tx: number;
      let tz: number;
      let ty = 3.2;

      if (i < 70) {
        // Guarujá eastern hills
        tx = 640 + frac * 1100;
        tz = -1300 + frac2 * 1500;
        ty = 3.6 + frac * 8.0;
      } else if (i < 130) {
        // Santos inland hills / São Vicente hills
        tx = -1400 + frac * 1150;
        tz = -1450 + frac2 * 1150;
        ty = 3.4 + frac * 6.5;
      } else {
        // Ilha das Palmas rocky foliage (~ X: -260, Z: 1550)
        const ang = frac * Math.PI * 2;
        const rad = 25 + frac2 * 95;
        tx = -260 + Math.cos(ang) * rad;
        tz = 1550 + Math.sin(ang) * rad;
        ty = 4.2 + (1 - frac2) * 10.0;
      }
      treeSpots.push([tx, ty, tz]);
    }

    this.totalTreeInstances = treeSpots.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    treeSpots.forEach(([x, y, z], idx) => {
      const scale = 0.85 + ((idx * 17) % 30) * 0.01; // 0.85 .. 1.15
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, (idx * 1.3) % (Math.PI * 2), 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);
      crowns.setMatrixAt(idx, dummy.matrix);

      const g = 0.28 + ((idx * 13) % 16) * 0.01;
      tint.setRGB(g * 0.55, g + 0.06, g * 0.42);
      crowns.setColorAt(idx, tint);
    });
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();

    this.treeTrunksInst = trunks;
    this.treeCrownsInst = crowns;
    this.vegetationGroup.add(trunks, crowns);
    this.setVegetationDensity(this.vegetationDensity);

    // Coastal Granite Rocks around Laje Norte (-265, 525) & Ilha das Palmas edge
    const rockSpots: Array<[number, number, number, number]> = [
      [-265, 0.2, 525, 2.4],
      [-256, 0.1, 533, 1.8],
      [-273, 0.1, 518, 2.0],
      [-210, 0.2, 1465, 2.6],
      [-310, 0.2, 1610, 2.2],
      [445, 0.1, -60, 1.9],
      [455, 0.1, 40, 2.1],
    ];
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
    rockSpots.forEach(([rx, ry, rz, rs], idx) => {
      dummy.position.set(rx, ry, rz);
      dummy.rotation.set(idx * 0.4, idx * 1.1, idx * 0.3);
      dummy.scale.set(rs, rs, rs);
      dummy.updateMatrix();
      rocks.setMatrixAt(idx, dummy.matrix);
    });
    rocks.computeBoundingSphere();
    this.landGroup.add(rocks);
  }

  public update(playerX: number, playerZ: number): void {
    if (this.disposed) return;
    // Cache keys and record geometry are anchored globally, not to the moving render origin.
    const sx = Math.floor((playerX + this.geoWorld.floatingOffsetX) / SECTOR_SIZE_M);
    const sz = Math.floor((playerZ + this.geoWorld.floatingOffsetZ) / SECTOR_SIZE_M);
    this.centerSx = sx;
    this.centerSz = sz;
    const centerKey = `${sx},${sz}`;
    if (centerKey === this.lastCenterKey) return;
    this.lastCenterKey = centerKey;

    for (const [key, sec] of this.activeSectors.entries()) {
      if (
        Math.abs(sec.sx - sx) > ACTIVE_RADIUS_SECTORS + 1 ||
        Math.abs(sec.sz - sz) > ACTIVE_RADIUS_SECTORS + 1
      ) {
        this.group.remove(sec.group);
        for (const g of sec.geometries) g.dispose();
        for (const m of sec.materials) m.dispose();
        this.activeSectors.delete(key);
      }
    }

    if (this.sectorCache.size > MAX_CACHED_SECTORS) {
      const oldest = Array.from(this.sectorCache.values()).sort((a, b) => a.loadedAt - b.loadedAt);
      while (this.sectorCache.size > MAX_CACHED_SECTORS && oldest.length > 0) {
        const drop = oldest.shift();
        if (drop) this.sectorCache.delete(drop.key);
      }
    }

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nsx = sx + dx;
        const nsz = sz + dz;
        const key = `${nsx},${nsz}`;
        if (this.activeSectors.has(key) || this.loadingKeys.has(key)) continue;

        const cached = this.sectorCache.get(key);
        if (cached) {
          this.instantiateSector(cached);
        } else {
          void this.loadSectorAsync(nsx, nsz, key);
        }
      }
    }
  }

  private async loadSectorAsync(sx: number, sz: number, key: string): Promise<void> {
    if (this.disposed) return;
    const epoch = this.requestEpoch;
    this.loadingKeys.add(key);

    const minX = sx * SECTOR_SIZE_M;
    const maxX = minX + SECTOR_SIZE_M;
    const minZ = sz * SECTOR_SIZE_M;
    const maxZ = minZ + SECTOR_SIZE_M;

    const sw = this.geoWorld.localToGeo(minX - this.geoWorld.floatingOffsetX, maxZ - this.geoWorld.floatingOffsetZ);
    const ne = this.geoWorld.localToGeo(maxX - this.geoWorld.floatingOffsetX, minZ - this.geoWorld.floatingOffsetZ);

    let buildings: CachedSectorRecord['buildings'] = [];
    let source: CachedSectorRecord['source'] = 'regional-wgs84';

    if (this.onlineMapsEnabled && typeof navigator !== 'undefined' && navigator.onLine && typeof fetch !== 'undefined') {
      const controller = new AbortController();
      this.pendingRequests.set(key, controller);
      const timer = globalThis.setTimeout(() => controller.abort(), 3200);
      try {
        const query = `[out:json][timeout:3];way["building"](${sw.lat.toFixed(4)},${sw.lon.toFixed(4)},${ne.lat.toFixed(4)},${ne.lon.toFixed(4)});out center 60;`;
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });


        if (resp.ok) {
          const data = (await resp.json()) as {
            elements?: Array<{ center?: { lat: number; lon: number }; tags?: Record<string, string> }>;
          };
          if (this.disposed || epoch !== this.requestEpoch) return;
          if (Array.isArray(data.elements) && data.elements.length > 0) {
            source = 'osm';
            this.currentDataSource = 'OpenStreetMap (ODbL) + Base Regional WGS84';
            for (const el of data.elements.slice(0, 60)) {
              if (!el.center || !Number.isFinite(el.center.lat) || !Number.isFinite(el.center.lon) || Math.abs(el.center.lat)>90 || Math.abs(el.center.lon)>180) continue;
              const lp = this.geoWorld.geoToLocal(el.center.lat, el.center.lon);
              lp.x += this.geoWorld.floatingOffsetX;
              lp.z += this.geoWorld.floatingOffsetZ;
              if (lp.x > -140 && lp.x < 40 && lp.z > -110 && lp.z < 85) continue;
              const levels = parseFloat(el.tags?.['building:levels'] || '3') || 3;
              buildings.push({
                x: lp.x,
                z: lp.z,
                w: 16 + ((Math.abs(Math.round(lp.x)) % 14)),
                d: 16 + ((Math.abs(Math.round(lp.z)) % 14)),
                h: Math.min(48, Math.max(8, levels * 3.4)),
              });
            }
          }
        }
      } catch {
        // Regional data remains available without network access.
      } finally {
        globalThis.clearTimeout(timer);
        if (this.pendingRequests.get(key) === controller) this.pendingRequests.delete(key);
      }
    }

    if (this.disposed || epoch !== this.requestEpoch) return;
    if (buildings.length === 0) {
      buildings = this.generateProvisionalCoastalMassing(minX, maxX, minZ, maxZ);
    }

    const record: CachedSectorRecord = {
      key,
      sx,
      sz,
      source,
      buildings,
      loadedAt: Date.now(),
    };
    this.sectorCache.set(key, record);
    this.loadingKeys.delete(key);
    this.instantiateSector(record);
  }

  private generateProvisionalCoastalMassing(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): CachedSectorRecord['buildings'] {
    const list: CachedSectorRecord['buildings'] = [];
    for (let x = minX + 120; x < maxX; x += 210) {
      for (let z = minZ + 120; z < maxZ; z += 210) {
        if (x > -140 && x < 480 && z > -140 && z < 400) continue;
        const inSantosUrban = x >= -3400 && x <= -150 && z >= -2400 && z <= -120;
        const inGuarujaUrban = x >= 560 && x <= 2600 && z >= -1800 && z <= 400;
        if (!inSantosUrban && !inGuarujaUrban) continue;

        const seed = Math.abs(Math.sin(x * 0.017 + z * 0.023));
        list.push({
          x: x + (seed - 0.5) * 45,
          z: z + (Math.cos(x * 0.011) - 0.5) * 45,
          w: 22 + seed * 18,
          d: 20 + seed * 16,
          h: 12 + seed * 34,
        });
      }
    }
    return list;
  }

  private instantiateSector(record: CachedSectorRecord): void {
    if (this.disposed || this.activeSectors.has(record.key) ||
        Math.abs(record.sx - this.centerSx) > ACTIVE_RADIUS_SECTORS + 1 ||
        Math.abs(record.sz - this.centerSz) > ACTIVE_RADIUS_SECTORS + 1) return;
    const secGroup = new THREE.Group();
    secGroup.position.set(-this.geoWorld.floatingOffsetX, 0, -this.geoWorld.floatingOffsetZ);
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];

    if (record.buildings.length > 0) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      geos.push(boxGeo);
      const inst = new THREE.InstancedMesh(boxGeo, this.sharedBuildingMat, record.buildings.length);
      const dummy = new THREE.Object3D();
      const tint = new THREE.Color();

      record.buildings.forEach((b, i) => {
        dummy.position.set(b.x, 1.4 + b.h * 0.5, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        const shade = 0.55 + ((i * 19) % 30) / 100;
        tint.setRGB(shade * 0.85, shade * 0.92, shade);
        inst.setColorAt(i, tint);
      });
      inst.computeBoundingSphere();
      secGroup.add(inst);
    }

    this.group.add(secGroup);
    this.activeSectors.set(record.key, {
      key: record.key,
      sx: record.sx,
      sz: record.sz,
      group: secGroup,
      geometries: geos,
      materials: mats,
    });
  }

  /** Opt-in is deliberately session-only; callers must obtain separate map-service consent. */
  public setOnlineMapsEnabled(enabled: boolean): void {
    if (this.disposed || this.onlineMapsEnabled === enabled) return;
    this.onlineMapsEnabled = enabled;
    this.requestEpoch++;
    for (const controller of this.pendingRequests.values()) controller.abort();
    this.pendingRequests.clear();
    this.loadingKeys.clear();
    for (const sector of this.activeSectors.values()) {
      this.group.remove(sector.group);
      sector.geometries.forEach(g => g.dispose());
      sector.materials.forEach(m => m.dispose());
    }
    this.activeSectors.clear();
    this.sectorCache.clear();
    this.lastCenterKey = '';
    this.currentDataSource = 'Base Vetorial Regional WGS84 (Baixada Santista)';
  }

  public getLoadedSectorCount(): number {
    return this.activeSectors.size;
  }

  public shiftOrigin(dx: number, dz: number): void {
    this.landGroup.position.x -= dx;
    this.landGroup.position.z -= dz;
    for (const sec of this.activeSectors.values()) {
      sec.group.position.x -= dx;
      sec.group.position.z -= dz;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestEpoch++;
    for (const controller of this.pendingRequests.values()) controller.abort();
    this.pendingRequests.clear();
    this.loadingKeys.clear();
    for (const g of this.baseLandGeos) g.dispose();
    for (const m of this.baseLandMats) m.dispose();
    for (const sec of this.activeSectors.values()) {
      for (const g of sec.geometries) g.dispose();
      for (const m of sec.materials) m.dispose();
    }
    this.activeSectors.clear();
    this.sectorCache.clear();
    this.group.clear();
    this.sharedBuildingMat.dispose();
  }
}
