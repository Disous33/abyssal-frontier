import * as THREE from 'three';
import { BASE_WAVE_COMPONENTS, GRAVITY } from '../sim/oceanSolver';
import { GraphicsProfile, OceanConfig, WeatherAtmosphereState } from '../sim/types';

const WAVE_COUNT = BASE_WAVE_COMPONENTS.length;

/**
 * Continuous Multi-Scale Gerstner Ocean Mesh + PBR-calibrated ShaderMaterial
 * matching OceanSolver wave math 1:1.
 * Includes:
 * - 8 incommensurate Gerstner swells/chops/ripples
 * - Domain-warped micro-ripple normal octaves & roughness variation
 * - Beer-Lambert coastal depth absorption & emerald subsurface scattering
 * - Physics-coupled bow collar, lateral wash & Kelvin V-wake (vanishes when stopped)
 * - Seamless horizon skirt shader synchronized with sky, sun/moon, lightning & fog
 */
export class OceanSurface {
  public readonly mesh: THREE.Mesh;
  public readonly skirtMesh: THREE.Mesh;
  private geometry: THREE.PlaneGeometry;
  private readonly skirtGeometry: THREE.RingGeometry;
  private readonly skirtMaterial: THREE.ShaderMaterial;
  private readonly material: THREE.ShaderMaterial;
  private currentSegs = 176;
  private readonly planeSize = 620;

  constructor(graphics: GraphicsProfile) {
    this.currentSegs = this.segsForProfile(graphics);
    this.geometry = new THREE.PlaneGeometry(
      this.planeSize,
      this.planeSize,
      this.currentSegs,
      this.currentSegs,
    );
    this.geometry.rotateX(-Math.PI / 2);

    const waveVecs = BASE_WAVE_COMPONENTS.map(
      (w) => new THREE.Vector4(w.dirX, w.dirZ, w.amplitude, w.wavelength),
    );
    const waveMeta = BASE_WAVE_COMPONENTS.map((w) => {
      const k = (Math.PI * 2) / w.wavelength;
      const omega = Math.sqrt(GRAVITY * k) * w.speedScale;
      return new THREE.Vector4(w.steepness, omega, k, 0);
    });

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uMeshOffset: { value: new THREE.Vector2(0, 0) },
        uWaveScale: { value: 0.9 },
        uChopScale: { value: 0.85 },
        uWaveVecs: { value: waveVecs },
        uWaveMeta: { value: waveMeta },
        uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
        uSunColor: { value: new THREE.Color(0xfff1d6) },
        uSkyTop: { value: new THREE.Color(0x0c3454) },
        uSkyHorizon: { value: new THREE.Color(0x7cb2cc) },
        uWaterDeep: { value: new THREE.Color(0x042636) },
        uWaterShallow: { value: new THREE.Color(0x10667a) },
        uFogColor: { value: new THREE.Color(0x7cb2cc) },
        uFogDensity: { value: 0.0014 },
        uBoatPos: { value: new THREE.Vector3(0, 0, 0) },
        uBoatForward: { value: new THREE.Vector2(0, -1) },
        uBoatSpeed: { value: 0 },
        uLightning: { value: 0 },
        uReflections: { value: 1.0 },
        uNightFactor: { value: 0.0 },
        uCloudCover: { value: 0.2 },
        uPortOffset: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uMeshOffset;
        uniform float uWaveScale;
        uniform float uChopScale;
        uniform vec4 uWaveVecs[${WAVE_COUNT}];
        uniform vec4 uWaveMeta[${WAVE_COUNT}];

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vCrestFoam;
        varying float vViewDist;
        varying float vEdgeFade;

        void main() {
          vec3 pos = position;
          float wx = pos.x + uMeshOffset.x;
          float wz = pos.z + uMeshOffset.y;

          // Smooth outer attenuation so Gerstner grid blends seamlessly into outer ocean skirt
          float distFromCenter = length(pos.xz);
          float edgeFade = 1.0 - smoothstep(215.0, 305.0, distFromCenter);
          vEdgeFade = edgeFade;

          float dispY = 0.0;
          vec3 tangent = vec3(0.0, 0.0, 1.0);
          vec3 binormal = vec3(1.0, 0.0, 0.0);
          float crest = 0.0;

          float wScale = max(0.02, uWaveScale) * edgeFade;
          float cScale = max(0.1, uChopScale);

          for (int i = 0; i < ${WAVE_COUNT}; i++) {
            vec4 wv = uWaveVecs[i];
            vec4 wm = uWaveMeta[i];

            float localScale = (i >= 3) ? (wScale * cScale) : wScale;
            float amp = wv.z * localScale;
            float k = wm.z;
            float omega = wm.y;

            float maxSteep = 0.62 / (k * max(amp, 0.001) * float(${WAVE_COUNT}));
            float q = min(wm.x * (0.7 + 0.3 * cScale), maxSteep);

            float phase = k * (wv.x * wx + wv.y * wz) - omega * uTime;
            float s = sin(phase);
            float c = cos(phase);

            dispY += amp * s;

            float ka = k * amp;
            float qka = q * ka;

            binormal.x -= qka * wv.x * wv.x * s;
            binormal.y += ka * wv.x * c;
            binormal.z -= qka * wv.x * wv.y * s;

            tangent.x -= qka * wv.x * wv.y * s;
            tangent.y += ka * wv.y * c;
            tangent.z -= qka * wv.y * wv.y * s;

            if (s > 0.52) {
              crest += (s - 0.52) * ka * 2.15;
            }
          }

          vec3 worldPos = vec3(wx, dispY, wz);
          vWorldPos = worldPos;
          vNormal = normalize(cross(tangent, binormal));
          vCrestFoam = clamp(crest, 0.0, 1.0);

          vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
          vViewDist = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uChopScale;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        uniform vec3 uWaterDeep;
        uniform vec3 uWaterShallow;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform vec3 uBoatPos;
        uniform vec2 uBoatForward;
        uniform float uBoatSpeed;
        uniform float uLightning;
        uniform float uReflections;
        uniform float uNightFactor;
        uniform float uCloudCover;
        uniform vec2 uPortOffset;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vCrestFoam;
        varying float vViewDist;
        varying float vEdgeFade;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 41.23);
          return fract(p.x * p.y);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
          for (int i = 0; i < 4; i++) {
            v += a * noise2D(p);
            p = rot * p * 2.09;
            a *= 0.5;
          }
          return v;
        }

