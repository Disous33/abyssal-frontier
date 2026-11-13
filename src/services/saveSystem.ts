import { createInitialSubsystems } from '../sim/damageSystem';
import { createInitialEconomyState, getMaxCargoKgForUpgrades, ITEM_CATALOG } from '../sim/economySystem';
import { createCampaignMissions } from '../sim/missionManager';
import { createInitialProgressionState } from '../sim/progressionSystem';
import {
  CampaignMission,
  ControlMode,
  EconomyState,
  FishCatchRecord,
  OwnedVesselInstance,
  ExtendedVesselUpgrades,
  PlayerProgressionState,
  SubsystemIntegrity,
} from '../sim/types';
import { createDefaultUpgrades, createStarterOwnedVessel, createOwnedVesselFromSpec, VESSEL_CATALOG } from '../sim/vesselCatalog';

export const SAVE_FORMAT_VERSION = 2;
const SAVE_STORAGE_KEY = 'abyssal-frontier-save-v1';

export interface AbyssalSaveFile {
  version: number;
  savedAt: number;
  chapterTitle: string;
  controlMode: ControlMode;
  playerPos: { x: number; y: number; z: number; headingRad: number };
  vesselPos: { x: number; z: number; headingDeg: number; moored: boolean };
  fuelPct: number;
  batteryPct: number;
  subsystems: SubsystemIntegrity;
  economy: EconomyState;
  missions: CampaignMission[];
  storyCluesFound: string[];
  collectedUnderwaterIds: string[];
  // v0.7 persisted state (optional for backward compat on v1 saves)
  fishingCatches?: FishCatchRecord[];
  fishingTotalCaught?: number;
  fishingTotalSoldCr?: number;
  activeVesselId?: string;
  ownedVessels?: OwnedVesselInstance[];
  progression?: PlayerProgressionState;
  submarineState?: { x: number; y: number; z: number; headingDeg: number; batteryPct: number; hullPct: number };
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function sanitizeOwnedVessel(raw: OwnedVesselInstance, index: number): OwnedVesselInstance | null {
  if (!raw || typeof raw.instanceId !== 'string' || !raw.instanceId || typeof raw.specId !== 'string') return null;
  const spec = VESSEL_CATALOG.find(entry => entry.id === raw.specId);
  if (!spec) return null;
  const defaults = createOwnedVesselFromSpec(spec, index);
  const upgrades = createDefaultUpgrades();
  for (const key of Object.keys(upgrades) as (keyof ExtendedVesselUpgrades)[]) {
    upgrades[key] = Math.round(clamp(raw.upgrades?.[key], key === 'weaponLevel' ? 0 : 1, key === 'weaponLevel' ? 2 : 3, upgrades[key]));
  }
  const condition = raw.condition;
  const subsystems = { ...defaults.condition.subsystems };
  for (const key of Object.keys(subsystems) as (keyof SubsystemIntegrity)[]) {
    subsystems[key] = clamp(condition?.subsystems?.[key], 0, 100, subsystems[key]);
  }
  return {
    instanceId: raw.instanceId.slice(0, 120), specId: spec.id,
    customName: typeof raw.customName === 'string' && raw.customName.trim() ? raw.customName.slice(0, 80) : defaults.customName,
    parkedPort: typeof raw.parkedPort === 'string' ? raw.parkedPort.slice(0, 80) : defaults.parkedPort,
    hullColorHex: Math.round(clamp(raw.hullColorHex, 0, 0xffffff, defaults.hullColorHex)),
    trimColorHex: Math.round(clamp(raw.trimColorHex, 0, 0xffffff, defaults.trimColorHex)),
    upgrades,
    condition: {
      subsystems, hullIntegrityPct: clamp(condition?.hullIntegrityPct, 0, 100, 100),
      fuelPct: clamp(condition?.fuelPct, 0, 100, 100), batteryPct: clamp(condition?.batteryPct, 0, 100, 100),
      moored: typeof condition?.moored === 'boolean' ? condition.moored : true,
    },
  };
}

function sanitizeCatch(raw: FishCatchRecord): FishCatchRecord | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.speciesId !== 'string' ||
      ITEM_CATALOG[raw.speciesId]?.kind !== 'fish' || !Number.isFinite(raw.weightKg) || raw.weightKg <= 0) return null;
  const qualities = ['Comum', 'Fresco', 'Premiado', 'Troféu'];
  const protectedSpecies = raw.protectedSpecies === true;
  return {
    id: raw.id.slice(0, 120), speciesId: raw.speciesId,
    speciesName: typeof raw.speciesName === 'string' ? raw.speciesName.slice(0, 100) : ITEM_CATALOG[raw.speciesId].name,
    weightKg: clamp(raw.weightKg, .01, 1000, .1),
    quality: qualities.includes(raw.quality) ? raw.quality : 'Comum',
    valueCr: protectedSpecies ? 0 : Math.round(clamp(raw.valueCr, 0, 1e6, 0)),
    protectedSpecies, caughtAt: clamp(raw.caughtAt, 0, Number.MAX_SAFE_INTEGER, 0), sold: raw.sold === true,
  };
}

