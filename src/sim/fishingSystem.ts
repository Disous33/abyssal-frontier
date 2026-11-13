import { getItemQuantity, hasEquipment } from './economySystem';
import { createWaveSample, sampleOcean, WaveSample } from './oceanSolver';
import {
  EconomyState,
  FishCatchRecord,
  FishingStage,
  FishingStateSnapshot,
  FishQuality,
  OceanConfig,
  WeatherPresetId,
} from './types';

export interface FishSpeciesProfile {
  id: string;
  name: string;
  minDepthM: number;
  maxDepthM: number;
  minWeightKg: number;
  maxWeightKg: number;
  baseValuePerKg: number;
  fightForce: number;       // 0.4..1.45 tension push
  staminaBase: number;      // seconds/energy to exhaust
  preferredBaits: string[];
  nightBonus: number;       // multiplier during nightFactor > 0.4
  calmAffinity: number;     // multiplier in calm/clear sea
  protectedInSanctuary: boolean;
}

/**
 * Six Brazilian coastal species with fictional gameplay parameters
 * (not intended as exact biological reference).
 */
export const FISH_SPECIES_PROFILES: FishSpeciesProfile[] = [
  {
    id: 'fish_tainha',
    name: 'Tainha Costeira',
    minDepthM: 1.5,
    maxDepthM: 18,
    minWeightKg: 1.1,
    maxWeightKg: 3.4,
    baseValuePerKg: 24,
    fightForce: 0.52,
    staminaBase: 65,
    preferredBaits: ['bait_shrimp'],
    nightBonus: 0.9,
    calmAffinity: 1.35,
    protectedInSanctuary: false,
  },
  {
    id: 'fish_corvina',
    name: 'Corvina Atlântica',
    minDepthM: 3.5,
    maxDepthM: 28,
    minWeightKg: 1.5,
    maxWeightKg: 4.5,
    baseValuePerKg: 28,
    fightForce: 0.65,
    staminaBase: 78,
    preferredBaits: ['bait_shrimp', 'bait_sardine'],
    nightBonus: 1.2,
    calmAffinity: 1.1,
    protectedInSanctuary: false,
  },
  {
    id: 'fish_pescada',
    name: 'Pescada-Branca',
    minDepthM: 5.0,
    maxDepthM: 36,
    minWeightKg: 1.8,
    maxWeightKg: 5.2,
    baseValuePerKg: 33,
    fightForce: 0.78,
    staminaBase: 88,
    preferredBaits: ['bait_sardine', 'bait_lure'],
    nightBonus: 1.35,
    calmAffinity: 1.0,
    protectedInSanctuary: false,
  },
  {
    id: 'fish_linguado',
    name: 'Linguado de Fundo',
    minDepthM: 3.0,
    maxDepthM: 22,
    minWeightKg: 1.4,
    maxWeightKg: 4.1,
    baseValuePerKg: 38,
    fightForce: 0.72,
    staminaBase: 82,
    preferredBaits: ['bait_shrimp', 'bait_sardine'],
    nightBonus: 1.15,
    calmAffinity: 1.25,
    protectedInSanctuary: false,
  },
  {
    id: 'fish_robalo',
    name: 'Robalo-Flecha',
    minDepthM: 2.5,
    maxDepthM: 26,
    minWeightKg: 2.4,
    maxWeightKg: 7.6,
    baseValuePerKg: 46,
    fightForce: 1.05,
    staminaBase: 110,
    preferredBaits: ['bait_lure', 'bait_shrimp'],
    nightBonus: 1.45,
    calmAffinity: 1.0,
    protectedInSanctuary: false,
  },
  {
    id: 'fish_garoupa',
    name: 'Garoupa-da-Pedra',
    minDepthM: 7.0,
    maxDepthM: 55,
    minWeightKg: 3.8,
    maxWeightKg: 11.4,
    baseValuePerKg: 54,
    fightForce: 1.28,
    staminaBase: 132,
    preferredBaits: ['bait_sardine', 'bait_lure'],
    nightBonus: 1.1,
    calmAffinity: 0.9,
    protectedInSanctuary: true,
  },
];

// Protected reef zone around Laje Norte where catching Garoupa is flagged non-commercial
const SANCTUARY_CENTER = { x: -210, z: 520, radiusM: 120 };

