import { LightingPresetId, WeatherAtmosphereState, WeatherPresetId } from './types';

export interface WeatherPresetTarget {
  label: string;
  description: string;
  windKnots: number;
  gustIntensity: number;
  turbulence: number;
  waveScale: number;
  chopScale: number;
  cloudCover: number;
  rainIntensity: number;
  fogDensity: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunColorHex: number;
  skyTopHex: number;
  skyHorizonHex: number;
  waterDeepHex: number;
  waterShallowHex: number;
  exposure: number;
  ambientFactor: number;
  nightFactor: number;
}

export interface LightingPresetSpec {
  id: LightingPresetId;
  label: string;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunColorHex: number;
  skyTopHex: number;
  skyHorizonHex: number;
  waterDeepHex: number;
  waterShallowHex: number;
  cloudCoverOverride?: number;
  fogScale?: number;
  exposure: number;
  ambientFactor: number;
  nightFactor: number;
}

export const LIGHTING_PRESETS: Record<Exclude<LightingPresetId, 'auto'>, LightingPresetSpec> = {
  dawn: {
    id: 'dawn',
    label: 'Amanhecer',
    sunElevationDeg: 8.5,
    sunAzimuthDeg: 78,
    sunColorHex: 0xffb884,
    skyTopHex: 0x153154,
    skyHorizonHex: 0xd99672,
    waterDeepHex: 0x062538,
    waterShallowHex: 0x145e70,
    exposure: 1.12,
    ambientFactor: 0.88,
    nightFactor: 0.14,
  },
  noon: {
    id: 'noon',
    label: 'Meio-dia',
    sunElevationDeg: 58,
    sunAzimuthDeg: 145,
    sunColorHex: 0xfff8eb,
    skyTopHex: 0x0b4a80,
    skyHorizonHex: 0x8ec9e0,
    waterDeepHex: 0x042b3f,
    waterShallowHex: 0x117488,
    exposure: 1.05,
    ambientFactor: 1.05,
    nightFactor: 0.0,
  },
  sunset: {
    id: 'sunset',
    label: 'Pôr do sol',
    sunElevationDeg: 5.5,
    sunAzimuthDeg: 258,
    sunColorHex: 0xff8947,
    skyTopHex: 0x1a2647,
    skyHorizonHex: 0xde7a4b,
    waterDeepHex: 0x062033,
    waterShallowHex: 0x154d61,
    exposure: 1.14,
    ambientFactor: 0.82,
    nightFactor: 0.25,
  },
  clear_night: {
    id: 'clear_night',
    label: 'Noite Clara',
    sunElevationDeg: 26, // Moonlight angle for specular ocean shimmer
    sunAzimuthDeg: 205,
    sunColorHex: 0xa6caf0,
    skyTopHex: 0x040b18,
    skyHorizonHex: 0x132944,
    waterDeepHex: 0x020f1c,
    waterShallowHex: 0x09293d,
    cloudCoverOverride: 0.14,
    exposure: 1.24,
    ambientFactor: 0.56,
    nightFactor: 1.0,
  },
  overcast_night: {
    id: 'overcast_night',
    label: 'Noite Nublada',
    sunElevationDeg: 18,
    sunAzimuthDeg: 170,
    sunColorHex: 0x7692ad,
    skyTopHex: 0x050b14,
    skyHorizonHex: 0x172636,
    waterDeepHex: 0x030e17,
    waterShallowHex: 0x092433,
    cloudCoverOverride: 0.84,
    fogScale: 1.35,
    exposure: 1.22,
    ambientFactor: 0.54,
    nightFactor: 1.0,
  },
  storm: {
    id: 'storm',
    label: 'Tempestade',
    sunElevationDeg: 11,
    sunAzimuthDeg: 95,
    sunColorHex: 0x8ea4b8,
    skyTopHex: 0x0a131b,
    skyHorizonHex: 0x2c3c48,
    waterDeepHex: 0x03131b,
    waterShallowHex: 0x092e39,
    cloudCoverOverride: 0.96,
    fogScale: 1.6,
    exposure: 1.1,
    ambientFactor: 0.68,
    nightFactor: 0.42,
  },
};