        // Derivative micro-ripple perturbation without tiling periodicity
        vec2 capillaryGradient(vec2 xz, float t) {
          vec2 p1 = xz * 0.48 + vec2(t * 0.21, -t * 0.16);
          vec2 p2 = vec2(xz.x * 0.86 - xz.y * 0.50, xz.x * 0.50 + xz.y * 0.86) * 1.15 - vec2(t * 0.27, t * 0.22);
          vec2 p3 = xz * 2.65 + vec2(-t * 0.34, t * 0.29);
          float e = 0.09;
          float n1x = noise2D(p1 + vec2(e, 0.0)) - noise2D(p1 - vec2(e, 0.0));
          float n1z = noise2D(p1 + vec2(0.0, e)) - noise2D(p1 - vec2(0.0, e));
          float n2x = noise2D(p2 + vec2(e, 0.0)) - noise2D(p2 - vec2(e, 0.0));
          float n2z = noise2D(p2 + vec2(0.0, e)) - noise2D(p2 - vec2(0.0, e));
          float n3x = noise2D(p3 + vec2(e, 0.0)) - noise2D(p3 - vec2(e, 0.0));
          float n3z = noise2D(p3 + vec2(0.0, e)) - noise2D(p3 - vec2(0.0, e));
          return vec2(
            n1x * 0.55 + n2x * 0.32 + n3x * 0.18,
            n1z * 0.55 + n2z * 0.32 + n3z * 0.18
          );
        }