export function computeZoneDepthAt(x: number, z: number): number {
  // Approximates Santos estuary channel & open Atlantic shelf depth (meters)
  const distFromPort = Math.hypot(x + 20, z - 10);
  const channelFactor = Math.max(0, Math.min(1, (z + 40) / 700));
  const shelf = 3.2 + channelFactor * 26.0 + Math.min(18, distFromPort * 0.012);
  return Math.round(shelf * 10) / 10;
}

export function isPointInProtectedFishingZone(x: number, z: number): boolean {
  const distSanctuary = Math.hypot(x - SANCTUARY_CENTER.x, z - SANCTUARY_CENTER.z);
  return distSanctuary <= SANCTUARY_CENTER.radiusM;
}

export interface FishingEquipmentBonuses {
  hasRod: boolean;
  rodId: string;
  maxCastDistM: number;
  maxLineM: number;
  tensionTolerance: number;
  reelSpeed: number;
  biteWindowScale: number;
  valueScale: number;
  schoolAttraction: number;
}

export function computeFishingBonuses(
  economy: EconomyState,
  preferredRodId: string,
  fishingSkillLevel: number,
  isFishingBoat: boolean,
): FishingEquipmentBonuses {
  const hasProRod = hasEquipment(economy, 'equip_rod_pro');
  const hasBasicRod = hasEquipment(economy, 'equip_rod_basic');
  const hasRod = hasProRod || hasBasicRod;
  const rodId =
    preferredRodId === 'equip_rod_pro' && hasProRod
      ? 'equip_rod_pro'
      : hasBasicRod
        ? 'equip_rod_basic'
        : hasProRod
          ? 'equip_rod_pro'
          : 'none';

  const isPro = rodId === 'equip_rod_pro';
  const hasReel = hasEquipment(economy, 'equip_reel_pro');
  const hasLine = hasEquipment(economy, 'equip_line_fluoro');
  const hasHook = hasEquipment(economy, 'equip_hook_steel');
  const hasTackle = hasEquipment(economy, 'equip_tackle_box');
  const hasNet = hasEquipment(economy, 'equip_fishing_net');

  const skillBonus = 1 + (Math.max(1, fishingSkillLevel) - 1) * 0.05;
  const boatBonus = isFishingBoat ? 1.22 : 1.0;

  return {
    hasRod,
    rodId,
    maxCastDistM: isPro ? 38 : 22,
    maxLineM: isPro ? 58 : 38,
    tensionTolerance: (isPro ? 1.28 : 1.0) * (hasLine ? 1.25 : 1.0) * skillBonus,
    reelSpeed: (isPro ? 6.4 : 4.8) * (hasReel ? 1.35 : 1.0) * skillBonus,
    biteWindowScale: hasHook ? 1.35 : 1.0,
    valueScale: (hasTackle ? 1.2 : 1.0) * (isFishingBoat ? 1.1 : 1.0),
    schoolAttraction: (hasNet ? 1.3 : 1.0) * boatBonus * skillBonus,
  };
}

/**
 * Full gameplay state machine for coastal & vessel fishing:
 * equip rod -> select bait -> charge cast -> wait -> bite detection -> tensioned reeling -> catch/release.
 */
export class FishingSystem {
  public stage: FishingStage = 'idle';
  public equippedRodId = 'equip_rod_basic';
  public equippedBaitId = 'bait_shrimp';

  public castCharge = 0;
  private chargeDir = 1;
  private castTimer = 0;
  private castOrigin = { x: 0, y: 1.5, z: 0 };
  private castStartPos = { x: 0, y: 1.5, z: 0 };
  private castTargetPos = { x: 0, y: 0, z: 0 };

  public bobberX = 0;
  public bobberY = 0;
  public bobberZ = 0;
  public lineLengthM = 0;
  public maxLineM = 38;

  private waitTimerS = 0;
  public biteRemainingS = 0;
  public tensionPct = 0;
  private overTensionTimeS = 0;
  private slackLoseTimerS = 0;

  private hookedProfile: FishSpeciesProfile | null = null;
  public hookedWeightKg = 0;
  public fishDistanceM = 0;
  public fishStaminaPct = 100;
  public fishPullDirDeg = 0;
  private fishSurgeTimer = 0;
  private fishSurging = false;

  public inProtectedZone = false;
  public zoneDepthM = 8;
  public statusMessage = 'Selecione uma isca e segure Arremessar para lançar a linha.';

  public catches: FishCatchRecord[] = [];
  public totalCaught = 0;
  public totalSoldCr = 0;

  private catchSeq = 0;
  private readonly waveSample: WaveSample = createWaveSample();

