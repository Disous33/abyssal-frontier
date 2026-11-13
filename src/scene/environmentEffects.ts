import * as THREE from 'three';
import { PhysicsDebugVectors } from '../sim/navalPhysics';
import { createWaveSample, sampleOcean, WaveSample } from '../sim/oceanSolver';
import { OceanConfig, WeatherAtmosphereState } from '../sim/types';
import { ProceduralTextureSet } from './proceduralTextures';

interface SprayParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const MAX_SPRAY_PARTICLES = 280;
const RAIN_STREAK_COUNT = 420;

/**
 * Manages:
 * - Atmospheric Sky Dome with solar/lunar Mie scattering, starfield, & 2-layer dynamic clouds
 * - Physics-coupled Bow Spray, Lateral Splash & Stern Wake Foam Particles
 * - Wind-slanted Rain Streaks
 * - Buoyant Channel Navigation Buoys with night beacon glow
 * - Multi-layered Distant Archipelago Silhouettes
 * - F1 Physics Debug Overlay
 */
export class EnvironmentEffects {
  public readonly group = new THREE.Group();

  // Sky Dome
  private readonly skyMesh: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;

  // Bow Spray & Wake Foam Particles
  private readonly sprayPool: SprayParticle[] = [];
  private readonly sprayPositions = new Float32Array(MAX_SPRAY_PARTICLES * 3);
  private readonly sprayGeo: THREE.BufferGeometry;
  private readonly sprayMat: THREE.PointsMaterial;
  private readonly sprayPoints: THREE.Points;
  private sprayEmitCursor = 0;
  private particleDensity = 1.0;

  // Rain Streaks
  private readonly rainPositions = new Float32Array(RAIN_STREAK_COUNT * 6);
  private readonly rainGeo: THREE.BufferGeometry;
  private readonly rainMat: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;

  // Buoyant Sea Markers
  private readonly buoys: Array<{ group: THREE.Group; baseX: number; baseZ: number }> = [];
  private readonly buoyBeaconMat: THREE.MeshBasicMaterial;
  private readonly waveSample: WaveSample = createWaveSample();

  // Distant Procedural Archipelago
  private readonly islandsGroup = new THREE.Group();

  // Physics Debug Overlay (F1)
  private readonly debugGroup = new THREE.Group();
  private readonly buoyancyDebugMesh: THREE.InstancedMesh;
  private readonly aeroArrow: THREE.ArrowHelper;
  private readonly windArrow: THREE.ArrowHelper;
  private readonly keelArrow: THREE.ArrowHelper;
  private readonly dragArrow: THREE.ArrowHelper;