        void main() {
          vec3 viewVec = normalize(cameraPosition - vWorldPos);
          bool isUnder = cameraPosition.y < vWorldPos.y - 0.05;

          // Multi-scale micro-ripple normals fading smoothly with distance
          float detailFade = 1.0 - smoothstep(28.0, 210.0, vViewDist);
          float chopAmp = (0.14 + 0.08 * clamp(uChopScale, 0.2, 2.0)) * detailFade;
          vec2 grad = capillaryGradient(vWorldPos.xz, uTime);
          vec3 baseN = isUnder ? -vNormal : vNormal;
          vec3 N = normalize(baseN + vec3(grad.x, 0.0, grad.y) * chopAmp);

          // Roughness varies dynamically between calm troughs and choppy crests
          float patchNoise = noise2D(vWorldPos.xz * 0.045 + vec2(uTime * 0.03, -uTime * 0.02));
          float roughness = clamp(0.06 + vCrestFoam * 0.28 + patchNoise * 0.08 + uCloudCover * 0.07, 0.05, 0.55);

          // Schlick Fresnel (F0 = 0.02 for seawater IOR 1.333)
          float NdotV = max(0.001, dot(N, viewVec));
          float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

          // Coastal bathymetry / port shallow water absorption
          vec2 portLocal = vWorldPos.xz - uPortOffset;
          float nearQuay = 1.0 - smoothstep(0.0, 95.0, max(0.0, portLocal.x + 12.0));
          float shallowMix = clamp(nearQuay * 0.72 + (1.0 - NdotV * 0.65) * 0.14, 0.0, 0.85);

          // Subsurface scattering through backlit translucent crests
          float waveHeightNorm = clamp(vWorldPos.y * 0.55 + 0.38, 0.0, 1.0);
          float sssDot = pow(clamp(dot(viewVec, -uSunDir + N * 0.55), 0.0, 1.0), 3.2);
          float sss = sssDot * waveHeightNorm * (1.0 - uNightFactor * 0.78);

          vec3 absorbColor = mix(uWaterDeep, uWaterShallow, clamp(shallowMix * 0.75 + sss * 0.95, 0.0, 1.0));
          float sunDiffuse = max(0.0, dot(N, uSunDir));
          vec3 waterBody = absorbColor * (0.48 + 0.52 * sunDiffuse + 0.12 * uLightning);

          // Sky + Cloud + Sun reflection lobe
          vec3 reflDir = reflect(-viewVec, N);
          float skyPitch = clamp(reflDir.y * 0.8 + 0.18, 0.0, 1.0);
          vec3 skyRefl = mix(uSkyHorizon, uSkyTop, pow(skyPitch, 0.65));

          if (uReflections > 0.5 && !isUnder) {
            float reflCloud = fbm(reflDir.xz / max(0.18, reflDir.y + 0.22) * 1.4 + vec2(uTime * 0.01, 0.0));
            float cloudBand = smoothstep(0.58 - uCloudCover * 0.28, 0.88 - uCloudCover * 0.15, reflCloud);
            vec3 cloudReflCol = mix(uSkyHorizon * 0.92, uSunColor * 0.75 + uSkyHorizon * 0.4, 0.45 * (1.0 - uNightFactor));
            skyRefl = mix(skyRefl, cloudReflCol, cloudBand * uCloudCover * 0.55);
          }

          // Dual-lobe solar/lunar ocean specular shimmer
          vec3 halfVec = normalize(uSunDir + viewVec);
          float NdotH = max(0.0, dot(N, halfVec));
          float specPower = mix(340.0, 48.0, roughness);
          float crispSpec = pow(NdotH, specPower) * mix(2.2, 0.55, roughness) * (1.0 - uCloudCover * 0.65);
          float sheenSpec = pow(NdotH, 26.0) * 0.16 * (1.0 - uCloudCover * 0.55);

          float reflWeight = isUnder ? 0.35 : mix(0.32, 0.88, uReflections) * fresnel;
          vec3 color = mix(waterBody, skyRefl, reflWeight);
          color += uSunColor * (crispSpec + sheenSpec);

          // Dynamic Physics-Driven Vessel Bow Spray Collar, Lateral Wash & Kelvin V-Wake
          vec2 relBoat = vWorldPos.xz - uBoatPos.xz;
          vec2 fwd = normalize(uBoatForward);
          vec2 right = vec2(-fwd.y, fwd.x);
          float along = dot(relBoat, fwd);   // + bow, - stern
          float across = dot(relBoat, right);

          float movingFactor = smoothstep(0.28, 1.35, uBoatSpeed);
          float highSpeedFactor = smoothstep(1.2, 5.2, uBoatSpeed);

          // Stationary subtle waterline meniscus vs active bow wave foam
          float hullEllip = length(vec2(across * 1.38, (along + 0.15) * 0.36));
          float meniscus = smoothstep(2.15, 1.62, hullEllip) * 0.16;
          float bowDist = length(vec2(across * 1.65, (along - 4.7) * 0.85));
          float bowCollar = smoothstep(2.6, 0.9, bowDist) * (0.25 + 0.75 * highSpeedFactor) * movingFactor;

          float wakeFoam = meniscus + bowCollar;

          // Kelvin diverging V-wake (19.47 deg half angle) + propeller wash — ZERO when stationary
          if (movingFactor > 0.01 && along < 4.6 && along > -68.0) {
            float aftDist = max(0.0, 4.6 - along);
            float kelvinHalfW = 1.0 + aftDist * 0.32;
            float armDist = abs(abs(across) - kelvinHalfW * 0.82);
            float arm = smoothstep(1.1 + aftDist * 0.045, 0.1, armDist);
            float propWash = smoothstep(0.95 + aftDist * 0.06, 0.0, abs(across)) * 0.62;
            float fadeAft = smoothstep(68.0, 2.5, aftDist);
            float waveMod = 0.7 + 0.3 * sin(aftDist * 1.55 - uTime * (3.5 + uBoatSpeed * 0.9));
            wakeFoam += (arm * 0.85 + propWash) * fadeAft * (0.35 + 0.65 * highSpeedFactor) * movingFactor * waveMod;
          }

          // Domain-warped FBM foam breakup so crests and wake look organically aerated (no white stripes)
          vec2 foamUv = vWorldPos.xz * 0.46;
          vec2 warp = vec2(noise2D(foamUv * 0.5 + uTime * 0.06), noise2D(foamUv * 0.5 - uTime * 0.05));
          float foamCell = fbm(foamUv + warp * 1.6 + vec2(uTime * 0.09, -uTime * 0.07));
          float fineBubble = noise2D(vWorldPos.xz * 2.2 - vec2(uTime * 0.15));

          float crestMask = smoothstep(0.36, 0.88, vCrestFoam * (0.85 + 0.35 * uChopScale) + (foamCell - 0.5) * 0.42);
          float wakeMask = wakeFoam * smoothstep(0.24, 0.78, foamCell * 0.7 + fineBubble * 0.45);
          float totalFoam = clamp(max(crestMask * 0.76, wakeMask), 0.0, 0.92);

          vec3 foamLit = mix(uSkyHorizon * 0.45 + vec3(0.45), uSunColor * 0.45 + vec3(0.55), sunDiffuse * 0.65 + 0.35);
          foamLit = mix(foamLit, vec3(0.96, 0.99, 1.0), 0.4 * (1.0 - uNightFactor));
          foamLit += vec3(0.5, 0.65, 0.85) * uLightning * 0.45;
          color = mix(color, foamLit, totalFoam);

          // Lightning sky flash reflection
          color += vec3(0.45, 0.6, 0.78) * uLightning * 0.32;

          // Smooth outer edge blend toward ocean skirt
          float skirtMix = 1.0 - smoothstep(0.0, 0.18, vEdgeFade);
          vec3 horizonColor = mix(uWaterDeep, uSkyHorizon, 0.55);
          color = mix(color, horizonColor, skirtMix * 0.3);

          // Exponential squared fog matching Three.js FogExp2
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDist * vViewDist);
          vec3 fogTarget = uFogColor + vec3(0.22, 0.28, 0.36) * uLightning;
          color = mix(color, fogTarget, clamp(fogFactor, 0.0, 1.0));

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;

