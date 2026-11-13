import * as THREE from 'three';
import { ProjectileState } from '../sim/pirateAI';
import { createWaveSample, sampleOcean, WaveSample } from '../sim/oceanSolver';
import { OceanConfig, PirateVesselSnapshot } from '../sim/types';

/**
 * Renders fictitious pirate/smuggler/mercenary hostile ships and active cannon projectiles
 * in open-sea outer sectors, including speed-scaled wakes and battle fire effects.
 */
export class PirateRenderer {
  public readonly group = new THREE.Group();
  private readonly shipGroups = new Map<
    string,
    { root: THREE.Group; fireCone: THREE.Mesh; wake: THREE.Mesh; lantern: THREE.Mesh }
  >();
  private readonly projectilePool: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly waveSample: WaveSample = createWaveSample();

  private readonly projGeo: THREE.SphereGeometry;
  private readonly projPlayerMat: THREE.MeshBasicMaterial;
  private readonly projEnemyMat: THREE.MeshBasicMaterial;

  constructor() {
    this.projGeo = new THREE.SphereGeometry(0.28, 8, 8);
    this.projPlayerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.projEnemyMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    this.geometries.push(this.projGeo);
    this.materials.push(this.projPlayerMat, this.projEnemyMat);
  }

  private createPirateVesselGroup(p: PirateVesselSnapshot): {
    root: THREE.Group;
    fireCone: THREE.Mesh;
    wake: THREE.Mesh;
    lantern: THREE.Mesh;
  } {
    const root = new THREE.Group();
    const hullColor =
      p.faction === 'corsarios_barra'
        ? 0x2b1d19
        : p.faction === 'contrabandistas_nereus'
          ? 0x1e293b
          : 0x3f2323;
    const accentColor =
      p.faction === 'corsarios_barra'
        ? 0xb91c1c
        : p.faction === 'contrabandistas_nereus'
          ? 0x0e7490
          : 0xc2410c;

    const hullMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.58, metalness: 0.25 });
    const sailMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.6 });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.5,
    });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    this.materials.push(hullMat, sailMat, darkMat, lanternMat, fireMat, wakeMat);

    const hullGeo = new THREE.BoxGeometry(3.2, 1.35, 11.2);
    const bowGeo = new THREE.ConeGeometry(2.2, 3.6, 4);
    bowGeo.rotateY(Math.PI / 4);
    bowGeo.rotateX(-Math.PI / 2);
    const cabinGeo = new THREE.BoxGeometry(2.2, 1.3, 3.2);
    const mastGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.6, 8);
    const sailGeo = new THREE.PlaneGeometry(3.2, 5.2);
    const turretGeo = new THREE.CylinderGeometry(0.32, 0.4, 0.5, 8);
    const fireGeo = new THREE.ConeGeometry(0.85, 2.6, 7);
    const wakeGeo = new THREE.ConeGeometry(2.8, 12.0, 3);
    wakeGeo.rotateX(Math.PI / 2);
    const lanternGeo = new THREE.SphereGeometry(0.18, 8, 8);

    this.geometries.push(hullGeo, bowGeo, cabinGeo, mastGeo, sailGeo, turretGeo, fireGeo, wakeGeo, lanternGeo);

    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.45;
    hull.castShadow = true;
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, 0.52, -7.2);
    const cabin = new THREE.Mesh(cabinGeo, darkMat);
    cabin.position.set(0, 1.65, 2.2);
    const mast = new THREE.Mesh(mastGeo, darkMat);
    mast.position.set(0, 4.6, -0.6);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 5.1, -0.5);
    sail.rotation.y = 0.25;
    const turret = new THREE.Mesh(turretGeo, darkMat);
    turret.position.set(0, 1.3, -3.6);
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.set(0, 8.45, -0.6);

    const fireCone = new THREE.Mesh(fireGeo, fireMat);
    fireCone.position.set(0, 2.4, 0.4);
    fireCone.visible = false;

    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.position.set(0, 0.12, 11.2);
    wake.scale.y = 0.05;

    root.add(hull, bow, cabin, mast, sail, turret, lantern, fireCone, wake);
    this.group.add(root);
    return { root, fireCone, wake, lantern };
  }

  public update(
    time: number,
    ocean: OceanConfig,
    pirates: PirateVesselSnapshot[],
    projectiles: ProjectileState[],
  ): void {
    const activeIds = new Set<string>();

    for (const p of pirates) {
      activeIds.add(p.id);
      let entry = this.shipGroups.get(p.id);
      if (!entry) {
        entry = this.createPirateVesselGroup(p);
        this.shipGroups.set(p.id, entry);
      }
      entry.root.visible = true;
      sampleOcean(p.x, p.z, time, ocean, this.waveSample);
      entry.root.position.set(p.x, this.waveSample.height + 0.12, p.z);
      entry.root.rotation.set(
        -this.waveSample.normalZ * 0.45,
        (-p.headingDeg * Math.PI) / 180,
        this.waveSample.normalX * 0.45,
        'YXZ',
      );
      entry.wake.visible = p.speedKnots > 1.5;
      entry.wake.scale.z = Math.max(0.4, p.speedKnots / 10);
      entry.fireCone.visible = p.onFire;
      if (p.onFire) {
        const flick = 0.8 + Math.sin(time * 20) * 0.3;
        entry.fireCone.scale.set(flick, 0.85 + Math.cos(time * 16) * 0.35, flick);
      }
      entry.lantern.visible = true;
    }

    for (const [id, entry] of this.shipGroups.entries()) {
      if (!activeIds.has(id)) {
        entry.root.visible = false;
      }
    }

    // Ensure enough projectile meshes in pool
    while (this.projectilePool.length < projectiles.length) {
      const m = new THREE.Mesh(this.projGeo, this.projEnemyMat);
      this.projectilePool.push(m);
      this.group.add(m);
    }

    for (let i = 0; i < this.projectilePool.length; i++) {
      const m = this.projectilePool[i];
      if (i < projectiles.length) {
        const pr = projectiles[i];
        m.visible = true;
        m.position.set(pr.x, pr.y, pr.z);
        m.material = pr.fromPlayer ? this.projPlayerMat : this.projEnemyMat;
      } else {
        m.visible = false;
      }
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