  private readonly _mat4 = new THREE.Matrix4();
  private readonly _color = new THREE.Color();
  private readonly _vec = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _quat = new THREE.Quaternion();

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(textures: ProceduralTextureSet) {
    // 1. Atmospheric Sky Dome with Dual-Layer Clouds, Sun/Moon Discs & Starfield
    const skyGeo = new THREE.SphereGeometry(2800, 40, 24);
    this.geometries.push(skyGeo);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uTopColor: { value: new THREE.Color(0x0c3454) },
        uHorizonColor: { value: new THREE.Color(0x7cb2cc) },
        uSunColor: { value: new THREE.Color(0xfff1d6) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
        uCloudCover: { value: 0.2 },
        uNightFactor: { value: 0.0 },
        uLightning: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uCloudCover;
        uniform float uNightFactor;
        uniform float uLightning;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float hash3(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = m * p * 2.05;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.52));

          // Mie forward-scattering horizon glow around Sun / Moon
          float sunDot = max(0.0, dot(d, uSunDir));
          float hazeGlow = pow(sunDot, 5.0) * 0.28 * (1.0 - uCloudCover * 0.7) * (1.0 - uNightFactor * 0.55);
          float coreHalo = pow(sunDot, 28.0) * 0.42 * (1.0 - uCloudCover * 0.78);
          float discThreshold = uNightFactor > 0.5 ? 0.9992 : 0.9986;
          float disc = smoothstep(discThreshold, discThreshold + 0.0008, sunDot) * (1.0 - uCloudCover * 0.85);
          col += uSunColor * (hazeGlow + coreHalo + disc * mix(2.4, 1.4, uNightFactor));

          // Subtle night starfield visible through clear gaps above horizon
          if (uNightFactor > 0.15 && d.y > 0.04) {
            vec3 starCell = floor(d * 240.0);
            float starRand = hash3(starCell);
            if (starRand > 0.9965) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + starRand * 100.0);
              float starVis = smoothstep(0.04, 0.28, d.y) * (1.0 - uCloudCover * 0.85) * uNightFactor;
              col += vec3(0.82, 0.9, 1.0) * twinkle * starVis * 0.85;
            }
          }

          // Dual-layer procedural clouds (high cirrus + sunlit maritime cumulus)
          if (d.y > 0.01) {
            vec2 baseUv = d.xz / (d.y + 0.16);
            vec2 cirrusUv = baseUv * 0.85 + vec2(uTime * 0.004, uTime * 0.002);
            float cirrus = fbm(cirrusUv * 1.9);
            float cirrusMask = smoothstep(0.54 - uCloudCover * 0.22, 0.86, cirrus) * 0.38;

            vec2 cumUv = baseUv * 1.45 + vec2(uTime * 0.009, uTime * 0.005);
            float cum = fbm(cumUv * 2.1);
            float cumMask = smoothstep(0.72 - uCloudCover * 0.48, 0.94 - uCloudCover * 0.22, cum);

            vec3 cloudBase = mix(uHorizonColor * 0.72, uTopColor * 0.85 + vec3(0.18), 0.45);
            vec3 cloudLit = mix(cloudBase, uSunColor * 0.9 + vec3(0.12), 0.55 * (1.0 - uNightFactor * 0.75) * (0.4 + 0.6 * pow(sunDot, 2.0)));
            // Storm underbelly darkening
            cloudLit = mix(cloudLit, cloudBase * 0.55, smoothstep(0.65, 0.98, uCloudCover) * 0.55);
            cloudLit += vec3(0.55, 0.68, 0.88) * uLightning * 0.6;

            float horizFade = smoothstep(0.01, 0.2, d.y);
            col = mix(col, mix(cloudLit, uSunColor, 0.15), cirrusMask * horizFade);
            col = mix(col, cloudLit, cumMask * horizFade * 0.92);
          }

          col += vec3(0.45, 0.60, 0.80) * uLightning * 0.5;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.materials.push(this.skyMat);
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.group.add(this.skyMesh);

    // 2. Pooled Bow Spray, Lateral Splash & Stern Wake Foam Particles
    for (let i = 0; i < MAX_SPRAY_PARTICLES; i++) {
      this.sprayPool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
      });
      this.sprayPositions[i * 3 + 1] = -50;
    }
    this.sprayGeo = new THREE.BufferGeometry();
    this.sprayGeo.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));
    this.sprayMat = new THREE.PointsMaterial({
      map: textures.foamSprite,
      color: 0xe6f6ff,
      size: 1.15,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(this.sprayGeo, this.sprayMat);
    this.sprayPoints.frustumCulled = false;
    this.group.add(this.sprayPoints);

    // 3. Rain Streaks
    this.rainGeo = new THREE.BufferGeometry();
    for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 65;
      const ry = Math.random() * 28;
      const rz = (Math.random() - 0.5) * 65;
      this.rainPositions[i * 6] = rx;
      this.rainPositions[i * 6 + 1] = ry;
      this.rainPositions[i * 6 + 2] = rz;
      this.rainPositions[i * 6 + 3] = rx - 0.35;
      this.rainPositions[i * 6 + 4] = ry - 1.4;
      this.rainPositions[i * 6 + 5] = rz + 0.2;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xcbe3f0,
      transparent: true,
      opacity: 0,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.group.add(this.rainLines);

    // 4. Buoyant Navigation Channel Buoys
    this.buoyBeaconMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.materials.push(this.buoyBeaconMat);
    this.buildNavigationBuoys();
    this.group.add(this.islandsGroup);
    this.buildArchipelagoHorizons();

    // 5. Physics Debug Visualizer (F1)
    const sphereGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.geometries.push(sphereGeo);
    this.materials.push(sphereMat);
    this.buoyancyDebugMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, 24);
    this.buoyancyDebugMesh.frustumCulled = false;

    this.aeroArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 2, 0xf59e0b, 0.5, 0.25);
    this.windArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 2, 0x38bdf8, 0.5, 0.25);
    this.keelArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2, 0x34d399, 0.5, 0.25);
    this.dragArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 2, 0xf87171, 0.5, 0.25);

    this.debugGroup.add(
      this.buoyancyDebugMesh,
      this.aeroArrow,
      this.windArrow,
      this.keelArrow,
      this.dragArrow,
    );
    this.debugGroup.visible = false;
    this.group.add(this.debugGroup);
  }

  public setParticleDensity(density: number): void {
    this.particleDensity = THREE.MathUtils.clamp(density, 0.15, 1.5);
  }

  private buildNavigationBuoys(): void {
    const floatGeo = new THREE.CylinderGeometry(0.68, 0.92, 0.78, 12);
    const towerGeo = new THREE.CylinderGeometry(0.14, 0.36, 1.55, 8);
    const guardGeo = new THREE.TorusGeometry(0.35, 0.035, 6, 12);
    guardGeo.rotateX(Math.PI / 2);
    const beaconGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.geometries.push(floatGeo, towerGeo, guardGeo, beaconGeo);

    const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42, metalness: 0.25 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.42, metalness: 0.25 });
    this.materials.push(redMat, greenMat);

    const coords: Array<[number, number, boolean]> = [
      [-28, -45, true],
      [28, -45, false],
      [-34, -125, true],
      [34, -125, false],
      [-45, -220, true],
      [45, -220, false],
    ];

    for (const [bx, bz, isPort] of coords) {
      const g = new THREE.Group();
      const mat = isPort ? redMat : greenMat;
      const body = new THREE.Mesh(floatGeo, mat);
      body.castShadow = true;
      const tower = new THREE.Mesh(towerGeo, mat);
      tower.position.y = 1.05;
      tower.castShadow = true;
      const guard = new THREE.Mesh(guardGeo, mat);
      guard.position.y = 1.68;
      const beacon = new THREE.Mesh(beaconGeo, this.buoyBeaconMat);
      beacon.position.y = 1.92;
      g.add(body, tower, guard, beacon);
      g.position.set(bx, 0, bz);
      this.group.add(g);
      this.buoys.push({ group: g, baseX: bx, baseZ: bz });
    }
  }

  private buildArchipelagoHorizons(): void {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1e312e,
      roughness: 0.9,
      metalness: 0.04,
    });
    this.geometries.push(rockGeo);
    this.materials.push(rockMat);

    const peaks: Array<[number, number, number, number]> = [
      [-520, -680, 92, 34],
      [-430, -710, 68, 25],
      [640, -740, 110, 42],
      [710, -700, 74, 28],
      [-760, 420, 88, 36],
      [680, 460, 78, 30],
    ];

    const inst = new THREE.InstancedMesh(rockGeo, rockMat, peaks.length);
    const dummy = new THREE.Object3D();
    peaks.forEach(([x, z, r, h], idx) => {
      dummy.position.set(x, h * 0.25 - 3, z);
      dummy.scale.set(r, h, r * 0.78);
      dummy.rotation.y = idx * 1.1;
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.computeBoundingSphere();
    this.islandsGroup.add(inst);
  }

  public update(
    dt: number,
    time: number,
    ocean: OceanConfig,
    atmosphere: WeatherAtmosphereState,
    boatPos: THREE.Vector3,
    boatForward: THREE.Vector3,
    boatSpeedMs: number,
    cameraPos: THREE.Vector3,
    debugVisible: boolean,
    debugVectors: PhysicsDebugVectors,
  ): void {
    this.skyMesh.position.copy(cameraPos);
    const elev = (atmosphere.sunElevationDeg * Math.PI) / 180;
    const azim = (atmosphere.sunAzimuthDeg * Math.PI) / 180;
    this.skyMat.uniforms.uTime.value = time;
    this.skyMat.uniforms.uTopColor.value.setHex(atmosphere.skyTopHex);
    this.skyMat.uniforms.uHorizonColor.value.setHex(atmosphere.skyHorizonHex);
    this.skyMat.uniforms.uSunColor.value.setHex(atmosphere.sunColorHex);
    this.skyMat.uniforms.uSunDir.value
      .set(
        Math.cos(elev) * Math.sin(azim),
        Math.sin(elev),
        Math.cos(elev) * Math.cos(azim),
      )
      .normalize();
    this.skyMat.uniforms.uCloudCover.value = atmosphere.cloudCover;
    this.skyMat.uniforms.uNightFactor.value = atmosphere.nightFactor;
    this.skyMat.uniforms.uLightning.value = atmosphere.lightningFlash;

    // Channel beacon flash cycle
    const beaconBlink = Math.sin(time * 2.4) > 0.25 ? 1 : 0.28;
    this.buoyBeaconMat.color.setHex(beaconBlink > 0.5 ? 0xfde047 : 0x78350f);

    // Update Buoyant Sea Buoys on Gerstner waves
    for (const b of this.buoys) {
      sampleOcean(b.baseX, b.baseZ, time, ocean, this.waveSample);
      b.group.position.set(b.baseX, this.waveSample.height + 0.05, b.baseZ);
      this._vec.set(this.waveSample.normalX, this.waveSample.normalY, this.waveSample.normalZ);
      this._quat.setFromUnitVectors(this._up, this._vec);
      b.group.quaternion.slerp(this._quat, 1 - Math.exp(-6 * dt));
    }

    // Physics-coupled Bow Spray, Lateral Splash & Storm Sea Spray
    const maxActive = Math.floor(MAX_SPRAY_PARTICLES * Math.min(1.0, this.particleDensity));
    if (boatSpeedMs > 1.25 || atmosphere.rainIntensity > 0.65) {
      const rightX = -boatForward.z;
      const rightZ = boatForward.x;

      if (boatSpeedMs > 1.25) {
        const rawEmit = Math.ceil(boatSpeedMs * 0.6 * this.particleDensity);
        const emitCount = Math.min(5, rawEmit);
        for (let e = 0; e < emitCount; e++) {
          const idx = this.sprayEmitCursor % Math.max(1, maxActive);
          this.sprayEmitCursor++;
          const p = this.sprayPool[idx];
          p.active = true;
          p.life = 0;
          p.maxLife = 0.55 + Math.random() * 0.55;
          const side = Math.random() < 0.5 ? -1 : 1;
          const isStern = Math.random() < 0.35;
          if (isStern) {
            // Turbulent stern wake bubbles
            p.x = boatPos.x - boatForward.x * 5.2 + rightX * side * (0.4 + Math.random() * 0.6);
            p.y = Math.max(0.02, boatPos.y + 0.05);
            p.z = boatPos.z - boatForward.z * 5.2 + rightZ * side * (0.4 + Math.random() * 0.6);
            p.vx = rightX * side * (0.6 + Math.random() * 0.9) - boatForward.x * 0.5;
            p.vy = 0.4 + Math.random() * 0.45;
            p.vz = rightZ * side * (0.6 + Math.random() * 0.9) - boatForward.z * 0.5;
          } else {
            // Bow cut spray plumes
            const bowAlong = 3.2 + Math.random() * 1.7;
            p.x = boatPos.x + boatForward.x * bowAlong + rightX * side * 0.55;
            p.y = Math.max(0.08, boatPos.y + 0.2);
            p.z = boatPos.z + boatForward.z * bowAlong + rightZ * side * 0.55;
            p.vx = rightX * side * (1.1 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.4;
            p.vy = 0.8 + boatSpeedMs * 0.26 + Math.random() * 1.0;
            p.vz = rightZ * side * (1.1 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.4;
          }
        }
      }

      // Storm wind sea-crest spindrift
      if (atmosphere.rainIntensity > 0.65 && Math.random() < this.particleDensity * 0.65) {
        const idx = this.sprayEmitCursor % Math.max(1, maxActive);
        this.sprayEmitCursor++;
        const p = this.sprayPool[idx];
        p.active = true;
        p.life = 0;
        p.maxLife = 0.85;
        p.x = boatPos.x + (Math.random() - 0.5) * 32;
        p.y = 0.45 + Math.random() * 0.7;
        p.z = boatPos.z + (Math.random() - 0.5) * 32;
        p.vx = (Math.random() - 0.5) * 5.0;
        p.vy = 0.7 + Math.random() * 0.8;
        p.vz = (Math.random() - 0.5) * 5.0;
      }
    }

    for (let i = 0; i < MAX_SPRAY_PARTICLES; i++) {
      const p = this.sprayPool[i];
      if (!p.active || i >= maxActive) {
        this.sprayPositions[i * 3 + 1] = -50;
        continue;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.sprayPositions[i * 3 + 1] = -50;
        continue;
      }
      p.vy -= 6.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.sprayPositions[i * 3] = p.x;
      this.sprayPositions[i * 3 + 1] = p.y;
      this.sprayPositions[i * 3 + 2] = p.z;
    }
    (this.sprayGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Rain streaks around boat/camera
    if (atmosphere.rainIntensity > 0.05) {
      this.rainLines.visible = true;
      this.rainMat.opacity = atmosphere.rainIntensity * 0.45;
      this.rainLines.position.set(cameraPos.x, 0, cameraPos.z);
      const fallSpeed = 25 + atmosphere.rainIntensity * 15;
      const activeStreaks = Math.floor(RAIN_STREAK_COUNT * Math.min(1, this.particleDensity));
      for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
        const idx = i * 6;
        if (i >= activeStreaks) {
          this.rainPositions[idx + 1] = -30;
          this.rainPositions[idx + 4] = -30;
          continue;
        }
        this.rainPositions[idx + 1] -= fallSpeed * dt;
        this.rainPositions[idx + 4] -= fallSpeed * dt;
        if (this.rainPositions[idx + 1] < -2) {
          const ny = 24 + Math.random() * 8;
          this.rainPositions[idx + 1] = ny;
          this.rainPositions[idx + 4] = ny - (1.2 + atmosphere.rainIntensity * 0.75);
        }
      }
      (this.rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    // Physics Debug Vectors (F1)
    this.debugGroup.visible = debugVisible;
    if (debugVisible) {
      const elems = debugVectors.buoyancyElements;
      for (let i = 0; i < Math.min(24, elems.length); i++) {
        const el = elems[i];
        const scale = 0.6 + el.submergedRatio * 0.8;
        this._mat4.makeScale(scale, scale, scale);
        this._mat4.setPosition(el.worldX, el.worldY, el.worldZ);
        this.buoyancyDebugMesh.setMatrixAt(i, this._mat4);
        this._color.setHex(el.submergedRatio > 0.05 ? 0x10b981 : 0x64748b);
        this.buoyancyDebugMesh.setColorAt(i, this._color);
      }
      this.buoyancyDebugMesh.instanceMatrix.needsUpdate = true;
      if (this.buoyancyDebugMesh.instanceColor) {
        this.buoyancyDebugMesh.instanceColor.needsUpdate = true;
      }

      const aeroLen = Math.min(12, debugVectors.aeroForce.length() / 400);
      if (aeroLen > 0.1) {
        this.aeroArrow.visible = true;
        this.aeroArrow.position.copy(debugVectors.aeroOrigin);
        this._vec.copy(debugVectors.aeroForce).normalize();
        this.aeroArrow.setDirection(this._vec);
        this.aeroArrow.setLength(aeroLen, 0.55, 0.25);
      } else {
        this.aeroArrow.visible = false;
      }

      const windLen = Math.min(10, debugVectors.apparentWind.length() * 0.5);
      this.windArrow.position.set(boatPos.x, boatPos.y + 13.5, boatPos.z);
      if (windLen > 0.1) {
        this.windArrow.visible = true;
        this._vec.copy(debugVectors.apparentWind).normalize();
        this.windArrow.setDirection(this._vec);
        this.windArrow.setLength(windLen, 0.5, 0.22);
      } else {
        this.windArrow.visible = false;
      }

      const keelLen = Math.min(9, debugVectors.keelLift.length() / 400);
      if (keelLen > 0.1) {
        this.keelArrow.visible = true;
        this.keelArrow.position.set(boatPos.x, boatPos.y + 0.5, boatPos.z);
        this._vec.copy(debugVectors.keelLift).normalize();
        this.keelArrow.setDirection(this._vec);
        this.keelArrow.setLength(keelLen, 0.45, 0.2);
      } else {
        this.keelArrow.visible = false;
      }

      const dragLen = Math.min(9, debugVectors.hydroDrag.length() / 500);
      if (dragLen > 0.1) {
        this.dragArrow.visible = true;
        this.dragArrow.position.set(boatPos.x, boatPos.y + 0.8, boatPos.z);
        this._vec.copy(debugVectors.hydroDrag).normalize();
        this.dragArrow.setDirection(this._vec);
        this.dragArrow.setLength(dragLen, 0.45, 0.2);
      } else {
        this.dragArrow.visible = false;
      }
    }
  }

  public dispose(): void {
    this.sprayGeo.dispose();
    this.sprayMat.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