export const WEATHER_PRESETS: Record<WeatherPresetId, WeatherPresetTarget> = {
  clear: {
    label: 'Céu Claro',
    description: 'Brisa firme de mar aberto, visibilidade ampla e ondas limpas.',
    windKnots: 14,
    gustIntensity: 0.25,
    turbulence: 0.15,
    waveScale: 0.9,
    chopScale: 0.85,
    cloudCover: 0.22,
    rainIntensity: 0.0,
    fogDensity: 0.0014,
    sunElevationDeg: 36,
    sunAzimuthDeg: 135,
    sunColorHex: 0xfff2db,
    skyTopHex: 0x0c385e,
    skyHorizonHex: 0x83b9d4,
    waterDeepHex: 0x04293b,
    waterShallowHex: 0x0f687c,
    exposure: 1.08,
    ambientFactor: 1.0,
    nightFactor: 0.0,
  },
  calm: {
    label: 'Mar Calmo',
    description: 'Ondulação branda e vento leve ideal para calibração.',
    windKnots: 7,
    gustIntensity: 0.1,
    turbulence: 0.08,
    waveScale: 0.35,
    chopScale: 0.4,
    cloudCover: 0.14,
    rainIntensity: 0.0,
    fogDensity: 0.0011,
    sunElevationDeg: 46,
    sunAzimuthDeg: 150,
    sunColorHex: 0xfff5e4,
    skyTopHex: 0x0e4670,
    skyHorizonHex: 0x99ccde,
    waterDeepHex: 0x063245,
    waterShallowHex: 0x15758c,
    exposure: 1.06,
    ambientFactor: 1.02,
    nightFactor: 0.0,
  },
  cloudy: {
    label: 'Nublado',
    description: 'Cobertura de nuvens estratificadas e luz difusa fria.',
    windKnots: 16,
    gustIntensity: 0.35,
    turbulence: 0.25,
    waveScale: 1.05,
    chopScale: 1.0,
    cloudCover: 0.74,
    rainIntensity: 0.0,
    fogDensity: 0.0028,
    sunElevationDeg: 24,
    sunAzimuthDeg: 120,
    sunColorHex: 0xdbe6f0,
    skyTopHex: 0x1c3142,
    skyHorizonHex: 0x6f8796,
    waterDeepHex: 0x05222e,
    waterShallowHex: 0x0f4d5e,
    exposure: 1.08,
    ambientFactor: 0.9,
    nightFactor: 0.08,
  },
  rain: {
    label: 'Chuva',
    description: 'Frente chuvosa com rajadas moderadas e mar picado.',
    windKnots: 20,
    gustIntensity: 0.52,
    turbulence: 0.42,
    waveScale: 1.25,
    chopScale: 1.3,
    cloudCover: 0.88,
    rainIntensity: 0.68,
    fogDensity: 0.0048,
    sunElevationDeg: 18,
    sunAzimuthDeg: 110,
    sunColorHex: 0xb7c9d9,
    skyTopHex: 0x142432,
    skyHorizonHex: 0x506776,
    waterDeepHex: 0x041a24,
    waterShallowHex: 0x0c3e4c,
    exposure: 1.1,
    ambientFactor: 0.78,
    nightFactor: 0.2,
  },
  fog: {
    label: 'Neblina',
    description: 'Nevoeiro marítimo denso reduzindo drasticamente o horizonte.',
    windKnots: 9,
    gustIntensity: 0.18,
    turbulence: 0.15,
    waveScale: 0.6,
    chopScale: 0.65,
    cloudCover: 0.66,
    rainIntensity: 0.0,
    fogDensity: 0.0125,
    sunElevationDeg: 20,
    sunAzimuthDeg: 140,
    sunColorHex: 0xe3eaef,
    skyTopHex: 0x3b505d,
    skyHorizonHex: 0x8ea1ab,
    waterDeepHex: 0x08232d,
    waterShallowHex: 0x154654,
    exposure: 1.04,
    ambientFactor: 0.88,
    nightFactor: 0.1,
  },
  rough: {
    label: 'Mar Agitado',
    description: 'Ondas longas elevadas, cristas com espuma e vento forte.',
    windKnots: 24,
    gustIntensity: 0.58,
    turbulence: 0.48,
    waveScale: 1.65,
    chopScale: 1.45,
    cloudCover: 0.64,
    rainIntensity: 0.14,
    fogDensity: 0.0034,
    sunElevationDeg: 22,
    sunAzimuthDeg: 118,
    sunColorHex: 0xffe4c2,
    skyTopHex: 0x112a3d,
    skyHorizonHex: 0x628091,
    waterDeepHex: 0x041d29,
    waterShallowHex: 0x0d4f61,
    exposure: 1.09,
    ambientFactor: 0.9,
    nightFactor: 0.1,
  },
  storm: {
    label: 'Tempestade',
    description: 'Vendaval severo, chuva intensa, relâmpagos e vagas pesadas.',
    windKnots: 34,
    gustIntensity: 0.85,
    turbulence: 0.78,
    waveScale: 2.15,
    chopScale: 1.8,
    cloudCover: 0.98,
    rainIntensity: 1.0,
    fogDensity: 0.0068,
    sunElevationDeg: 11,
    sunAzimuthDeg: 95,
    sunColorHex: 0x8fa7bd,
    skyTopHex: 0x0b141c,
    skyHorizonHex: 0x2c3c47,
    waterDeepHex: 0x03131b,
    waterShallowHex: 0x0a303b,
    exposure: 1.12,
    ambientFactor: 0.65,
    nightFactor: 0.45,
  },
};

function lerpHexColor(hexA: number, hexB: number, t: number): number {
  const ar = (hexA >> 16) & 0xff;
  const ag = (hexA >> 8) & 0xff;
  const ab = hexA & 0xff;
  const br = (hexB >> 16) & 0xff;
  const bg = (hexB >> 8) & 0xff;
  const bb = hexB & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | b;
}

