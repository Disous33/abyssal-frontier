export type GamePhase = 'title' | 'playing' | 'paused';

export type ControlMode = 'on_foot' | 'swimming' | 'diving' | 'sailing' | 'fishing' | 'submarine';

export type CameraMode =
  | 'thirdperson'
  | 'topdown'
  | 'chase'
  | 'inspect'
  | 'free'
  | 'cinematic'
  | 'underwater';

export type GraphicsProfile = 'low' | 'medium' | 'high' | 'ultra';

export type LightingPresetId =
  | 'auto'
  | 'dawn'
  | 'noon'
  | 'sunset'
  | 'clear_night'
  | 'overcast_night'
  | 'storm';

export type HudMode = 'full' | 'compact' | 'cinema';

export interface GraphicsSettings {
  renderScale: number;        // 0.65..1.25
  maxPixelRatio: number;      // 1.0..2.0
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  viewDistanceM: number;      // 1200..5500
  particleDensity: number;    // 0.2..1.5
  oceanQuality: GraphicsProfile;
  reflections: boolean;
  postProcessing: boolean;
  vegetationDensity: number;  // 0.0..1.5
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  frameTimeMs: number;
  jsHeapMb: number | null;
}

export type WeatherPresetId =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'fog'
  | 'storm'
  | 'calm'
  | 'rough';

export type ScenarioId =
  | 'calm_sea'
  | 'moderate_waves'
  | 'beam_wind'
  | 'tacking_drill'
  | 'storm_gale'
  | 'strong_current'
  | 'reefed_sails'
  | 'heavy_ballast'
  | 'motor_off'
  | 'endurance_stability'
  | 'geo_authorized'
  | 'geo_denied'
  | 'offline_voyage';

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface WaveComponent {
  amplitude: number;    // meters
  wavelength: number;   // meters
  steepness: number;    // 0..1 Gerstner Q parameter
  dirX: number;         // normalized wave propagation X
  dirZ: number;         // normalized wave propagation Z
  speedScale: number;   // phase speed multiplier
}

export interface OceanConfig {
  waveScale: number;      // global wave amplitude multiplier (0.05..2.5)
  chopScale: number;      // short-wave steepness multiplier
  currentSpeed: number;   // m/s
  currentDirDeg: number;  // direction current flows TOWARD (degrees, 0=N, 90=E)
  waterDensity: number;   // kg/m^3 (1025 seawater)
}

export interface WindConfig {
  speedKnots: number;     // true wind speed in knots (0..45)
  directionDeg: number;   // meteorological FROM direction (0=N, 90=E, 180=S, 270=W)
  gustIntensity: number;  // 0..1
  turbulence: number;     // 0..1
}

export interface VesselConfig {
  massKg: number;         // nominal 6800 kg for 12m sloop
  comOffsetY: number;     // vertical CoM adjustment (-0.6..+0.4 m)
  comOffsetZ: number;     // longitudinal CoM adjustment (-0.8..+0.8 m)
  hullDamping: number;    // hydrodynamic angular/linear damping multiplier (0.4..2.2)
  maxAuxThrustN: number;  // auxiliary engine max thrust in Newtons
}

export interface SubsystemIntegrity {
  hullPct: number;
  enginePct: number;
  rudderPct: number;
  mastPct: number;
  sailsPct: number;
}

export interface VesselUpgrades {
  engineLevel: number;     // 1..3
  hullArmorLevel: number;  // 1..3
  sailRigLevel: number;    // 1..3
  cargoHoldLevel: number;  // 1..3
}

export interface VesselCondition {
  hullIntegrityPct: number;
  subsystems: SubsystemIntegrity;
  fuelPct: number;
  batteryPct: number;
  moored: boolean;
}

export interface ControlInputs {
  throttle: number;       // -0.5..1.0 (W/S)
  rudderTarget: number;   // -1..1 (A/D, positive = turn starboard)
  sailTrim: number;       // 0.08..1.0 (Q/E, 0.08 = hauled close, 1.0 = eased out 85 deg)
  sailArea: number;       // 0.0..1.0 (R/F, reefing 0%..100%)
}

export interface WeatherAtmosphereState {
  preset: WeatherPresetId;
  lightingPreset: LightingPresetId;
  cloudCover: number;      // 0..1
  rainIntensity: number;   // 0..1
  fogDensity: number;      // exponential fog density
  sunElevationDeg: number; // degrees above horizon (negative = night)
  sunAzimuthDeg: number;   // degrees
  sunColorHex: number;
  skyTopHex: number;
  skyHorizonHex: number;
  waterDeepHex: number;
  waterShallowHex: number;
  exposure: number;
  ambientFactor: number;
  nightFactor: number;     // 0 = day, 1 = full night
  lightningFlash: number;  // 0..1 transient
}