/**
 * Validates and sanitizes loaded save data across v1/v2 versions so corrupted or legacy saves
 * never break physics, garage ownership, fishing records, or campaign progression.
 */
export function validateAndMigrateSave(raw: unknown): AbyssalSaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<AbyssalSaveFile>;
  if (!Number.isInteger(obj.version) || obj.version! < 1 || obj.version! > SAVE_FORMAT_VERSION) return null;

  const defEco = createInitialEconomyState();
  const defSub = createInitialSubsystems();
  const defMissions = createCampaignMissions();
  const defProg = createInitialProgressionState();

  const rawUpgrades = obj.economy?.upgrades;
  const upgrades = {
    engineLevel: Math.round(clamp(rawUpgrades?.engineLevel ?? 1, 1, 3, 1)),
    hullArmorLevel: Math.round(clamp(rawUpgrades?.hullArmorLevel ?? 1, 1, 3, 1)),
    sailRigLevel: Math.round(clamp(rawUpgrades?.sailRigLevel ?? 1, 1, 3, 1)),
    cargoHoldLevel: Math.round(clamp(rawUpgrades?.cargoHoldLevel ?? 1, 1, 3, 1)),
  };

  const economy: EconomyState = {
    credits: Math.round(clamp(obj.economy?.credits ?? defEco.credits, 0, 9999999, defEco.credits)),
    upgrades,
    maxCargoKg: getMaxCargoKgForUpgrades(upgrades),
    inventory: Array.isArray(obj.economy?.inventory)
      ? obj.economy.inventory.filter(
          (e) =>
            e &&
            typeof e.itemId === 'string' &&
            typeof e.quantity === 'number' && Number.isFinite(e.quantity) &&
            e.quantity >= 1 && e.quantity < 1000 &&
            Object.prototype.hasOwnProperty.call(ITEM_CATALOG, e.itemId),
        ).slice(0, 256).map(e => ({itemId: e.itemId, quantity: Math.floor(e.quantity)}))
      : defEco.inventory,
    equippedIds: Array.isArray(obj.economy?.equippedIds)
      ? obj.economy.equippedIds.filter((id) => typeof id === 'string' && ITEM_CATALOG[id]?.kind === 'equipment').slice(0,64)
      : [],
  };

  const subsystems: SubsystemIntegrity = {
    hullPct: clamp(obj.subsystems?.hullPct ?? 100, 10, 100, defSub.hullPct),
    enginePct: clamp(obj.subsystems?.enginePct ?? 100, 10, 100, defSub.enginePct),
    rudderPct: clamp(obj.subsystems?.rudderPct ?? 100, 18, 100, defSub.rudderPct),
    mastPct: clamp(obj.subsystems?.mastPct ?? 100, 22, 100, defSub.mastPct),
    sailsPct: clamp(obj.subsystems?.sailsPct ?? 100, 20, 100, defSub.sailsPct),
  };

  const savedMap = new Map<string, CampaignMission>();
  if (Array.isArray(obj.missions)) {
    for (const sm of obj.missions) {
      if (sm && typeof sm.id === 'string') savedMap.set(sm.id, sm);
    }
  }
  const missions = defMissions.map((base) => {
    const saved = savedMap.get(base.id);
    if (!saved) return base;
    return {
      ...base,
      status: ['available','accepted','in_progress','completed','failed','cancelled'].includes(saved.status) ? saved.status : base.status,
      objectiveText: typeof saved.objectiveText === 'string' ? saved.objectiveText : base.objectiveText,
      currentWaypointIndex: Math.round(
        clamp(saved.currentWaypointIndex ?? 0, 0, base.waypoints.length, 0),
      ),
      waypoints: base.waypoints.map((wp, idx) => ({
        ...wp,
        completed: Boolean(saved.waypoints?.[idx]?.completed),
      })),
      completedAt: typeof saved.completedAt === 'number' && Number.isFinite(saved.completedAt) ? saved.completedAt : null,
    };
  });

  const validMode: ControlMode =
    obj.controlMode === 'sailing' ||
    obj.controlMode === 'on_foot' ||
    obj.controlMode === 'swimming' ||
    obj.controlMode === 'diving' ||
    obj.controlMode === 'fishing' ||
    obj.controlMode === 'submarine'
      ? obj.controlMode
      : 'on_foot';

  // Sanitize v0.7 owned vessels & active vessel
  const starter = createStarterOwnedVessel();
  let ownedVessels: OwnedVesselInstance[] = [starter];
  if (Array.isArray(obj.ownedVessels) && obj.ownedVessels.length > 0) {
    const seen = new Set<string>();
    ownedVessels = obj.ownedVessels.slice(0, 64)
      .map(sanitizeOwnedVessel)
      .filter((v): v is OwnedVesselInstance => v !== null)
      .filter(v => { if(seen.has(v.instanceId)) return false; seen.add(v.instanceId); return true; });
    if (ownedVessels.length === 0) ownedVessels = [starter];
  }
  const activeVesselId =
    typeof obj.activeVesselId === 'string' &&
    ownedVessels.some((v) => v.instanceId === obj.activeVesselId)
      ? obj.activeVesselId
      : ownedVessels[0].instanceId;

  // Sanitize progression skills
  const progression: PlayerProgressionState = { ...defProg };
  if (obj.progression && typeof obj.progression === 'object') {
    (Object.keys(defProg) as Array<keyof PlayerProgressionState>).forEach((k) => {
      const entry = obj.progression?.[k];
      if (entry) {
        progression[k] = {
          level: Math.round(clamp(entry.level, 1, 10, 1)),
          xp: Math.round(clamp(entry.xp, 0, 1e7, 0)),
          nextLevelXp: Math.round(clamp(entry.nextLevelXp, 50, 1e7, 100)),
        };
      }
    });
  }

  const fishingCatches: FishCatchRecord[] = Array.isArray(obj.fishingCatches)
    ? obj.fishingCatches.slice(0, 120).map(sanitizeCatch).filter((c): c is FishCatchRecord => c !== null)
    : [];

  return {
    version: SAVE_FORMAT_VERSION,
    savedAt: clamp(obj.savedAt!, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    chapterTitle: 'Capítulo 1–2 · Vida Marinha, Submersíveis & Piratas',
    controlMode:
      validMode === 'diving' ? 'swimming' : validMode === 'fishing' ? 'sailing' :
        validMode === 'submarine' && !ownedVessels.some(v => v.specId === 'nereid_s1') ? 'sailing' : validMode,
    playerPos: {
      x: clamp(obj.playerPos?.x ?? -24.0, -5000, 5000, -24.0),
      y: clamp(obj.playerPos?.y ?? 1.48, -35, 25, 1.48),
      z: clamp(obj.playerPos?.z ?? 9.5, -5000, 5000, 9.5),
      headingRad: clamp(obj.playerPos?.headingRad ?? Math.PI * 0.5, -10, 10, Math.PI * 0.5),
    },
    vesselPos: {
      x: clamp(obj.vesselPos?.x ?? 16.5, -15000, 15000, 16.5),
      z: clamp(obj.vesselPos?.z ?? 12.0, -15000, 15000, 12.0),
      headingDeg: clamp(obj.vesselPos?.headingDeg ?? 172, -360, 360, 172),
      moored: typeof obj.vesselPos?.moored === 'boolean' ? obj.vesselPos.moored : true,
    },
    fuelPct: clamp(obj.fuelPct ?? 100, 0, 100, 100),
    batteryPct: clamp(obj.batteryPct ?? 98, 0, 100, 98),
    subsystems,
    economy,
    missions,
    storyCluesFound: Array.isArray(obj.storyCluesFound)
      ? obj.storyCluesFound.filter((c) => typeof c === 'string')
      : [],
    collectedUnderwaterIds: Array.isArray(obj.collectedUnderwaterIds)
      ? obj.collectedUnderwaterIds.filter((c) => typeof c === 'string')
      : [],
    fishingCatches,
    fishingTotalCaught: Math.round(clamp(obj.fishingTotalCaught!, 0, 1e7, fishingCatches.length)),
    fishingTotalSoldCr: Math.round(clamp(obj.fishingTotalSoldCr!, 0, 1e9, 0)),
    activeVesselId,
    ownedVessels,
    progression,
    submarineState: obj.submarineState && typeof obj.submarineState === 'object' ? {
      x: clamp(obj.submarineState.x, -15000, 15000, 7.5),
      y: clamp(obj.submarineState.y, -200, 5, -1.5),
      z: clamp(obj.submarineState.z, -15000, 15000, -19),
      headingDeg: clamp(obj.submarineState.headingDeg, -360, 360, 0),
      batteryPct: clamp(obj.submarineState.batteryPct, 0, 100, 98),
      hullPct: clamp(obj.submarineState.hullPct, 0, 100, 100),
    } : undefined,
  };
}

export function saveCampaignToLocal(save: AbyssalSaveFile): boolean {
  try {
    const payload = validateAndMigrateSave({ ...save, version: SAVE_FORMAT_VERSION, savedAt: Date.now() });
    if (!payload) return false;
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadCampaignFromLocal(): AbyssalSaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return validateAndMigrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearCampaignSave(): void {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
