import * as THREE from 'three';
import { CameraMode } from '../sim/types';

/**
 * Multi-mode stabilized maritime & terrestrial camera controller:
 * - thirdperson: Smooth terrestrial over-shoulder follow cam for Kael Rivera
 * - topdown: Elevated tactical top-down angle immune to vessel roll/pitch jitter
 * - chase: Cinematic stern-quarter follow camera
 * - inspect: Close 360 orbital inspection around the Aster S-01
 * - cinematic: Sweeping low-angle maritime tracking shot around active vessel/character
 * - free: Detached world camera with Arrow/mouse pan & orbit
 * - underwater: Submerged wide-angle tracking camera
 */
export class MaritimeCameraController {
  public mode: CameraMode = 'thirdperson';

  private yaw = 1.57;        // radians around target (1.57 = looking East from behind Kael!)
  private pitch = 0.30;      // radians above horizon
  private distance = 6.2;    // meters from target

  private targetYaw = 1.57;
  private targetPitch = 0.30;
  private targetDistance = 6.2;

  private readonly smoothFocus = new THREE.Vector3(-24, 2.5, 9.5);
  private readonly freeOffset = new THREE.Vector3(0, 0, 0);
  private readonly desiredCamPos = new THREE.Vector3();

  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private currentFov = 48;

