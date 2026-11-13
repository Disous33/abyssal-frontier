import {
  CampaignBlueprintState,
  ControlInputs,
  ScenarioId,
  SimulationParams,
} from '../sim/types';

export interface ReproducibleScenario {
  id: ScenarioId;
  title: string;
  category: 'Hidrodinâmica' | 'Aerodinâmica' | 'Clima' | 'Sistemas';
  description: string;
  paramsPatch: Partial<SimulationParams>;
  oceanPatch?: Partial<SimulationParams['ocean']>;
  windPatch?: Partial<SimulationParams['wind']>;
  vesselPatch?: Partial<SimulationParams['vessel']>;
  controlsPatch?: Partial<ControlInputs>;
  vesselReset?: { x: number; z: number; headingDeg: number };
}

export const REPRODUCIBLE_SCENARIOS: ReproducibleScenario[] = [
  {
    id: 'calm_sea',
    title: '01. Mar Calmo',
    category: 'Hidrodinâmica',
    description: 'Ondulação mínima e brisa leve para verificar equilíbrio hidrostático e flutuação.',
    paramsPatch: { weather: 'calm' },
    oceanPatch: { waveScale: 0.35, chopScale: 0.4, currentSpeed: 0 },
    windPatch: { speedKnots: 7, directionDeg: 85, gustIntensity: 0.1, turbulence: 0.08 },
    controlsPatch: { throttle: 0.25, rudderTarget: 0, sailTrim: 0.45, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'moderate_waves',
    title: '02. Ondas Moderadas',
    category: 'Hidrodinâmica',
    description: 'Ondas de Gerstner de médio porte para avaliar arfagem (pitch) e balanço (roll).',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 1.15, chopScale: 1.05, currentSpeed: 0.2 },
    windPatch: { speedKnots: 15, directionDeg: 110, gustIntensity: 0.25, turbulence: 0.18 },
    controlsPatch: { throttle: 0.0, rudderTarget: 0, sailTrim: 0.42, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'beam_wind',
    title: '03. Vento Lateral (Través)',
    category: 'Aerodinâmica',
    description: 'Vento a 90° por boreste demonstrando propulsão máxima, adernamento e resposta da quilha.',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 0.8, chopScale: 0.8, currentSpeed: 0 },
    windPatch: { speedKnots: 18, directionDeg: 90, gustIntensity: 0.2, turbulence: 0.15 },
    controlsPatch: { throttle: 0.0, rudderTarget: 0, sailTrim: 0.48, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'tacking_drill',
    title: '04. Manobra de Cambada',
    category: 'Aerodinâmica',
    description: 'Vento de orça a 42° com leme aplicado para observar inversão da retranca e zona morta.',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 0.75, chopScale: 0.85, currentSpeed: 0 },
    windPatch: { speedKnots: 16, directionDeg: 42, gustIntensity: 0.2, turbulence: 0.15 },
    controlsPatch: { throttle: 0.15, rudderTarget: 0.55, sailTrim: 0.22, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'storm_gale',
    title: '05. Tempestade Severa',
    category: 'Clima',
    description: 'Vendaval de 34 nós, vagas altas, chuva intensa e rajadas turbulentas.',
    paramsPatch: { weather: 'storm' },
    oceanPatch: { waveScale: 2.15, chopScale: 1.8, currentSpeed: 0.75 },
    windPatch: { speedKnots: 34, directionDeg: 130, gustIntensity: 0.85, turbulence: 0.78 },
    controlsPatch: { throttle: 0.3, rudderTarget: 0, sailTrim: 0.55, sailArea: 0.55 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'strong_current',
    title: '06. Correnteza Transversal',
    category: 'Hidrodinâmica',
    description: 'Corrente marítima de 2.2 m/s perpendicular ao rumo testando deriva e COG vs HDG.',
    paramsPatch: { weather: 'cloudy' },
    oceanPatch: { waveScale: 0.7, chopScale: 0.75, currentSpeed: 2.2, currentDirDeg: 90 },
    windPatch: { speedKnots: 10, directionDeg: 140, gustIntensity: 0.15, turbulence: 0.12 },
    controlsPatch: { throttle: 0.5, rudderTarget: 0, sailTrim: 0.5, sailArea: 0.7 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'reefed_sails',
    title: '07. Vela Recolhida (Rizo)',
    category: 'Aerodinâmica',
    description: 'Área vélica reduzida a 20% sob vento forte para comparar redução de adernamento.',
    paramsPatch: { weather: 'rough' },
    oceanPatch: { waveScale: 1.4, chopScale: 1.3, currentSpeed: 0.2 },
    windPatch: { speedKnots: 26, directionDeg: 95, gustIntensity: 0.5, turbulence: 0.35 },
    controlsPatch: { throttle: 0.0, rudderTarget: 0, sailTrim: 0.42, sailArea: 0.2 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'heavy_ballast',
    title: '08. Variação de Massa & Lastro',
    category: 'Hidrodinâmica',
    description: 'Deslocamento aumentado para 9.400 kg e centro de massa deslocado para testar calado.',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 0.95, chopScale: 0.9 },
    windPatch: { speedKnots: 15, directionDeg: 105, gustIntensity: 0.2, turbulence: 0.15 },
    vesselPatch: { massKg: 9400, comOffsetY: -0.35, comOffsetZ: 0.35 },
    controlsPatch: { throttle: 0.0, rudderTarget: 0, sailTrim: 0.46, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'motor_off',
    title: '09. Propulsão Exclusiva à Vela',
    category: 'Aerodinâmica',
    description: 'Motor auxiliar desligado (0%): aceleração progressiva puramente aerodinâmica.',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 0.85, chopScale: 0.8, currentSpeed: 0 },
    windPatch: { speedKnots: 17, directionDeg: 115, gustIntensity: 0.25, turbulence: 0.18 },
    controlsPatch: { throttle: 0.0, rudderTarget: 0, sailTrim: 0.52, sailArea: 1.0 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'endurance_stability',
    title: '10. Estabilidade Prolongada',
    category: 'Sistemas',
    description: 'Navegação contínua em mar agitado para validar estabilidade numérica sem deriva de energia.',
    paramsPatch: { weather: 'rough' },
    oceanPatch: { waveScale: 1.65, chopScale: 1.45, currentSpeed: 0.4 },
    windPatch: { speedKnots: 22, directionDeg: 120, gustIntensity: 0.45, turbulence: 0.38 },
    vesselPatch: { massKg: 6800, comOffsetY: 0, comOffsetZ: 0, hullDamping: 1.0 },
    controlsPatch: { throttle: 0.2, rudderTarget: 0, sailTrim: 0.5, sailArea: 0.85 },
    vesselReset: { x: 0, z: 0, headingDeg: 0 },
  },
  {
    id: 'geo_authorized',
    title: '11. Setor por Geolocalização',
    category: 'Sistemas',
    description: 'Aplica perfil de vento e ondas derivado do setor oceânico regional autorizado.',
    paramsPatch: { weather: 'cloudy' },
    oceanPatch: { waveScale: 1.05, chopScale: 0.95, currentSpeed: 0.55 },
    windPatch: { speedKnots: 16, directionDeg: 125, gustIntensity: 0.3, turbulence: 0.22 },
  },
  {
    id: 'geo_denied',
    title: '12. Sem Geolocalização (Padrão)',
    category: 'Sistemas',
    description: 'Execução integral com parâmetros oceânicos locais sem acesso à localização do usuário.',
    paramsPatch: { weather: 'clear' },
    oceanPatch: { waveScale: 0.9, chopScale: 0.85, currentSpeed: 0.25 },
    windPatch: { speedKnots: 14, directionDeg: 95, gustIntensity: 0.25, turbulence: 0.15 },
  },
  {
    id: 'offline_voyage',
    title: '13. Operação 100% Offline',
    category: 'Sistemas',
    description: 'Persistência IndexedDB e cache Service Worker verificados sem dependência de rede.',
    paramsPatch: { weather: 'fog' },
    oceanPatch: { waveScale: 0.65, chopScale: 0.7, currentSpeed: 0.3 },
    windPatch: { speedKnots: 11, directionDeg: 135, gustIntensity: 0.2, turbulence: 0.16 },
    controlsPatch: { throttle: 0.35, rudderTarget: 0, sailTrim: 0.45, sailArea: 0.9 },
  },
];

export function createGraphicsSettingsForProfile(
  profile: SimulationParams['graphics'],
): NonNullable<SimulationParams['graphicsSettings']> {
  switch (profile) {
    case 'low':
      return {
        renderScale: 0.75,
        maxPixelRatio: 1.0,
        shadowQuality: 'off',
        viewDistanceM: 2200,
        particleDensity: 0.35,
        oceanQuality: 'low',
        reflections: false,
        postProcessing: false,
        vegetationDensity: 0.3,
      };
    case 'medium':
      return {
        renderScale: 0.9,
        maxPixelRatio: 1.25,
        shadowQuality: 'low',
        viewDistanceM: 3200,
        particleDensity: 0.7,
        oceanQuality: 'medium',
        reflections: true,
        postProcessing: false,
        vegetationDensity: 0.7,
      };
    case 'high':
      return {
        renderScale: 1.0,
        maxPixelRatio: 1.5,
        shadowQuality: 'medium',
        viewDistanceM: 4200,
        particleDensity: 1.0,
        oceanQuality: 'high',
        reflections: true,
        postProcessing: true,
        vegetationDensity: 1.0,
      };
    case 'ultra':
      return {
        renderScale: 1.0,
        maxPixelRatio: 2.0,
        shadowQuality: 'high',
        viewDistanceM: 5500,
        particleDensity: 1.4,
        oceanQuality: 'ultra',
        reflections: true,
        postProcessing: true,
        vegetationDensity: 1.35,
      };
  }
}

export function createDefaultSimulationParams(): SimulationParams {
  return {
    ocean: {
      waveScale: 0.9,
      chopScale: 0.85,
      currentSpeed: 0.25,
      currentDirDeg: 120,
      waterDensity: 1025,
    },
    wind: {
      speedKnots: 15,
      directionDeg: 105,
      gustIntensity: 0.28,
      turbulence: 0.18,
    },
    vessel: {
      massKg: 6800,
      comOffsetY: 0,
      comOffsetZ: 0,
      hullDamping: 1.0,
      maxAuxThrustN: 4200,
    },
    weather: 'clear',
    lighting: 'auto',
    graphics: 'high',
    graphicsSettings: createGraphicsSettingsForProfile('high'),
    debugPhysics: false,
  };
}

export function createInitialCampaignBlueprint(): CampaignBlueprintState {
  return {
    captainName: 'Kael Rivera',
    vesselName: 'Aster S-01',
    vesselClass: 'Sloop Oceânico 12m',
    homePort: 'Porto Meridiano (Arquipélago Base)',
    discoveredSectors: ['Canal de Testes Atlântico', 'Baía da Neblina'],
    voyageMilesTotal: 0,
    hullIntegrityPct: 100,
    provisionDays: 14,
    activeDirectives: [
      {
        id: 'dir-01',
        title: 'Calibração Hidrodinâmica & Provas de Mar da Aster S-01',
        faction: 'Consórcio Cartográfico Independente',
        status: 'ready',
      },
      {
        id: 'dir-02',
        title: 'Mapeamento de Ilhas Procedurais & Rotas Comerciais',
        faction: 'Federação dos Portos Livres',
        status: 'planned',
      },
      {
        id: 'dir-03',
        title: 'Navegação Planetária & Frotas Autônomas (NPCs/Governos)',
        faction: 'Diretoria Oceânica Austral',
        status: 'planned',
      },
    ],
  };
}