    // Outer ocean skirt covering Baixada Santista channels & distant Atlantic horizon (295m..5800m)
    this.skirtGeometry = new THREE.RingGeometry(295, 5800, 72, 2);
    this.skirtGeometry.rotateX(-Math.PI / 2);
    this.skirtMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
        uSunColor: { value: new THREE.Color(0xfff1d6) },
        uSkyTop: { value: new THREE.Color(0x0c3454) },
        uSkyHorizon: { value: new THREE.Color(0x7cb2cc) },
        uWaterDeep: { value: new THREE.Color(0x042636) },
        uFogColor: { value: new THREE.Color(0x7cb2cc) },
        uFogDensity: { value: 0.0014 },
        uLightning: { value: 0 },
        uCloudCover: { value: 0.2 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying float vViewDist;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vec4 mvPos = viewMatrix * wp;
          vViewDist = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        uniform vec3 uWaterDeep;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform float uLightning;
        uniform float uCloudCover;
        varying vec3 vWorldPos;
        varying float vViewDist;

        void main() {
          vec3 viewVec = normalize(cameraPosition - vWorldPos);
          vec3 N = vec3(0.0, 1.0, 0.0);
          float NdotV = max(0.001, dot(N, viewVec));
          float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 4.5);
          vec3 skyRefl = mix(uSkyHorizon, uSkyTop, 0.25);
          vec3 waterBody = uWaterDeep * (0.5 + 0.5 * max(0.0, uSunDir.y));
          vec3 color = mix(waterBody, skyRefl, fresnel * 0.85);
          vec3 halfVec = normalize(uSunDir + viewVec);
          float sheen = pow(max(0.0, dot(N, halfVec)), 36.0) * 0.22 * (1.0 - uCloudCover * 0.6);
          color += uSunColor * sheen + vec3(0.4, 0.55, 0.72) * uLightning * 0.25;
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDist * vViewDist);
          vec3 fogTarget = uFogColor + vec3(0.22, 0.28, 0.36) * uLightning;
          color = mix(color, fogTarget, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.skirtMesh = new THREE.Mesh(this.skirtGeometry, this.skirtMaterial);
    this.skirtMesh.position.y = -0.06;
  }