  public syncEquipmentSelection(economy: EconomyState): void {
    const hasPro = hasEquipment(economy, 'equip_rod_pro');
    const hasBasic = hasEquipment(economy, 'equip_rod_basic');
    if (this.equippedRodId === 'equip_rod_pro' && !hasPro) {
      this.equippedRodId = hasBasic ? 'equip_rod_basic' : 'none';
    } else if (this.equippedRodId === 'equip_rod_basic' && !hasBasic) {
      this.equippedRodId = hasPro ? 'equip_rod_pro' : 'none';
    } else if (this.equippedRodId === 'none') {
      if (hasPro) this.equippedRodId = 'equip_rod_pro';
      else if (hasBasic) this.equippedRodId = 'equip_rod_basic';
    }

    const baitOrder = ['bait_lure', 'bait_sardine', 'bait_shrimp'];
    if (getItemQuantity(economy, this.equippedBaitId) <= 0) {
      const avail = baitOrder.find((b) => getItemQuantity(economy, b) > 0);
      this.equippedBaitId = avail ?? 'none';
    }
  }

  public selectRod(rodId: string): void {
    this.equippedRodId = rodId;
  }

  public selectBait(baitId: string): void {
    this.equippedBaitId = baitId;
  }

  public cancel(): void {
    this.stage = 'idle';
    this.castCharge = 0;
    this.tensionPct = 0;
    this.hookedProfile = null;
    this.biteRemainingS = 0;
    this.overTensionTimeS = 0;
    this.statusMessage = 'Linha recolhida. Pronto para novo arremesso.';
  }

  public startCharge(): void {
    if (this.stage === 'idle' || this.stage === 'caught' || this.stage === 'lost') {
      this.stage = 'charging';
      this.castCharge = 0.12;
      this.chargeDir = 1;
      this.tensionPct = 0;
      this.hookedProfile = null;
      this.statusMessage = 'Ajustando força do arremesso...';
    }
  }

  public releaseCast(
    originX: number,
    originY: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    time: number,
    ocean: OceanConfig,
    economy: EconomyState,
    fishingSkill: number,
    isFishingBoat: boolean,
    rareSchoolBonus = false,
  ): { castOk: boolean; consumedBaitId: string | null } {
    if (this.stage !== 'charging') {
      return { castOk: false, consumedBaitId: null };
    }
    const bonuses = computeFishingBonuses(economy, this.equippedRodId, fishingSkill, isFishingBoat);
    if (!bonuses.hasRod) {
      this.stage = 'idle';
      this.statusMessage = 'Adquira uma vara na Loja de Equipamentos do porto.';
      return { castOk: false, consumedBaitId: null };
    }

    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    const dist = 7 + this.castCharge * (bonuses.maxCastDistM - 7);

    this.castOrigin = { x: originX, y: originY, z: originZ };
    this.castStartPos = { x: originX, y: originY + 0.7, z: originZ };
    this.castTargetPos = {
      x: originX + nx * dist,
      y: 0,
      z: originZ + nz * dist,
    };
    this.bobberX = this.castStartPos.x;
    this.bobberY = this.castStartPos.y;
    this.bobberZ = this.castStartPos.z;
    this.lineLengthM = dist;
    this.maxLineM = bonuses.maxLineM;
    this.castTimer = 0;
    this.stage = 'casting';

    sampleOcean(this.castTargetPos.x, this.castTargetPos.z, time, ocean, this.waveSample);
    this.castTargetPos.y = this.waveSample.height;
    this.zoneDepthM = computeZoneDepthAt(this.castTargetPos.x, this.castTargetPos.z);
    this.inProtectedZone = isPointInProtectedFishingZone(this.castTargetPos.x, this.castTargetPos.z);

    // Bite wait time scales with bait, school attraction & rare school event
    const hasBait = this.equippedBaitId !== 'none' && getItemQuantity(economy, this.equippedBaitId) > 0;
    const baitSpeed = hasBait ? (this.equippedBaitId === 'bait_lure' ? 0.78 : 0.85) : 1.45;
    const rareFactor = rareSchoolBonus ? 0.55 : 1.0;
    this.waitTimerS =
      ((3.2 + Math.random() * 4.5) * baitSpeed * rareFactor) / bonuses.schoolAttraction;

    let consumedBaitId: string | null = null;
    if (hasBait && this.equippedBaitId !== 'bait_lure') {
      consumedBaitId = this.equippedBaitId;
    }

    this.statusMessage = this.inProtectedZone
      ? 'Zona de Reserva (Laje Norte): captura de Garoupa não gera lucro comercial.'
      : 'Linha na água. Aguardando sinal da boia...';

    return { castOk: true, consumedBaitId };
  }