export function createInitialAtmosphere(
  preset: WeatherPresetId = 'clear',
  lightingPreset: LightingPresetId = 'auto',
): WeatherAtmosphereState {
  const p = WEATHER_PRESETS[preset];
  const lp = lightingPreset !== 'auto' ? LIGHTING_PRESETS[lightingPreset] : null;
  return {
    preset,
    lightingPreset,
    cloudCover: lp?.cloudCoverOverride ?? p.cloudCover,
    rainIntensity: p.rainIntensity,
    fogDensity: p.fogDensity * (lp?.fogScale ?? 1),
    sunElevationDeg: lp?.sunElevationDeg ?? p.sunElevationDeg,
    sunAzimuthDeg: lp?.sunAzimuthDeg ?? p.sunAzimuthDeg,
    sunColorHex: lp?.sunColorHex ?? p.sunColorHex,
    skyTopHex: lp?.skyTopHex ?? p.skyTopHex,
    skyHorizonHex: lp?.skyHorizonHex ?? p.skyHorizonHex,
    waterDeepHex: lp?.waterDeepHex ?? p.waterDeepHex,
    waterShallowHex: lp?.waterShallowHex ?? p.waterShallowHex,
    exposure: lp?.exposure ?? p.exposure,
    ambientFactor: lp?.ambientFactor ?? p.ambientFactor,
    nightFactor: lp?.nightFactor ?? p.nightFactor,
    lightningFlash: 0,
  };
}

/**
 * Smoothly transitions current atmosphere state toward target weather & lighting presets.
 */
export function stepAtmosphere(
  state: WeatherAtmosphereState,
  targetPreset: WeatherPresetId,
  dt: number,
  lightingPreset: LightingPresetId = 'auto',
): void {
  state.preset = targetPreset;
  state.lightingPreset = lightingPreset;
  const target = WEATHER_PRESETS[targetPreset];
  const lp = lightingPreset !== 'auto' ? LIGHTING_PRESETS[lightingPreset] : null;
  const alpha = 1 - Math.exp(-1.25 * dt);

  const targetCloud = lp?.cloudCoverOverride !== undefined
    ? Math.max(lp.cloudCoverOverride, target.cloudCover * 0.65)
    : target.cloudCover;
  const targetFog = target.fogDensity * (lp?.fogScale ?? 1);
  const targetSunElev = lp?.sunElevationDeg ?? target.sunElevationDeg;
  const targetSunAzim = lp?.sunAzimuthDeg ?? target.sunAzimuthDeg;
  const targetSunColor = lp?.sunColorHex ?? target.sunColorHex;
  const targetSkyTop = lp?.skyTopHex ?? target.skyTopHex;
  const targetSkyHoriz = lp?.skyHorizonHex ?? target.skyHorizonHex;
  const targetWaterDeep = lp?.waterDeepHex ?? target.waterDeepHex;
  const targetWaterShallow = lp?.waterShallowHex ?? target.waterShallowHex;
  const targetExposure = lp?.exposure ?? target.exposure;
  const targetAmbient = lp?.ambientFactor ?? target.ambientFactor;
  const targetNight = lp?.nightFactor ?? target.nightFactor;

  state.cloudCover += (targetCloud - state.cloudCover) * alpha;
  state.rainIntensity += (target.rainIntensity - state.rainIntensity) * alpha;
  state.fogDensity += (targetFog - state.fogDensity) * alpha;
  state.sunElevationDeg += (targetSunElev - state.sunElevationDeg) * alpha;
  state.sunAzimuthDeg += (targetSunAzim - state.sunAzimuthDeg) * alpha;
  state.exposure += (targetExposure - state.exposure) * alpha;
  state.ambientFactor += (targetAmbient - state.ambientFactor) * alpha;
  state.nightFactor += (targetNight - state.nightFactor) * alpha;

  state.sunColorHex = lerpHexColor(state.sunColorHex, targetSunColor, alpha);
  state.skyTopHex = lerpHexColor(state.skyTopHex, targetSkyTop, alpha);
  state.skyHorizonHex = lerpHexColor(state.skyHorizonHex, targetSkyHoriz, alpha);
  state.waterDeepHex = lerpHexColor(state.waterDeepHex, targetWaterDeep, alpha);
  state.waterShallowHex = lerpHexColor(state.waterShallowHex, targetWaterShallow, alpha);

  // Decay lightning flash rapidly, occasional random strike in storm weather or storm lighting
  state.lightningFlash = Math.max(0, state.lightningFlash - dt * 4.2);
  const isStormActive = targetPreset === 'storm' || lightingPreset === 'storm';
  if (isStormActive && state.lightningFlash <= 0.01 && Math.random() < dt * 0.18) {
    state.lightningFlash = 0.85 + Math.random() * 0.15;
  }
}