  private segsForProfile(profile: GraphicsProfile): number {
    switch (profile) {
      case 'low':
        return 88;
      case 'medium':
        return 132;
      case 'high':
        return 176;
      case 'ultra':
        return 224;
    }
  }

  public setGraphicsProfile(profile: GraphicsProfile, reflections = true): void {
    this.material.uniforms.uReflections.value = reflections ? 1.0 : 0.0;
    const targetSegs = this.segsForProfile(profile);
    if (targetSegs === this.currentSegs) return;
    this.currentSegs = targetSegs;
    this.geometry.dispose();
    this.geometry = new THREE.PlaneGeometry(
      this.planeSize,
      this.planeSize,
      this.currentSegs,
      this.currentSegs,
    );
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = this.geometry;
  }

  public update(
    time: number,
    ocean: OceanConfig,
    atmosphere: WeatherAtmosphereState,
    boatPos: THREE.Vector3,
    boatForward: THREE.Vector3,
    boatSpeedMs: number,
    anchorPos: THREE.Vector3 = boatPos,
    isUnderwater = false,
    portOffsetX = 0,
    portOffsetZ = 0,
  ): void {
    const snap = 4.0;
    const ox = Math.round(anchorPos.x / snap) * snap;
    const oz = Math.round(anchorPos.z / snap) * snap;

    this.mesh.position.set(ox, 0, oz);
    this.skirtMesh.position.set(ox, -0.06, oz);

    this.material.uniforms.uMeshOffset.value.set(ox, oz);
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWaveScale.value = ocean.waveScale;
    this.material.uniforms.uChopScale.value = ocean.chopScale;
    this.material.uniforms.uPortOffset.value.set(portOffsetX, portOffsetZ);

    const elev = (atmosphere.sunElevationDeg * Math.PI) / 180;
    const azim = (atmosphere.sunAzimuthDeg * Math.PI) / 180;
    const sunDir = this.material.uniforms.uSunDir.value as THREE.Vector3;
    sunDir
      .set(
        Math.cos(elev) * Math.sin(azim),
        Math.sin(elev),
        Math.cos(elev) * Math.cos(azim),
      )
      .normalize();

    this.material.uniforms.uSunColor.value.setHex(atmosphere.sunColorHex);
    this.material.uniforms.uSkyTop.value.setHex(atmosphere.skyTopHex);
    this.material.uniforms.uSkyHorizon.value.setHex(atmosphere.skyHorizonHex);
    this.material.uniforms.uWaterDeep.value.setHex(atmosphere.waterDeepHex);
    this.material.uniforms.uWaterShallow.value.setHex(atmosphere.waterShallowHex);
    this.material.uniforms.uNightFactor.value = atmosphere.nightFactor;
    this.material.uniforms.uCloudCover.value = atmosphere.cloudCover;

    if (isUnderwater) {
      this.material.uniforms.uFogColor.value.setHex(0x052d3e);
      this.material.uniforms.uFogDensity.value = 0.045;
    } else {
      this.material.uniforms.uFogColor.value.setHex(atmosphere.skyHorizonHex);
      this.material.uniforms.uFogDensity.value = atmosphere.fogDensity;
    }

    this.material.uniforms.uBoatPos.value.copy(boatPos);
    this.material.uniforms.uBoatForward.value.set(boatForward.x, boatForward.z);
    this.material.uniforms.uBoatSpeed.value = boatSpeedMs;
    this.material.uniforms.uLightning.value = atmosphere.lightningFlash;

    // Sync outer ocean skirt shader
    (this.skirtMaterial.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
    this.skirtMaterial.uniforms.uSunColor.value.setHex(atmosphere.sunColorHex);
    this.skirtMaterial.uniforms.uSkyTop.value.setHex(atmosphere.skyTopHex);
    this.skirtMaterial.uniforms.uSkyHorizon.value.setHex(atmosphere.skyHorizonHex);
    this.skirtMaterial.uniforms.uWaterDeep.value.setHex(atmosphere.waterDeepHex);
    this.skirtMaterial.uniforms.uFogColor.value.copy(this.material.uniforms.uFogColor.value);
    this.skirtMaterial.uniforms.uFogDensity.value = this.material.uniforms.uFogDensity.value;
    this.skirtMaterial.uniforms.uLightning.value = atmosphere.lightningFlash;
    this.skirtMaterial.uniforms.uCloudCover.value = atmosphere.cloudCover;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.skirtGeometry.dispose();
    this.skirtMaterial.dispose();
  }
}