export interface AudioVolumesConfig {
  master: number;   // 0..1
  ocean: number;    // 0..1
  motor: number;    // 0..1
  effects: number;  // 0..1
  radio: number;    // 0..1
}

export interface SimulationParams {
  ocean: OceanConfig;
  wind: WindConfig;
  vessel: VesselConfig;
  weather: WeatherPresetId;
  lighting?: LightingPresetId;
  graphics: GraphicsProfile;
  graphicsSettings?: GraphicsSettings;
  debugPhysics: boolean;
  audioVolumes?: AudioVolumesConfig;
}

export type CharacterAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'turn'
  | 'jump'
  | 'interact'
  | 'board'
  | 'steer'
  | 'swim'
  | 'dive';

export type InteractableType =
  | 'board_vessel'
  | 'disembark_vessel'
  | 'enter_water'
  | 'inspect_vessel'
  | 'npc_helena'
  | 'dock_service'
  | 'fuel_station'
  | 'equipment_shop'
  | 'port_market'
  | 'mission_board'
  | 'port_map'
  | 'naval_dealership'
  | 'submarine_dock'
  | 'dive_collect'
  | 'event_interact';

export interface ActivePrompt {
  id: InteractableType;
  keyLabel: string;
  label: string;
  sublabel?: string;
  blockedReason?: string;
  targetId?: string;
}

// --- Legacy 0.4 step alias preserved for backward compatibility ---
export type MissionStepId =
  | 'walk_to_pier'
  | 'board_vessel'
  | 'start_motor'
  | 'undock'
  | 'reach_checkpoint'
  | 'completed';

export interface MissionState {
  id: 'primeira_travessia';
  title: string;
  step: MissionStepId;
  stepIndex: number;
  totalSteps: number;
  objectiveText: string;
  hintText: string;
  checkpointLocalX: number;
  checkpointLocalZ: number;
  distanceToTargetM: number;
  completedAt: number | null;
}

// --- v0.5 Rich Mission Manager Types ---
export type MissionLifecycleStatus =
  | 'available'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MissionCategoryType =
  | 'transporte'
  | 'resgate'
  | 'exploracao'
  | 'investigacao'
  | 'recuperacao'
  | 'entrega'
  | 'patrulha'
  | 'pesquisa';

export interface MissionWaypoint {
  id: string;
  label: string;
  x: number;
  z: number;
  y?: number;
  radiusM: number;
  requiresDive?: boolean;
  requiresCargoId?: string;
  grantsItemId?: string;
  completed: boolean;
}

export interface CampaignMission {
  id: string;
  chapter: number;
  order: number;
  title: string;
  category: MissionCategoryType;
  giverNpc: string;
  status: MissionLifecycleStatus;
  summary: string;
  objectiveText: string;
  rewardCredits: number;
  unlocksMissionIds: string[];
  requiredMissionIds: string[];
  waypoints: MissionWaypoint[];
  currentWaypointIndex: number;
  returnToPortRequired: boolean;
  narrativeClue?: string;
  failureReason?: string;
  completedAt?: number | null;
}

// --- Economy, Inventory & Equipment ---
export type ItemKind = 'equipment' | 'cargo' | 'clue' | 'consumable' | 'fish' | 'bait';

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  unitWeightKg: number;
  basePriceCr: number;
  sellPriceCr: number;
  description: string;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface EconomyState {
  credits: number;
  maxCargoKg: number;
  inventory: InventoryEntry[];
  equippedIds: string[];
  upgrades: VesselUpgrades;
}

// --- Maritime Traffic ---
export interface NpcVesselSnapshot {
  id: string;
  name: string;
  vesselType: 'ferry' | 'tug' | 'fishing' | 'patrol' | 'nereus' | 'escort';
  x: number;
  z: number;
  headingDeg: number;
  speedKnots: number;
  state: 'cruising' | 'approaching_port' | 'anchored' | 'avoiding';
}

// --- Dynamic Ocean Events ---
export type DynamicEventType =
  | 'distress_call'
  | 'squall_storm'
  | 'disabled_vessel'
  | 'drifting_cargo'
  | 'suspicious_vessel'
  | 'mechanical_fault'
  | 'marine_wildlife'
  | 'wreck_discovery'
  | 'rare_school'
  | 'sonar_signal'
  | 'pirates_spotted'
  | 'missing_vessel'
  | 'historic_artifact';

export interface DynamicOceanEvent {
  id: string;
  type: DynamicEventType;
  title: string;
  description: string;
  x: number;
  z: number;
  radiusM: number;
  active: boolean;
  resolved: boolean;
  rewardCredits: number;
  rewardItemId?: string;
  expiresAtSimTime: number;
}

