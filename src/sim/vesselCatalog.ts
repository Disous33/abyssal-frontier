import { repairAllSubsystems } from './damageSystem';
import {
  ExtendedVesselUpgrades,
  OwnedVesselInstance,
  VesselCatalogSpec,
  VesselCategory,
} from './types';

export const VESSEL_CATEGORY_LABELS: Record<VesselCategory, string> = {
  fishing: 'Pesqueiro',
  speedboat: 'Lancha Rápida',
  sailboat: 'Veleiro',
  workboat: 'Barco de Trabalho',
  yacht: 'Iate',
  submarine: 'Submersível',
};

export const VESSEL_PAINT_PALETTE: Array<{ name: string; hex: number }> = [
  { name: 'Marfim Oceânico', hex: 0xe2e8f0 },
  { name: 'Azul Santos', hex: 0x1d4ed8 },
  { name: 'Turquesa Atlântico', hex: 0x0f766e },
  { name: 'Âmbar Resgate', hex: 0xd97706 },
  { name: 'Carmesim Naval', hex: 0x991b1b },
  { name: 'Grafite Tático', hex: 0x334155 },
];

export const VESSEL_CATALOG: VesselCatalogSpec[] = [
  {
    id: 'aster_s01',
    name: 'Aster S-01',
    category: 'sailboat',
    priceCr: 950,
    lengthM: 12.0,
    massKg: 6800,
    maxSpeedKnots: 12.5,
    fuelCapacityL: 160,
    fuelBurnFactor: 0.75,
    maxCargoKg: 120,
    hullStrength: 1.0,
    propulsion: 'sail_aux',
    maxDepthM: 0,
    sailRigged: true,
    armedCapable: true,
    defaultHullColor: 0xe6e4dc,
    defaultTrimColor: 0x1e3a4c,
    equipmentSummary: ['Velame completo (Mestra + Genoa)', 'Motor auxiliar 4.2 kN', 'Rádio VHF'],
    description:
      'Sloop oceânico equilibrado para navegação à vela com baixo consumo de diesel e boa estabilidade em ondas.',
  },
  {
    id: 'badejo_f1',
    name: 'Badejo F-1',
    category: 'fishing',
    priceCr: 1350,
    lengthM: 8.2,
    massKg: 3400,
    maxSpeedKnots: 14.5,
    fuelCapacityL: 220,
    fuelBurnFactor: 0.85,
    maxCargoKg: 210,
    hullStrength: 1.05,
    propulsion: 'outboard',
    maxDepthM: 0,
    sailRigged: false,
    armedCapable: false,
    defaultHullColor: 0xf1f5f9,
    defaultTrimColor: 0x0369a1,
    equipmentSummary: ['Urna refrigerada (+22% pesca)', 'Motor popa ágil', 'Suporte para rede costeira'],
    description:
      'Barco de pesca costeiro ágil com convés amplo de popa, porão térmico e bônus natural de atração de cardumes.',
  },
  {
    id: 'marlin_r4',
    name: 'Marlin R-4',
    category: 'speedboat',
    priceCr: 2650,
    lengthM: 9.6,
    massKg: 2800,
    maxSpeedKnots: 28.0,
    fuelCapacityL: 300,
    fuelBurnFactor: 1.38,
    maxCargoKg: 130,
    hullStrength: 0.9,
    propulsion: 'twin_diesel',
    maxDepthM: 0,
    sailRigged: false,
    armedCapable: true,
    defaultHullColor: 0x0f172a,
    defaultTrimColor: 0x0ea5e9,
    equipmentSummary: ['Propulsão dupla alta velocidade', 'Casco planador em V', 'Ideal para fuga rápida'],
    description:
      'Lancha de interceptação rápida projetada para travessias expressas e evasão de embarcações hostis.',
  },
  {
    id: 'atlas_t2',
    name: 'Atlas T-2',
    category: 'workboat',
    priceCr: 3400,
    lengthM: 15.2,
    massKg: 11200,
    maxSpeedKnots: 11.8,
    fuelCapacityL: 480,
    fuelBurnFactor: 1.15,
    maxCargoKg: 420,
    hullStrength: 1.65,
    propulsion: 'diesel',
    maxDepthM: 0,
    sailRigged: false,
    armedCapable: true,
    defaultHullColor: 0x9a3412,
    defaultTrimColor: 0xf59e0b,
    equipmentSummary: ['Casco pesado reforçado', 'Porão 420 kg', 'Canhão defensivo instalável'],
    description:
      'Barco de trabalho e apoio offshore de alta resistência estrutural, ideal para carga pesada e águas perigosas.',
  },
  {
    id: 'nereid_s1',
    name: 'NEREID S-1',
    category: 'submarine',
    priceCr: 3800,
    lengthM: 6.4,
    massKg: 4400,
    maxSpeedKnots: 9.5,
    fuelCapacityL: 240,
    fuelBurnFactor: 0.6,
    maxCargoKg: 160,
    hullStrength: 1.35,
    propulsion: 'electric_sub',
    maxDepthM: 85,
    sailRigged: false,
    armedCapable: false,
    defaultHullColor: 0xeab308,
    defaultTrimColor: 0x1e293b,
    equipmentSummary: ['Cabine pressurizada 85 m', 'Sonar ativo 350 m', 'Faróis LED & Braço robótico'],
    description:
      'Submersível compacto de pesquisa equipado com tanques de lastro dinâmico, sonar ativo e braço manipulador.',
  },
  {
    id: 'atlantis_y8',
    name: 'Atlantis Y-8',
    category: 'yacht',
    priceCr: 6200,
    lengthM: 20.5,
    massKg: 14500,
    maxSpeedKnots: 21.5,
    fuelCapacityL: 650,
    fuelBurnFactor: 1.45,
    maxCargoKg: 500,
    hullStrength: 1.5,
    propulsion: 'twin_diesel',
    maxDepthM: 0,
    sailRigged: false,
    armedCapable: true,
    defaultHullColor: 0xf8fafc,
    defaultTrimColor: 0x1e3a8a,
    equipmentSummary: ['Autonomia oceânica', 'Radar/Sonar longo alcance', 'Blindagem e defesa dupla'],
    description:
      'Embarcação oceânica de longo curso com propulsão dupla, grande capacidade de carga e suíte completa de defesa.',
  },
];