  public hookOrActionPressed(
    economy: EconomyState,
    fishingSkill: number,
    isFishingBoat: boolean,
  ): boolean {
    if (this.stage === 'bite') {
      this.stage = 'reeling';
      this.tensionPct = 28;
      this.overTensionTimeS = 0;
      this.slackLoseTimerS = 0;
      this.fishDistanceM = Math.max(8, this.lineLengthM);
      this.fishStaminaPct = 100;
      this.fishSurgeTimer = 1.4;
      this.fishSurging = true;
      const bonuses = computeFishingBonuses(economy, this.equippedRodId, fishingSkill, isFishingBoat);
      this.maxLineM = bonuses.maxLineM;
      this.statusMessage = `Fisgado! ${this.hookedProfile?.name ?? 'Peixe'} — controle a tensão!`;
      return true;
    }
    return false;
  }

  public step(
    dt: number,
    time: number,
    originX: number,
    originY: number,
    originZ: number,
    ocean: OceanConfig,
    weather: WeatherPresetId,
    nightFactor: number,
    economy: EconomyState,
    fishingSkill: number,
    isFishingBoat: boolean,
    holdingCharge: boolean,
    holdingReel: boolean,
  ): {
    justCaught: FishCatchRecord | null;
    justLost: string | null;
    justBit: boolean;
  } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.castOrigin = { x: originX, y: originY, z: originZ };
    const bonuses = computeFishingBonuses(economy, this.equippedRodId, fishingSkill, isFishingBoat);
    this.maxLineM = bonuses.maxLineM;

    let justCaught: FishCatchRecord | null = null;
    let justLost: string | null = null;
    let justBit = false;

    if (this.stage === 'charging') {
      if (holdingCharge) {
        this.castCharge += this.chargeDir * safeDt * 1.15;
        if (this.castCharge >= 1) {
          this.castCharge = 1;
          this.chargeDir = -1;
        } else if (this.castCharge <= 0.12) {
          this.castCharge = 0.12;
          this.chargeDir = 1;
        }
      }
      return { justCaught, justLost, justBit };
    }

    if (this.stage === 'casting') {
      this.castTimer += safeDt;
      const u = Math.min(1, this.castTimer / 0.55);
      const arcY = Math.sin(u * Math.PI) * 3.2;
      this.bobberX = this.castStartPos.x + (this.castTargetPos.x - this.castStartPos.x) * u;
      this.bobberZ = this.castStartPos.z + (this.castTargetPos.z - this.castStartPos.z) * u;
      this.bobberY =
        this.castStartPos.y + (this.castTargetPos.y - this.castStartPos.y) * u + arcY;
      if (u >= 1) {
        this.stage = 'waiting';
      }
      return { justCaught, justLost, justBit };
    }

    if (this.stage === 'waiting') {
      sampleOcean(this.bobberX, this.bobberZ, time, ocean, this.waveSample);
      this.bobberY = this.waveSample.height - 0.04;
      this.lineLengthM = Math.hypot(this.bobberX - originX, this.bobberZ - originZ);

      // Slowly drift slightly with surface current
      const curRad = (ocean.currentDirDeg * Math.PI) / 180;
      this.bobberX += Math.sin(curRad) * ocean.currentSpeed * safeDt * 0.25;
      this.bobberZ -= Math.cos(curRad) * ocean.currentSpeed * safeDt * 0.25;

      this.waitTimerS -= safeDt;
      if (this.waitTimerS <= 0) {
        const picked = this.pickFishForConditions(weather, nightFactor);
        this.hookedProfile = picked.profile;
        this.hookedWeightKg = picked.weightKg;
        this.biteRemainingS = 2.6 * bonuses.biteWindowScale;
        this.stage = 'bite';
        this.statusMessage = 'FISGADA! Pressione Espaço / Recolher agora!';
        justBit = true;
      }
      return { justCaught, justLost, justBit };
    }

    if (this.stage === 'bite') {
      sampleOcean(this.bobberX, this.bobberZ, time, ocean, this.waveSample);
      this.bobberY = this.waveSample.height - 0.16 + Math.sin(time * 24) * 0.1;
      this.biteRemainingS -= safeDt;
      if (this.biteRemainingS <= 0) {
        this.stage = 'lost';
        this.hookedProfile = null;
        this.statusMessage = 'O peixe soltou a isca! Seja mais rápido na fisgada.';
        justLost = this.statusMessage;
      }
      return { justCaught, justLost, justBit };
    }

