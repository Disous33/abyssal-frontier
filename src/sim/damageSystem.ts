import { SubsystemIntegrity, VesselUpgrades, WeatherPresetId } from './types';

export function createInitialSubsystems(): SubsystemIntegrity {
  return {
    hullPct: 100,
    enginePct: 100,
    rudderPct: 100,
    mastPct: 100,
    sailsPct: 100,
  };
}

export interface DamagePerformanceModifiers {
  engineThrustScale: number;
  rudderAuthorityScale: number;
  sailEfficiencyScale: number;
  dragPenaltyScale: number;
  maxSafeSailArea: number;
}

/**
 * Translates vessel subsystem integrity & upgrades into real physical modifiers
 * consumed by NavalPhysicsWorld so damage directly alters handling and speed.
 */
export function computeVesselModifiers(
  sub: SubsystemIntegrity,
  upgrades: VesselUpgrades,
): DamagePerformanceModifiers {
  const engineUpgradeBoost = 1 + (upgrades.engineLevel - 1) * 0.22;
  const sailUpgradeBoost = 1 + (upgrades.sailRigLevel - 1) * 0.14;

  const engineHealth = sub.enginePct < 15 ? 0.15 : 0.35 + (sub.enginePct / 100) * 0.65;
  const rudderHealth = 0.4 + (sub.rudderPct / 100) * 0.6;
  const sailHealth = 0.45 + (sub.sailsPct / 100) * 0.55;
  const dragPenalty = 1 + Math.max(0, (100 - sub.hullPct) / 100) * 0.45;
  const maxSafeSailArea = sub.mastPct < 55 ? 0.68 : 1.0;

  return {
    engineThrustScale: engineHealth * engineUpgradeBoost,
    rudderAuthorityScale: rudderHealth,
    sailEfficiencyScale: sailHealth * sailUpgradeBoost,
    dragPenaltyScale: dragPenalty,
    maxSafeSailArea,
  };
}

export function applyCollisionDamage(
  sub: SubsystemIntegrity,
  impactSpeedMs: number,
  hullArmorLevel: number,
): { next: SubsystemIntegrity; hullDelta: number; rudderDelta: number } {
  const armorMitigation = 1 - (hullArmorLevel - 1) * 0.22;
  const severity = Math.max(0, impactSpeedMs - 1.1) * 3.4 * armorMitigation;
  const hullDelta = Math.min(28, Math.round(severity * 10) / 10);
  const rudderDelta = Math.min(18, Math.round(severity * 0.55 * 10) / 10);
  return {
    next: {
      ...sub,
      hullPct: Math.max(10, sub.hullPct - hullDelta),
      rudderPct: Math.max(18, sub.rudderPct - rudderDelta),
    },
    hullDelta,
    rudderDelta,
  };
}

export function applyGroundingDamage(
  sub: SubsystemIntegrity,
  dt: number,
  speedMs: number,
  hullArmorLevel: number,
): SubsystemIntegrity {
  const armorMitigation = 1 - (hullArmorLevel - 1) * 0.22;
  const rate = (1.8 + speedMs * 1.4) * armorMitigation * dt;
  return {
    ...sub,
    hullPct: Math.max(12, sub.hullPct - rate),
    rudderPct: Math.max(20, sub.rudderPct - rate * 0.7),
  };
}

export function applyWeatherAndUsageWear(
  sub: SubsystemIntegrity,
  dt: number,
  weather: WeatherPresetId,
  sailArea: number,
  throttle: number,
  upgrades: VesselUpgrades,
): SubsystemIntegrity {
  const rigProtect = 1 - (upgrades.sailRigLevel - 1) * 0.2;
  const armorProtect = 1 - (upgrades.hullArmorLevel - 1) * 0.2;
  let hullLoss = 0;
  let mastLoss = 0;
  let sailLoss = 0;
  let engineLoss = 0;

  if ((weather === 'storm' || weather === 'rough') && sailArea > 0.78) {
    const stormScale = weather === 'storm' ? 1.0 : 0.45;
    sailLoss += 0.35 * stormScale * rigProtect * dt;
    mastLoss += 0.22 * stormScale * rigProtect * dt;
    hullLoss += 0.08 * stormScale * armorProtect * dt;
  }

  // Pushing engine hard while already degraded increases wear
  if (Math.abs(throttle) > 0.85 && sub.enginePct < 75) {
    engineLoss += 0.18 * dt;
  }

  if (hullLoss === 0 && mastLoss === 0 && sailLoss === 0 && engineLoss === 0) {
    return sub;
  }

  return {
    hullPct: Math.max(12, sub.hullPct - hullLoss),
    enginePct: Math.max(10, sub.enginePct - engineLoss),
    rudderPct: sub.rudderPct,
    mastPct: Math.max(22, sub.mastPct - mastLoss),
    sailsPct: Math.max(20, sub.sailsPct - sailLoss),
  };
}

export function calculateFullRepairCost(sub: SubsystemIntegrity): number {
  const missingTotal =
    (100 - sub.hullPct) * 1.5 +
    (100 - sub.enginePct) * 1.3 +
    (100 - sub.rudderPct) * 1.1 +
    (100 - sub.mastPct) * 1.2 +
    (100 - sub.sailsPct) * 1.0;
  return Math.max(0, Math.round(missingTotal));
}

export function repairAllSubsystems(): SubsystemIntegrity {
  return createInitialSubsystems();
}

export function computeOverallHullIntegrity(sub: SubsystemIntegrity): number {
  return Math.round(
    sub.hullPct * 0.4 +
      sub.enginePct * 0.2 +
      sub.rudderPct * 0.15 +
      sub.mastPct * 0.15 +
      sub.sailsPct * 0.1,
  );
}
