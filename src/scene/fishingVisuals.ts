import * as THREE from 'three';
import { FishingStateSnapshot } from '../sim/types';

/**
 * Dynamic 3D Fishing Rod, Line, Bobber, Water Ripple & Hooked Fish Silhouette.
 */
export class FishingVisuals {
  public readonly group = new THREE.Group();
  public readonly rodGroup = new THREE.Group();

  private readonly rodBasePivot = new THREE.Group();
  private readonly rodMidPivot = new THREE.Group();
  private readonly rodTipNode = new THREE.Object3D();

  private readonly bobberGroup = new THREE.Group();
  private readonly rippleRing: THREE.Mesh;
  private readonly fishSilhouette: THREE.Mesh;

  private readonly lineGeo: THREE.BufferGeometry;
  private readonly linePositions: Float32Array;
  private readonly lineMesh: THREE.Line;

  private readonly rodTipWorld = new THREE.Vector3();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor() {
    this.group.visible = false;

    const corkMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 });
    const blankMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.55 });
    const reelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
    const proAccentMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.4 });
    const bobberTopMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const bobberBotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.28,
      metalness: 0.5,
      transparent: true,
      opacity: 0.82,
    });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.85 });

    this.materials.push(
      corkMat,
      blankMat,
      reelMat,
      proAccentMat,
      bobberTopMat,
      bobberBotMat,
      rippleMat,
      fishMat,
      lineMat,
    );

    // 1. Segmented Articulated Fishing Rod
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.45, 8);
    handleGeo.rotateX(Math.PI / 2);
    handleGeo.translate(0, 0, 0.22);
    const reelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.07, 10);
    reelGeo.rotateZ(Math.PI / 2);
    const lowerBlankGeo = new THREE.CylinderGeometry(0.014, 0.02, 1.05, 8);
    lowerBlankGeo.rotateX(Math.PI / 2);
    lowerBlankGeo.translate(0, 0, 0.52);
    const upperBlankGeo = new THREE.CylinderGeometry(0.007, 0.014, 1.05, 8);
    upperBlankGeo.rotateX(Math.PI / 2);
    upperBlankGeo.translate(0, 0, 0.52);
    this.geometries.push(handleGeo, reelGeo, lowerBlankGeo, upperBlankGeo);

    const handle = new THREE.Mesh(handleGeo, corkMat);
    const reel = new THREE.Mesh(reelGeo, reelMat);
    reel.position.set(0, -0.05, 0.38);

    this.rodBasePivot.position.set(0, 0, 0.45);
    const lowerBlank = new THREE.Mesh(lowerBlankGeo, blankMat);
    const accentRing = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), proAccentMat);
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.set(0, 0, 0.06);
    this.geometries.push(accentRing.geometry);

    this.rodMidPivot.position.set(0, 0, 1.04);
    const upperBlank = new THREE.Mesh(upperBlankGeo, blankMat);
    this.rodTipNode.position.set(0, 0, 1.05);

    this.rodMidPivot.add(upperBlank, this.rodTipNode);
    this.rodBasePivot.add(lowerBlank, accentRing, this.rodMidPivot);
    this.rodGroup.add(handle, reel, this.rodBasePivot);
    this.group.add(this.rodGroup);

    // 2. Dynamic Fishing Line (10-point catenary from tip to bobber)
    this.linePositions = new Float32Array(10 * 3);
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.geometries.push(this.lineGeo);
    this.lineMesh = new THREE.Line(this.lineGeo, lineMat);
    this.lineMesh.frustumCulled = false;
    this.group.add(this.lineMesh);

    // 3. Bobber + Bite Ripple Ring + Hooked Fish Silhouette
    const bobTopGeo = new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bobBotGeo = new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const rippleGeo = new THREE.RingGeometry(0.18, 0.32, 18);
    rippleGeo.rotateX(-Math.PI / 2);
    const fishGeo = new THREE.ConeGeometry(0.18, 0.85, 6);
    fishGeo.rotateX(Math.PI / 2);
    this.geometries.push(bobTopGeo, bobBotGeo, rippleGeo, fishGeo);

    this.bobberGroup.add(new THREE.Mesh(bobTopGeo, bobberTopMat), new THREE.Mesh(bobBotGeo, bobberBotMat));
    this.rippleRing = new THREE.Mesh(rippleGeo, rippleMat);
    this.rippleRing.position.y = 0.04;
    this.bobberGroup.add(this.rippleRing);

    this.fishSilhouette = new THREE.Mesh(fishGeo, fishMat);
    this.fishSilhouette.position.set(0, -0.35, 0);
    this.bobberGroup.add(this.fishSilhouette);
    this.group.add(this.bobberGroup);
  }

  public update(
    active: boolean,
    time: number,
    charPos: THREE.Vector3,
    charHeadingRad: number,
    snap: FishingStateSnapshot,
  ): void {
    this.group.visible = active;
    if (!active) return;

    // Anchor rod in Kael's right hand extending forward
    const sinH = Math.sin(charHeadingRad);
    const cosH = Math.cos(charHeadingRad);
    const handX = charPos.x + cosH * 0.28 + sinH * 0.25;
    const handY = charPos.y + 1.08;
    const handZ = charPos.z - sinH * 0.28 + cosH * 0.25;

    this.rodGroup.position.set(handX, handY, handZ);
    this.rodGroup.rotation.y = charHeadingRad;

    // Charge pullback or tension bend
    if (snap.stage === 'charging') {
      this.rodGroup.rotation.x = 0.2 + snap.castCharge * 0.65;
      this.rodBasePivot.rotation.x = 0;
      this.rodMidPivot.rotation.x = 0;
    } else if (snap.stage === 'reeling' || snap.stage === 'bite') {
      const tNorm = Math.min(1, snap.tensionPct / 100);
      this.rodGroup.rotation.x = -0.35 + tNorm * 0.22;
      this.rodBasePivot.rotation.x = 0.12 + tNorm * 0.35;
      this.rodMidPivot.rotation.x = 0.16 + tNorm * 0.55;
    } else {
      this.rodGroup.rotation.x = -0.45;
      this.rodBasePivot.rotation.x = 0.04;
      this.rodMidPivot.rotation.x = 0.06;
    }

    this.rodGroup.updateMatrixWorld(true);
    this.rodTipNode.getWorldPosition(this.rodTipWorld);

    const lineOut =
      snap.stage === 'casting' ||
      snap.stage === 'waiting' ||
      snap.stage === 'bite' ||
      snap.stage === 'reeling';

    this.lineMesh.visible = lineOut;
    this.bobberGroup.visible = lineOut;

    if (lineOut) {
      this.bobberGroup.position.set(snap.bobberX, snap.bobberY, snap.bobberZ);

      // Pulse ripple on bite / reeling
      const bitePulse = snap.stage === 'bite' ? 1.0 + ((time * 4) % 1) * 2.2 : 1.0 + Math.sin(time * 3) * 0.25;
      this.rippleRing.scale.set(bitePulse, 1, bitePulse);
      this.rippleRing.visible = snap.stage === 'waiting' || snap.stage === 'bite' || snap.stage === 'reeling';

      // Darting fish silhouette visible while fighting
      this.fishSilhouette.visible = snap.stage === 'reeling';
      if (snap.stage === 'reeling') {
        this.fishSilhouette.rotation.y = Math.sin(time * 12) * 0.45;
        this.fishSilhouette.position.x = Math.sin(time * 7) * 0.32;
      }

      // Update catenary curve vertices between rod tip & bobber
      const sag = snap.stage === 'reeling' ? Math.max(0.05, (1 - snap.tensionPct / 100) * 0.65) : 0.75;
      for (let i = 0; i < 10; i++) {
        const u = i / 9;
        const px = this.rodTipWorld.x + (snap.bobberX - this.rodTipWorld.x) * u;
        const pz = this.rodTipWorld.z + (snap.bobberZ - this.rodTipWorld.z) * u;
        const py =
          this.rodTipWorld.y +
          (snap.bobberY - this.rodTipWorld.y) * u -
          Math.sin(u * Math.PI) * sag;
        this.linePositions[i * 3] = px;
        this.linePositions[i * 3 + 1] = py;
        this.linePositions[i * 3 + 2] = pz;
      }
      this.lineGeo.attributes.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