  public getYaw(): number {
    return this.yaw;
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'thirdperson') {
      this.targetPitch = 0.28;
      this.targetDistance = 6.2;
    } else if (mode === 'underwater') {
      this.targetPitch = 0.14;
      this.targetDistance = 5.4;
    } else if (mode === 'topdown') {
      this.targetPitch = 1.04;
      this.targetDistance = 38;
    } else if (mode === 'chase') {
      this.targetPitch = 0.24;
      this.targetDistance = 21;
    } else if (mode === 'inspect') {
      this.targetPitch = 0.38;
      this.targetDistance = 15;
    } else if (mode === 'cinematic') {
      this.targetPitch = 0.16;
      this.targetDistance = 25;
    } else if (mode === 'free') {
      this.targetPitch = 0.45;
      this.targetDistance = 28;
    }
  }

  public onPointerDown(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;
  }

  public onPointerMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;
    const dx = clientX - this.lastPointerX;
    const dy = clientY - this.lastPointerY;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;

    this.targetYaw -= dx * 0.0055;
    const minPitch = this.mode === 'topdown' ? 0.55 : this.mode === 'underwater' ? -0.65 : 0.06;
    const maxPitch = this.mode === 'thirdperson' || this.mode === 'underwater' ? 1.15 : 1.48;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.0045, minPitch, maxPitch);
  }

  public onPointerUp(): void {
    this.isDragging = false;
  }

  public onWheel(deltaY: number): void {
    const isCharCam = this.mode === 'thirdperson' || this.mode === 'underwater';
    const zoomStep = deltaY * (isCharCam ? 0.008 : 0.025);
    const minDist = isCharCam ? 2.6 : this.mode === 'inspect' ? 7 : 11;
    const maxDist = isCharCam ? 14 : 110;
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + zoomStep, minDist, maxDist);
  }

  public panFree(forwardInput: number, rightInput: number, dt: number): void {
    if (this.mode !== 'free') return;
    const speed = 26 * dt;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rgtX = Math.cos(this.yaw);
    const rgtZ = -Math.sin(this.yaw);
    this.freeOffset.x += (fwdX * forwardInput + rgtX * rightInput) * speed;
    this.freeOffset.z += (fwdZ * forwardInput + rgtZ * rightInput) * speed;
  }

  public resetFreeOffset(): void {
    this.freeOffset.set(0, 0, 0);
  }

  public update(
    camera: THREE.PerspectiveCamera,
    dt: number,
    time: number,
    boatPos: THREE.Vector3,
    boatHeadingRad: number,
    charPos: THREE.Vector3,
    isCharacterView: boolean,
    isTitleScreen: boolean,
    isUnderwater = false,
    speedKnots = 0,
    isSubmarineView = false,
  ): void {
    let targetFov = 48;

    if (isTitleScreen) {
      const titleYaw = 0.85 + Math.sin(time * 0.14) * 0.35;
      this.yaw = THREE.MathUtils.damp(this.yaw, titleYaw, 2.5, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, 0.32, 2.5, dt);
      this.distance = THREE.MathUtils.damp(this.distance, 30.0, 2.5, dt);

      this.smoothFocus.x = THREE.MathUtils.damp(this.smoothFocus.x, 4.0, 3.0, dt);
      this.smoothFocus.y = THREE.MathUtils.damp(this.smoothFocus.y, 2.0, 3.0, dt);
      this.smoothFocus.z = THREE.MathUtils.damp(this.smoothFocus.z, 10.0, 3.0, dt);
      targetFov = 44;
    } else if (this.mode === 'cinematic') {
      if (!this.isDragging) {
        const sweepYaw = (isCharacterView ? 0.45 : -boatHeadingRad + 0.65) + Math.sin(time * 0.16) * 0.85;
        const diff = ((sweepYaw - this.targetYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.targetYaw += diff * (1 - Math.exp(-1.4 * dt));
        this.targetPitch = 0.16 + Math.sin(time * 0.22) * 0.06;
      }
      this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 4.5, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 4.5, dt);
      this.distance = THREE.MathUtils.damp(this.distance, this.targetDistance, 4.5, dt);

      const anchor = isCharacterView ? charPos : boatPos;
      this.smoothFocus.x = THREE.MathUtils.damp(this.smoothFocus.x, anchor.x, 5.5, dt);
      this.smoothFocus.y = THREE.MathUtils.damp(this.smoothFocus.y, isCharacterView ? charPos.y + 1.3 : boatPos.y + 1.5, 4.0, dt);
      this.smoothFocus.z = THREE.MathUtils.damp(this.smoothFocus.z, anchor.z, 5.5, dt);
      targetFov = 42 + Math.min(8, speedKnots * 0.65);
    } else if (isCharacterView && (this.mode === 'thirdperson' || this.mode === 'underwater')) {
      this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 10.0, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 10.0, dt);
      this.distance = THREE.MathUtils.damp(this.distance, this.targetDistance, 10.0, dt);

      const eyeH = isUnderwater ? 0.6 : 1.42;
      this.smoothFocus.x = THREE.MathUtils.damp(this.smoothFocus.x, charPos.x, 12.0, dt);
      this.smoothFocus.y = THREE.MathUtils.damp(this.smoothFocus.y, charPos.y + eyeH, 10.0, dt);
      this.smoothFocus.z = THREE.MathUtils.damp(this.smoothFocus.z, charPos.z, 12.0, dt);
      targetFov = isUnderwater ? 56 : 48;
    } else {
      if ((this.mode === 'chase' || isSubmarineView) && !this.isDragging && this.mode !== 'free' && this.mode !== 'topdown') {
        const sternYaw = -boatHeadingRad;
        const diff = ((sternYaw - this.targetYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.targetYaw += diff * (1 - Math.exp(-1.6 * dt));
      }

      this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 8.0, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 8.0, dt);
      this.distance = THREE.MathUtils.damp(this.distance, this.targetDistance, 9.0, dt);

      const targetAnchor = isCharacterView ? charPos : boatPos;
      const focusX = targetAnchor.x + (this.mode === 'free' ? this.freeOffset.x : 0);
      const focusZ = targetAnchor.z + (this.mode === 'free' ? this.freeOffset.z : 0);
      const focusY = isSubmarineView
        ? boatPos.y + 0.35
        : this.mode === 'inspect'
          ? boatPos.y + 2.4
          : isCharacterView
            ? charPos.y + 1.2
            : 1.4;

      this.smoothFocus.x = THREE.MathUtils.damp(this.smoothFocus.x, focusX, 7.5, dt);
      this.smoothFocus.y = THREE.MathUtils.damp(this.smoothFocus.y, focusY, 4.0, dt);
      this.smoothFocus.z = THREE.MathUtils.damp(this.smoothFocus.z, focusZ, 7.5, dt);
      targetFov = isSubmarineView ? 54 : this.mode === 'chase' ? 48 + Math.min(7, speedKnots * 0.5) : 48;
    }

    if (Math.abs(targetFov - this.currentFov) > 0.02) {
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 4.0, dt);
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const offsetX = Math.sin(this.yaw) * cosP * this.distance;
    const offsetY = sinP * this.distance;
    const offsetZ = Math.cos(this.yaw) * cosP * this.distance;

    const minCamY = isSubmarineView
      ? -41.0
      : isUnderwater
        ? -26.5
        : isCharacterView && this.mode === 'thirdperson'
          ? Math.max(0.8, charPos.y + 0.5)
          : 1.45;

    this.desiredCamPos.set(
      this.smoothFocus.x + offsetX,
      Math.max(minCamY, this.smoothFocus.y + offsetY),
      this.smoothFocus.z + offsetZ,
    );

    camera.position.copy(this.desiredCamPos);
    camera.lookAt(this.smoothFocus);
  }
}