    if (this.stage === 'reeling' && this.hookedProfile) {
      const fish = this.hookedProfile;
      this.fishSurgeTimer -= safeDt;
      if (this.fishSurgeTimer <= 0) {
        this.fishSurging = !this.fishSurging;
        this.fishSurgeTimer = this.fishSurging ? 1.2 + Math.random() * 1.4 : 1.0 + Math.random() * 1.2;
        this.fishPullDirDeg = (Math.random() - 0.5) * 140;
      }

      const weightFactor = 0.72 + (this.hookedWeightKg / fish.maxWeightKg) * 0.55;
      const surgeMult = this.fishSurging ? 1.45 : 0.42;
      const fishPull = fish.fightForce * weightFactor * surgeMult;

      if (holdingReel) {
        const tensionGain = (34 * fishPull) / bonuses.tensionTolerance;
        this.tensionPct = Math.min(100, this.tensionPct + tensionGain * safeDt);
        const pullSpeed = bonuses.reelSpeed * (this.fishSurging ? 0.32 : 1.05) * (1 - this.tensionPct * 0.003);
        this.fishDistanceM = Math.max(0.8, this.fishDistanceM - pullSpeed * safeDt);
        this.fishStaminaPct = Math.max(0, this.fishStaminaPct - (22 / (fish.staminaBase / 70)) * safeDt);
      } else {
        this.tensionPct = Math.max(8, this.tensionPct - 28 * bonuses.tensionTolerance * safeDt);
        if (this.fishSurging) {
          this.fishDistanceM += fish.fightForce * 3.1 * safeDt;
        }
        this.fishStaminaPct = Math.max(0, this.fishStaminaPct - 5 * safeDt);
      }

      // Move bobber dynamically along vector from player + lateral fish darting
      const dx = this.bobberX - originX;
      const dz = this.bobberZ - originZ;
      const baseAngle = Math.atan2(dx, dz) + ((this.fishPullDirDeg * Math.PI) / 180) * 0.15 * safeDt;
      this.bobberX = originX + Math.sin(baseAngle) * this.fishDistanceM;
      this.bobberZ = originZ + Math.cos(baseAngle) * this.fishDistanceM;
      sampleOcean(this.bobberX, this.bobberZ, time, ocean, this.waveSample);
      this.bobberY = this.waveSample.height - (this.fishSurging ? 0.25 : 0.08);
      this.lineLengthM = this.fishDistanceM;

      // Tension break check
      if (this.tensionPct >= 98) {
        this.overTensionTimeS += safeDt;
        if (this.overTensionTimeS >= 1.25) {
          this.stage = 'lost';
          this.hookedProfile = null;
          this.tensionPct = 0;
          this.statusMessage = 'A linha rompeu por tensão excessiva! Solte o molinete nas corridas.';
          justLost = this.statusMessage;
          return { justCaught, justLost, justBit };
        }
      } else {
        this.overTensionTimeS = Math.max(0, this.overTensionTimeS - safeDt * 1.5);
      }

      if (this.fishDistanceM > this.maxLineM) {
        this.stage = 'lost';
        this.hookedProfile = null;
        this.tensionPct = 0;
        this.statusMessage = 'O peixe desenrolou toda a linha e escapou!';
        justLost = this.statusMessage;
        return { justCaught, justLost, justBit };
      }

      // Capture condition
      if (this.fishDistanceM <= 2.2 || (this.fishStaminaPct <= 0 && this.fishDistanceM <= 4.5)) {
        const quality = this.computeCatchQuality(fish, this.hookedWeightKg, bonuses.valueScale);
        const isProtected = fish.protectedInSanctuary && this.inProtectedZone;
        const rawVal = Math.round(
          this.hookedWeightKg * fish.baseValuePerKg * quality.mult * bonuses.valueScale,
        );
        const valueCr = isProtected ? 0 : rawVal;

        this.catchSeq++;
        const record: FishCatchRecord = {
          id: `catch_${this.catchSeq}_${Date.now()}`,
          speciesId: fish.id,
          speciesName: fish.name,
          weightKg: this.hookedWeightKg,
          quality: quality.label,
          valueCr,
          protectedSpecies: isProtected,
          caughtAt: Date.now(),
          sold: false,
        };
        this.catches.unshift(record);
        this.totalCaught++;
        this.stage = 'caught';
        this.tensionPct = 0;
        this.hookedProfile = null;
        this.statusMessage = isProtected
          ? `${record.speciesName} (${record.weightKg.toFixed(1)} kg) capturado em área protegida — devolva ao mar (0 CR).`
          : `Capturado: ${record.speciesName} · ${record.weightKg.toFixed(1)} kg (${record.quality}) · ~${record.valueCr} CR!`;
        justCaught = record;
      }
    }