export function getVesselSpecById(specId: string): VesselCatalogSpec {
  return VESSEL_CATALOG.find((v) => v.id === specId) ?? VESSEL_CATALOG[0];
}

export function createDefaultUpgrades(): ExtendedVesselUpgrades {
  return {
    engineLevel: 1,
    hullArmorLevel: 1,
    sailRigLevel: 1,
    cargoHoldLevel: 1,
    propellerLevel: 1,
    sonarLevel: 1,
    lightingLevel: 1,
    weaponLevel: 0,
  };
}

export function createStarterOwnedVessel(): OwnedVesselInstance {
  const spec = VESSEL_CATALOG[0];
  return {
    instanceId: 'vessel_aster_starter',
    specId: spec.id,
    customName: spec.name,
    hullColorHex: spec.defaultHullColor,
    trimColorHex: spec.defaultTrimColor,
    parkedPort: 'Porto de Santos',
    condition: {
      hullIntegrityPct: 100,
      subsystems: repairAllSubsystems(),
      fuelPct: 100,
      batteryPct: 98,
      moored: true,
    },
    upgrades: createDefaultUpgrades(),
  };
}

export function computeEffectiveVesselCargoKg(vessel: OwnedVesselInstance): number {
  const spec = getVesselSpecById(vessel.specId);
  const bonus = (vessel.upgrades.cargoHoldLevel - 1) * 100;
  return spec.maxCargoKg + bonus;
}

export function computeEffectiveThrustN(vessel: OwnedVesselInstance): number {
  const spec = getVesselSpecById(vessel.specId);
  // 4200 N baseline for Aster S-01 (12.5 kts)
  const baseThrust =
    spec.category === 'sailboat'
      ? 4200
      : spec.category === 'fishing'
        ? 5400
        : spec.category === 'speedboat'
          ? 9200
          : spec.category === 'workboat'
            ? 8400
            : spec.category === 'yacht'
              ? 11200
              : 4600;
  const engScale = 1 + (vessel.upgrades.engineLevel - 1) * 0.22;
  const propScale = 1 + (vessel.upgrades.propellerLevel - 1) * 0.14;
  return Math.round(baseThrust * engScale * propScale);
}

export function createOwnedVesselFromSpec(spec: VesselCatalogSpec, seq: number): OwnedVesselInstance {
  return {
    instanceId: `vessel_${spec.id}_${seq}`,
    specId: spec.id,
    customName: spec.name,
    hullColorHex: spec.defaultHullColor,
    trimColorHex: spec.defaultTrimColor,
    parkedPort: 'Porto de Santos',
    condition: {
      hullIntegrityPct: 100,
      subsystems: repairAllSubsystems(),
      fuelPct: 100,
      batteryPct: 100,
      moored: true,
    },
    upgrades: createDefaultUpgrades(),
  };
}