// --- Radio & Notifications ---
export interface RadioMessage {
  id: string;
  sender: string;
  channel: string;
  text: string;
  timestamp: number;
  urgent?: boolean;
}

export interface GameNotification {
  id: string;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  timestamp: number;
}

// --- Underwater Collectible ---
export interface UnderwaterNodeSnapshot {
  id: string;
  label: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export interface TelemetrySnapshot {
  timestamp: number;
  fps: number;
  simTime: number;
  controlMode: ControlMode;
  // Vessel Position & Attitude
  posX: number;
  posZ: number;
  posY: number;
  geoLat: number;
  geoLon: number;
  // Character Position & Underwater State
  charX: number;
  charY: number;
  charZ: number;
  charLat: number;
  charLon: number;
  charHeadingDeg: number;
  charGrounded: boolean;
  charAnim: CharacterAnimState;
  oxygenPct: number;
  maxOxygenSeconds: number;
  waterDepthM: number;
  distanceNm: number;
  speedKnots: number;
  speedMs: number;
  headingDeg: number;
  courseOverGroundDeg: number;
  leewayDeg: number;
  rollDeg: number;
  pitchDeg: number;
  yawRateDegS: number;
  // Wind & Sails
  trueWindKnots: number;
  trueWindDirDeg: number;
  apparentWindKnots: number;
  apparentWindRelDeg: number;
  boomAngleDeg: number;
  sailAreaPct: number;
  sailTrimPct: number;
  inNoGoZone: boolean;
  luffingFactor: number;
  // Forces (Newtons)
  aeroForceN: number;
  aeroForwardN: number;
  aeroLateralN: number;
  buoyancyForceN: number;
  hydroDragN: number;
  keelLiftN: number;
  auxThrustN: number;
  submergedElements: number;
  totalElements: number;
  // Controls & Condition echo
  throttle: number;
  rudderDeg: number;
  waveHeightAtBoat: number;
  weatherPreset: WeatherPresetId;
  condition: VesselCondition;
  activePrompt: ActivePrompt | null;
  loadedSectorsCount: number;
  geoDataSource: string;
  mission: MissionState;
  // v0.5 Live World Snapshots
  activeMission: CampaignMission | null;
  allMissions: CampaignMission[];
  economy: EconomyState;
  npcVessels: NpcVesselSnapshot[];
  activeEvent: DynamicOceanEvent | null;
  underwaterNodes: UnderwaterNodeSnapshot[];
  storyCluesFound: string[];
  renderStats?: RenderStats;
  // v0.7 Live Gameplay Snapshots
  fishing: FishingStateSnapshot;
  fishingStats: { totalCaught: number; totalSoldCr: number; catches: FishCatchRecord[] };
  underwater: UnderwaterSurvivalSnapshot;
  submarine: SubmarineTelemetrySnapshot;
  garage: {
    activeVesselId: string;
    ownedVessels: OwnedVesselInstance[];
  };
  pirates: PirateVesselSnapshot[];
  combat: CombatStateSnapshot;
  progression: PlayerProgressionState;
}

// --- v0.7 Fishing System Types ---
export type FishingStage =
  | 'idle'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'reeling'
  | 'caught'
  | 'lost';

export type FishQuality = 'Comum' | 'Fresco' | 'Premiado' | 'Troféu';

export interface FishCatchRecord {
  id: string;
  speciesId: string;
  speciesName: string;
  weightKg: number;
  quality: FishQuality;
  valueCr: number;
  protectedSpecies: boolean;
  caughtAt: number;
  sold: boolean;
}

export interface FishingStateSnapshot {
  stage: FishingStage;
  equippedRodId: string;
  equippedBaitId: string;
  castCharge: number; // 0..1
  lineLengthM: number;
  maxLineM: number;
  bobberX: number;
  bobberY: number;
  bobberZ: number;
  tensionPct: number; // 0..100
  biteRemainingS: number;
  hookedSpeciesName: string | null;
  hookedWeightKg: number;
  fishDistanceM: number;
  fishStaminaPct: number;
  fishPullDirDeg: number;
  inProtectedZone: boolean;
  zoneDepthM: number;
  statusMessage: string;
}

// --- v0.7 Underwater Exploration Survival Types ---
export interface UnderwaterSurvivalSnapshot {
  depthM: number;
  maxSafeDepthM: number;
  waterTempC: number;
  visibilityM: number;
  pressureAtm: number;
  decompressionRiskPct: number;
  flashlightOn: boolean;
  currentSpeedMs: number;
  environmentName: string;
  depthWarning: string | null;
}

// --- v0.7 Submarine System Types ---
export interface SonarContact {
  id: string;
  label: string;
  kind: 'wreck' | 'terrain' | 'vessel' | 'pirate' | 'collectible' | 'reef';
  x: number;
  y: number;
  z: number;
  distM: number;
  bearingDeg: number;
  relAngleDeg: number;
}

export interface SubmarineTelemetrySnapshot {
  active: boolean;
  unlocked: boolean;
  modelName: string;
  x: number;
  y: number;
  z: number;
  headingDeg: number;
  pitchDeg: number;
  speedKnots: number;
  depthM: number;
  maxSafeDepthM: number;
  pressureAtm: number;
  ballastPct: number;
  batteryPct: number;
  hullPct: number;
  headlightsOn: boolean;
  sonarSweepDeg: number;
  sonarRangeM: number;
  sonarContacts: SonarContact[];
  armBusy: boolean;
}

// --- v0.7 Naval Marketplace & Garage Types ---
export type VesselCategory =
  | 'fishing'
  | 'speedboat'
  | 'sailboat'
  | 'workboat'
  | 'yacht'
  | 'submarine';

export type VesselPropulsionType =
  | 'sail_aux'
  | 'outboard'
  | 'diesel'
  | 'twin_diesel'
  | 'electric_sub';

export interface VesselCatalogSpec {
  id: string;
  name: string;
  category: VesselCategory;
  priceCr: number;
  lengthM: number;
  massKg: number;
  maxSpeedKnots: number;
  fuelCapacityL: number;
  fuelBurnFactor: number;
  maxCargoKg: number;
  hullStrength: number;
  propulsion: VesselPropulsionType;
  maxDepthM: number;
  sailRigged: boolean;
  armedCapable: boolean;
  defaultHullColor: number;
  defaultTrimColor: number;
  equipmentSummary: string[];
  description: string;
}

export interface ExtendedVesselUpgrades extends VesselUpgrades {
  propellerLevel: number; // 1..3
  sonarLevel: number;     // 1..3
  lightingLevel: number;  // 1..3
  weaponLevel: number;    // 0..2
}

export interface OwnedVesselInstance {
  instanceId: string;
  specId: string;
  customName: string;
  hullColorHex: number;
  trimColorHex: number;
  parkedPort: string;
  condition: VesselCondition;
  upgrades: ExtendedVesselUpgrades;
}

// --- v0.7 Pirate & Maritime Combat Types ---
export type PirateFactionId =
  | 'corsarios_barra'
  | 'contrabandistas_nereus'
  | 'mercenarios_sul';

export type PirateAIState =
  | 'patrol'
  | 'investigate'
  | 'approach'
  | 'chase'
  | 'intimidate'
  | 'attack'
  | 'retreat'
  | 'flee';

export interface PirateVesselSnapshot {
  id: string;
  name: string;
  faction: PirateFactionId;
  enemyType: string;
  x: number;
  z: number;
  headingDeg: number;
  speedKnots: number;
  hullPct: number;
  aiState: PirateAIState;
  detectionPct: number;
  armed: boolean;
  onFire: boolean;
  distToPlayerM: number;
}

export interface CombatStateSnapshot {
  playerArmed: boolean;
  cannonCooldownS: number;
  cannonMaxCooldownS: number;
  threatLevel: 'none' | 'alert' | 'combat';
  nearestThreatDistM: number | null;
  activeFires: number;
  projectilesCount: number;
  intimidatePromptActive: boolean;
  bribeCostCr: number;
}

// --- v0.7 Player Progression Types ---
export type PlayerSkillKey =
  | 'navigation'
  | 'fishing'
  | 'diving'
  | 'exploration'
  | 'mechanics'
  | 'submarine';

export interface SkillProgressEntry {
  level: number;
  xp: number;
  nextLevelXp: number;
}

export type PlayerProgressionState = Record<PlayerSkillKey, SkillProgressEntry>;

export type GeoStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'inaccurate'
  | 'unsupported'
  | 'insecure'
  | 'stale';

export interface GeoSectorInfo {
  status: GeoStatus;
  sectorName: string;
  climateZone: string;
  recommendedWindKnots: number;
  recommendedWaveScale: number;
  recommendedCurrentSpeed: number;
  latitudeBand: string;
  accuracyMeters: number | null;
  lastUpdated: number | null;
  errorMessage: string | null;
  monitoringActive: boolean;
}

export interface CampaignBlueprintState {
  captainName: string;
  vesselName: string;
  vesselClass: string;
  homePort: string;
  discoveredSectors: string[];
  voyageMilesTotal: number;
  hullIntegrityPct: number;
  provisionDays: number;
  missionCompleted?: boolean;
  activeDirectives: {
    id: string;
    title: string;
    faction: string;
    status: 'ready' | 'planned';
  }[];
}