    return { justCaught, justLost, justBit };
  }

  private pickFishForConditions(
    weather: WeatherPresetId,
    nightFactor: number,
  ): { profile: FishSpeciesProfile; weightKg: number } {
    const isCalm = weather === 'calm' || weather === 'clear';
    const weights = FISH_SPECIES_PROFILES.map((sp) => {
      const depthOk = this.zoneDepthM >= sp.minDepthM && this.zoneDepthM <= sp.maxDepthM;
      let score = depthOk ? 1.5 : 0.35;
      if (sp.preferredBaits.includes(this.equippedBaitId)) score *= 2.2;
      if (nightFactor > 0.45) score *= sp.nightBonus;
      if (isCalm) score *= sp.calmAffinity;
      return Math.max(0.1, score);
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = FISH_SPECIES_PROFILES[0];
    for (let i = 0; i < FISH_SPECIES_PROFILES.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosen = FISH_SPECIES_PROFILES[i];
        break;
      }
    }

    const baitWeightBoost = this.equippedBaitId === 'bait_lure' ? 0.22 : this.equippedBaitId === 'bait_sardine' ? 0.12 : 0;
    const t = Math.min(1, Math.pow(Math.random(), 1.15) + baitWeightBoost);
    const weightKg =
      Math.round((chosen.minWeightKg + (chosen.maxWeightKg - chosen.minWeightKg) * t) * 10) / 10;

    return { profile: chosen, weightKg };
  }

  private computeCatchQuality(
    fish: FishSpeciesProfile,
    weightKg: number,
    valueScale: number,
  ): { label: FishQuality; mult: number } {
    const ratio = (weightKg - fish.minWeightKg) / Math.max(0.1, fish.maxWeightKg - fish.minWeightKg);
    if (ratio > 0.86 || (ratio > 0.72 && valueScale > 1.1)) {
      return { label: 'Troféu', mult: 1.55 };
    }
    if (ratio > 0.58) return { label: 'Premiado', mult: 1.28 };
    if (ratio > 0.28) return { label: 'Fresco', mult: 1.05 };
    return { label: 'Comum', mult: 0.9 };
  }

  public getUnsoldCatches(): FishCatchRecord[] {
    return this.catches.filter((c) => !c.sold);
  }

  public sellAllCatches(): { soldCount: number; earnedCr: number; releasedProtected: number } {
    let soldCount = 0;
    let earnedCr = 0;
    let releasedProtected = 0;
    for (const c of this.catches) {
      if (c.sold) continue;
      c.sold = true;
      if (c.protectedSpecies) {
        releasedProtected++;
      } else {
        soldCount++;
        earnedCr += c.valueCr;
      }
    }
    this.totalSoldCr += earnedCr;
    return { soldCount, earnedCr, releasedProtected };
  }

  public getSnapshot(): FishingStateSnapshot {
    return {
      stage: this.stage,
      equippedRodId: this.equippedRodId,
      equippedBaitId: this.equippedBaitId,
      castCharge: this.castCharge,
      lineLengthM: Math.round(this.lineLengthM * 10) / 10,
      maxLineM: this.maxLineM,
      bobberX: this.bobberX,
      bobberY: this.bobberY,
      bobberZ: this.bobberZ,
      tensionPct: Math.round(this.tensionPct),
      biteRemainingS: Math.round(this.biteRemainingS * 10) / 10,
      hookedSpeciesName: this.hookedProfile?.name ?? null,
      hookedWeightKg: this.hookedWeightKg,
      fishDistanceM: Math.round(this.fishDistanceM * 10) / 10,
      fishStaminaPct: Math.round(this.fishStaminaPct),
      fishPullDirDeg: Math.round(this.fishPullDirDeg),
      inProtectedZone: this.inProtectedZone,
      zoneDepthM: this.zoneDepthM,
      statusMessage: this.statusMessage,
    };
  }

  public loadState(catches: FishCatchRecord[], totalCaught: number, totalSoldCr: number): void {
    this.catches = catches.map((c) => ({ ...c }));
    this.totalCaught = totalCaught;
    this.totalSoldCr = totalSoldCr;
  }
}
