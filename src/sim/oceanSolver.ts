import { OceanConfig, WaveComponent } from './types';

export const GRAVITY = 9.81;

/**
 * Shared 8-component incommensurate multi-scale Gerstner wave spectrum used identically by:
 * 1. CPU OceanSolver (buoyancy, wave orbital velocity, normals, spray triggers)
 * 2. GPU Ocean ShaderMaterial (vertex displacement & analytic normal perturbation)
 * Wavelengths and angles use non-harmonic ratios to eliminate visual grid repetition.
 */
export const BASE_WAVE_COMPONENTS: readonly WaveComponent[] = [
  // Primary long Atlantic swell
  { amplitude: 0.39, wavelength: 58.3, steepness: 0.34, dirX: 0.848, dirZ: 0.530, speedScale: 1.0 },
  // Secondary cross-swell
  { amplitude: 0.25, wavelength: 37.1, steepness: 0.31, dirX: 0.374, dirZ: -0.927, speedScale: 1.03 },
  // Intermediate wind wave A
  { amplitude: 0.16, wavelength: 21.7, steepness: 0.32, dirX: 0.966, dirZ: -0.259, speedScale: 1.07 },
  // Intermediate wind wave B
  { amplitude: 0.105, wavelength: 13.9, steepness: 0.30, dirX: -0.485, dirZ: 0.875, speedScale: 1.11 },
  // Local quartering chop A
  { amplitude: 0.068, wavelength: 8.4, steepness: 0.27, dirX: -0.799, dirZ: -0.602, speedScale: 1.15 },
  // Local quartering chop B
  { amplitude: 0.044, wavelength: 5.3, steepness: 0.25, dirX: 0.225, dirZ: 0.974, speedScale: 1.19 },
  // Short surface wind ripple A
  { amplitude: 0.026, wavelength: 3.1, steepness: 0.21, dirX: 0.731, dirZ: -0.682, speedScale: 1.24 },
  // Short surface capillary ripple B
  { amplitude: 0.015, wavelength: 1.75, steepness: 0.18, dirX: -0.934, dirZ: 0.358, speedScale: 1.31 },
];

export interface WaveSample {
  height: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  velX: number;
  velY: number;
  velZ: number;
  foam: number;
}

export function createWaveSample(): WaveSample {
  return {
    height: 0,
    normalX: 0,
    normalY: 1,
    normalZ: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    foam: 0,
  };
}

/**
 * Evaluates multi-component Gerstner waves at world (x, z) and time t.
 * Mutates `out` in place to guarantee zero heap allocations inside physics loops.
 */
export function sampleOcean(
  x: number,
  z: number,
  time: number,
  config: OceanConfig,
  out: WaveSample,
): WaveSample {
  let dispY = 0;
  // Surface normal accumulation via Gerstner partial derivatives
  let binormalX = 1;
  let binormalY = 0;
  let binormalZ = 0;
  let tangentX = 0;
  let tangentY = 0;
  let tangentZ = 1;

  let velX = 0;
  let velY = 0;
  let velZ = 0;
  let crestAccum = 0;

  const wScale = Math.max(0.02, config.waveScale);
  const cScale = Math.max(0.1, config.chopScale);

  for (let i = 0; i < BASE_WAVE_COMPONENTS.length; i++) {
    const w = BASE_WAVE_COMPONENTS[i];
    // High-frequency components respond more to chopScale
    const localScale = i >= 3 ? wScale * cScale : wScale;
    const amp = w.amplitude * localScale;
    const k = (Math.PI * 2) / w.wavelength;
    const omega = Math.sqrt(GRAVITY * k) * w.speedScale;

    // Limit Gerstner steepness Q so waves never self-intersect (sum Q_i * k_i * A_i < 1)
    const maxSteep = 0.62 / (k * Math.max(amp, 0.001) * BASE_WAVE_COMPONENTS.length);
    const q = Math.min(w.steepness * (0.7 + 0.3 * cScale), maxSteep);

    const phase = k * (w.dirX * x + w.dirZ * z) - omega * time;
    const s = Math.sin(phase);
    const c = Math.cos(phase);

    dispY += amp * s;

    // Orbital velocity of water particle: d/dt(Q*A*D*cos, A*sin)
    const qa = q * amp;
    velX += qa * w.dirX * omega * s;
    velY += amp * omega * c;
    velZ += qa * w.dirZ * omega * s;

    // Analytical Gerstner partial derivatives for exact normal
    const ka = k * amp;
    const qka = q * ka;

    // Tangent along Z, Binormal along X
    binormalX -= qka * w.dirX * w.dirX * s;
    binormalY += ka * w.dirX * c;
    binormalZ -= qka * w.dirX * w.dirZ * s;

    tangentX -= qka * w.dirX * w.dirZ * s;
    tangentY += ka * w.dirZ * c;
    tangentZ -= qka * w.dirZ * w.dirZ * s;

    // Crest foam proxy (peaks where sin(phase) > 0.55 and steepness is significant)
    if (s > 0.55) {
      crestAccum += (s - 0.55) * ka * 2.2;
    }
  }

  // Normal = normalize(tangent x binormal) -> points +Y for flat water
  const nx = tangentY * binormalZ - tangentZ * binormalY;
  const ny = tangentZ * binormalX - tangentX * binormalZ;
  const nz = tangentX * binormalY - tangentY * binormalX;
  const len = Math.hypot(nx, ny, nz) || 1;

  // Add ocean current velocity
  const curRad = (config.currentDirDeg * Math.PI) / 180;
  const curVelX = Math.sin(curRad) * config.currentSpeed;
  const curVelZ = -Math.cos(curRad) * config.currentSpeed;

  out.height = dispY;
  out.normalX = nx / len;
  out.normalY = ny / len;
  out.normalZ = nz / len;
  out.velX = velX + curVelX;
  out.velY = velY;
  out.velZ = velZ + curVelZ;
  out.foam = Math.min(1, crestAccum);

  return out;
}

/**
 * Helper returning current vector (m/s) in world XZ plane.
 */
export function getCurrentVector(
  config: OceanConfig,
  out: { x: number; z: number },
): void {
  const rad = (config.currentDirDeg * Math.PI) / 180;
  out.x = Math.sin(rad) * config.currentSpeed;
  out.z = -Math.cos(rad) * config.currentSpeed;
}
