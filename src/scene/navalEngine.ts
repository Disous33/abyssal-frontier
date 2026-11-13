import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SANTOS_ORIGIN } from '../geo/baixadaSantistaData';
import { GeoWorldManager } from '../geo/geoWorldManager';
import { GeographicSectorStreamer } from '../geo/sectorStreamer';
import { AbyssalSaveFile, SAVE_FORMAT_VERSION } from '../services/saveSystem';
import { KaelCharacterController } from '../sim/characterController';
import {
  applyCollisionDamage,
  applyGroundingDamage,
  applyWeatherAndUsageWear,
  calculateFullRepairCost,
  computeOverallHullIntegrity,
  computeVesselModifiers,
  createInitialSubsystems,
  repairAllSubsystems,
} from '../sim/damageSystem';
import { DynamicOceanEvents } from '../sim/dynamicEvents';
import {
  addItemToInventory,
  buyItem,
  createInitialEconomyState,
  hasEquipment,
  ITEM_CATALOG,
  removeItemFromInventory,
  sellItem,
} from '../sim/economySystem';
import { computeZoneDepthAt, FishingSystem } from '../sim/fishingSystem';
import { MaritimeTrafficManager } from '../sim/maritimeTraffic';
import {
  acceptMissionById,
  cancelMissionById,
  createCampaignMissions,
  evaluateCampaignMissions,
} from '../sim/missionManager';
import { createInitialMissionState, evaluatePrimeiraTravessia } from '../sim/missionSystem';
import { ensureRapierInitialized, NavalPhysicsWorld } from '../sim/navalPhysics';
import { PirateAIManager } from '../sim/pirateAI';
import { awardSkillXp, createInitialProgressionState, SKILL_LABELS } from '../sim/progressionSystem';
import { createGraphicsSettingsForProfile } from '../sim/scenarios';
import { SonarSceneObject, SubmarineController } from '../sim/submarineController';
import {
  ActivePrompt,
  AudioVolumesConfig,
  CameraMode,
  CampaignMission,
  ControlInputs,
  ControlMode,
  EconomyState,
  ExtendedVesselUpgrades,
  GameNotification,
  GamePhase,
  GraphicsProfile,
  GraphicsSettings,
  InteractableType,
  LightingPresetId,
  MissionState,
  OwnedVesselInstance,
  PlayerProgressionState,
  PlayerSkillKey,
  RadioMessage,
  RenderStats,
  SimulationParams,
  TelemetrySnapshot,
  VesselCondition,
  VesselUpgrades,
  WeatherAtmosphereState,
  WeatherPresetId,
} from '../sim/types';
import {
  computeEffectiveThrustN,
  computeEffectiveVesselCargoKg,
  createOwnedVesselFromSpec,
  createStarterOwnedVessel,
  getVesselSpecById,
  VESSEL_CATALOG,
} from '../sim/vesselCatalog';
import { createInitialAtmosphere, stepAtmosphere, WEATHER_PRESETS } from '../sim/weatherSystem';
import { AsterS01Vessel } from './asterS01Vessel';
import { MaritimeAudioEngine } from './audioEngine';
import { MaritimeCameraController } from './cameraController';
import { EnvironmentEffects } from './environmentEffects';
import { FishingVisuals } from './fishingVisuals';
import { ArticulatedCharacterRig, KAEL_APPEARANCE } from './kaelCharacter';
import { OceanSurface } from './oceanMesh';
import { PirateRenderer } from './pirateRenderer';
import { PortOfSantosScene, SafeDisembarkZone } from './portOfSantos';
import { createProceduralTextures, ProceduralTextureSet } from './proceduralTextures';
import { SubmarineMesh } from './submarineMesh';
import { TrafficRenderer } from './trafficRenderer';
import { UnderwaterAreaScene } from './underwaterArea';
import { SurfaceVesselVisuals } from './vesselCatalogRenderer';

const FIXED_DT = 1 / 60;
const MOOR_POS_X = 16.5;
const MOOR_POS_Z = 12.0;
const MOOR_HEADING_DEG = 172;
const KAEL_SPAWN = { x: -24.0, y: 1.48, z: 9.5, headingRad: Math.PI * 0.5 };

export interface EngineCallbacks {
  onTelemetry: (snap: TelemetrySnapshot) => void;
  onToggleLab: () => void;
  onTogglePause: () => void;
  onToggleMap: () => void;
  onToggleInventory: () => void;
  onToggleJournal: () => void;
  onOpenInteraction: (type: InteractableType) => void;
  onCameraModeSync: (mode: CameraMode) => void;
  onParamsChanged: (params: SimulationParams) => void;
  onRadioMessage: (msg: RadioMessage) => void;
  onNotification: (note: GameNotification) => void;
  onMissionCompleted: (mission?: CampaignMission) => void;
  onContextLost: (lost: boolean) => void;
  onReady: () => void;
  onError: (msg: string) => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createInitialTelemetrySnapshot(): TelemetrySnapshot {
  const eco = createInitialEconomyState();
  const missions = createCampaignMissions();
  return {
    timestamp: Date.now(),
    fps: 60,
    simTime: 0,
    controlMode: 'on_foot',
    posX: MOOR_POS_X,
    posZ: MOOR_POS_Z,
    posY: 0.15,
    geoLat: SANTOS_ORIGIN.lat,
    geoLon: SANTOS_ORIGIN.lon,
    charX: KAEL_SPAWN.x,
    charY: KAEL_SPAWN.y,
    charZ: KAEL_SPAWN.z,
    charLat: SANTOS_ORIGIN.lat,
    charLon: SANTOS_ORIGIN.lon,
    charHeadingDeg: 90,
    charGrounded: true,
    charAnim: 'idle',
    oxygenPct: 100,
    maxOxygenSeconds: 45,
    waterDepthM: 0,
    distanceNm: 0,
    speedKnots: 0,
    speedMs: 0,
    headingDeg: MOOR_HEADING_DEG,
    courseOverGroundDeg: MOOR_HEADING_DEG,
    leewayDeg: 0,
    rollDeg: 0,
    pitchDeg: 0,
    yawRateDegS: 0,
    trueWindKnots: 12,
    trueWindDirDeg: 115,
    apparentWindKnots: 12,
    apparentWindRelDeg: 115,
    boomAngleDeg: 0,
    sailAreaPct: 0,
    sailTrimPct: 45,
    inNoGoZone: false,
    luffingFactor: 0,
    aeroForceN: 0,
    aeroForwardN: 0,
    aeroLateralN: 0,
    buoyancyForceN: 0,
    hydroDragN: 0,
    keelLiftN: 0,
    auxThrustN: 0,
    submergedElements: 16,
    totalElements: 24,
    throttle: 0,
    rudderDeg: 0,
    waveHeightAtBoat: 0,
    weatherPreset: 'clear',
    condition: {
      hullIntegrityPct: 100,
      subsystems: createInitialSubsystems(),
      fuelPct: 100,
      batteryPct: 98,
      moored: true,
    },
    activePrompt: null,
    loadedSectorsCount: 0,
    geoDataSource: 'Base Vetorial Regional WGS84 (Baixada Santista)',
    mission: createInitialMissionState(false),
    activeMission: null,
    allMissions: missions,
    economy: eco,
    npcVessels: [],
    activeEvent: null,
    underwaterNodes: [],
    storyCluesFound: [],
    fishing: {
      stage: 'idle',
      equippedRodId: 'none',
      equippedBaitId: 'none',
      castCharge: 0,
      lineLengthM: 0,
      maxLineM: 38,
      bobberX: 0,
      bobberY: 0,
      bobberZ: 0,
      tensionPct: 0,
      biteRemainingS: 0,
      hookedSpeciesName: null,
      hookedWeightKg: 0,
      fishDistanceM: 0,
      fishStaminaPct: 100,
      fishPullDirDeg: 0,
      inProtectedZone: false,
      zoneDepthM: 8,
      statusMessage: 'Adquira uma vara de pesca com Clara no cais.',
    },
    fishingStats: { totalCaught: 0, totalSoldCr: 0, catches: [] },
    underwater: {
      depthM: 0,
      maxSafeDepthM: 7.0,
      waterTempC: 23.5,
      visibilityM: 18,
      pressureAtm: 1.0,
      decompressionRiskPct: 0,
      flashlightOn: false,
      currentSpeedMs: 0.35,
      environmentName: 'Porto de Santos',
      depthWarning: null,
    },
    submarine: {
      active: false,
      unlocked: false,
      modelName: 'NEREID S-1',
      x: 24,
      y: -1.2,
      z: -19,
      headingDeg: 180,
      pitchDeg: 0,
      speedKnots: 0,
      depthM: 1.2,
      maxSafeDepthM: 85,
      pressureAtm: 1.1,
      ballastPct: 50,
      batteryPct: 100,
      hullPct: 100,
      headlightsOn: true,
      sonarSweepDeg: 0,
      sonarRangeM: 320,
      sonarContacts: [],
      armBusy: false,
    },
    garage: {
      activeVesselId: 'vessel_aster_starter',
      ownedVessels: [createStarterOwnedVessel()],
    },
    pirates: [],
    combat: {
      playerArmed: false,
      cannonCooldownS: 0,
      cannonMaxCooldownS: 2.6,
      threatLevel: 'none',
      nearestThreatDistM: null,
      activeFires: 0,
      projectilesCount: 0,
      intimidatePromptActive: false,
      bribeCostCr: 120,
    },
    progression: createInitialProgressionState(),
  };
}

export class NavalSimulationEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private fog!: THREE.FogExp2;
  private envMapRT: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private activeShadowMapSize = 1024;
  private frameTimeEmaMs = 16.6;
  private readonly renderStatsScratch: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    geometries: 0,
    frameTimeMs: 16.6,
    jsHeapMb: null,
  };

  private textures!: ProceduralTextureSet;
  private oceanSurface!: OceanSurface;
  private vessel!: AsterS01Vessel;
  private envEffects!: EnvironmentEffects;
  private physics!: NavalPhysicsWorld;

  private geoWorld!: GeoWorldManager;
  private sectorStreamer!: GeographicSectorStreamer;
  private portScene!: PortOfSantosScene;
  private underwaterScene!: UnderwaterAreaScene;
  private trafficRenderer!: TrafficRenderer;
  private kaelCtrl!: KaelCharacterController;
  private kaelRig!: ArticulatedCharacterRig;
  private fishingVisuals!: FishingVisuals;
  private submarineMesh!: SubmarineMesh;
  private pirateRenderer!: PirateRenderer;
  private surfaceVesselVisuals!: SurfaceVesselVisuals;
  private diveSpotLight: THREE.SpotLight | null = null;

  private readonly trafficMgr = new MaritimeTrafficManager();
  private readonly dynamicEvents = new DynamicOceanEvents();
  private readonly fishingSys = new FishingSystem();
  private readonly submarineCtrl = new SubmarineController();
  private readonly pirateAI = new PirateAIManager();

  public readonly cameraCtrl = new MaritimeCameraController();
  public readonly audio = new MaritimeAudioEngine();

  private params: SimulationParams;
  private controls: ControlInputs = {
    throttle: 0.0,
    rudderTarget: 0.0,
    sailTrim: 0.45,
    sailArea: 0.0,
  };
  private atmosphere: WeatherAtmosphereState;
  private phase: GamePhase = 'title';
  private controlMode: ControlMode = 'on_foot';
  private fishingReturnMode: 'on_foot' | 'sailing' = 'on_foot';
  private ownedVessels: OwnedVesselInstance[] = [createStarterOwnedVessel()];
  private activeVesselId = 'vessel_aster_starter';
  private vesselSeq = 2;
  private progression: PlayerProgressionState = createInitialProgressionState();
  private navXpTimerS = 0;

  private condition: VesselCondition = {
    hullIntegrityPct: 100,
    subsystems: createInitialSubsystems(),
    fuelPct: 100,
    batteryPct: 98,
    moored: true,
  };
  private economy: EconomyState = createInitialEconomyState();
  private campaignMissions: CampaignMission[] = createCampaignMissions();
  private storyCluesFound: string[] = [];
  private mission: MissionState = createInitialMissionState(false);
  private initialMooringX = MOOR_POS_X;
  private initialMooringZ = MOOR_POS_Z;
  private currentPrompt: ActivePrompt | null = null;

  private lastCollisionAudioMs = 0;
  private groundingNoticeCooldown = 0;
  private msgSeq = 0;

  private readonly heldKeys = new Set<string>();
  private jumpQueued = false;
  private isSoftwareGl = false;
  private disposed = false;
  private contextLost = false;
  private frameId = 0;
  private lastNow = performance.now();
  private accumulator = 0;
  private fpsEma = 60;
  private lastTelemetryEmit = 0;

  private readonly boatPos = new THREE.Vector3(MOOR_POS_X, 0.15, MOOR_POS_Z);
  private readonly boatQuat = new THREE.Quaternion();
  private readonly boatForward = new THREE.Vector3(0, 0, -1);
  private readonly boatEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly helmWorldPos = new THREE.Vector3();
  private readonly anchorVec = new THREE.Vector3();
  private readonly subPosScratch = new THREE.Vector3();
  private readonly geoCoordScratch = { lat: SANTOS_ORIGIN.lat, lon: SANTOS_ORIGIN.lon };
  private readonly charGeoScratch = { lat: SANTOS_ORIGIN.lat, lon: SANTOS_ORIGIN.lon };
  private readonly telemetryScratch: TelemetrySnapshot = createInitialTelemetrySnapshot();

  constructor(
    container: HTMLElement,
    initialParams: SimulationParams,
    initialMissionCompleted: boolean,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.params = structuredClone(initialParams);
    if (!this.params.graphicsSettings) {
      this.params.graphicsSettings = createGraphicsSettingsForProfile(this.params.graphics);
    }
    this.atmosphere = createInitialAtmosphere(initialParams.weather, initialParams.lighting ?? 'auto');
    this.mission = createInitialMissionState(initialMissionCompleted);
    this.callbacks = callbacks;
    if (initialParams.audioVolumes) {
      this.audio.setVolumes(initialParams.audioVolumes);
    }
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      await ensureRapierInitialized();
      if (this.disposed) return;

      this.isSoftwareGl = detectSoftwareWebGL();
      this.geoWorld = new GeoWorldManager(SANTOS_ORIGIN);

      this.initThree();

      this.physics = new NavalPhysicsWorld(
        this.params.vessel,
        MOOR_POS_X,
        MOOR_POS_Z,
        MOOR_HEADING_DEG,
      );
      this.physics.setMoored(true, MOOR_POS_X, MOOR_POS_Z);

      this.portScene = new PortOfSantosScene(this.physics.getWorld(), this.textures, this.isSoftwareGl);
      this.scene.add(this.portScene.group);

      this.underwaterScene = new UnderwaterAreaScene();
      this.scene.add(this.underwaterScene.group);

      this.trafficRenderer = new TrafficRenderer();
      this.scene.add(this.trafficRenderer.group);

      this.sectorStreamer = new GeographicSectorStreamer(
        this.geoWorld,
        this.params.graphicsSettings?.vegetationDensity ?? 1.0,
      );
      this.scene.add(this.sectorStreamer.group);
      this.sectorStreamer.update(KAEL_SPAWN.x, KAEL_SPAWN.z);

      this.kaelCtrl = new KaelCharacterController(
        this.physics.getWorld(),
        KAEL_SPAWN.x,
        KAEL_SPAWN.y,
        KAEL_SPAWN.z,
      );
      this.kaelRig = new ArticulatedCharacterRig(KAEL_APPEARANCE);
      this.kaelRig.root.position.copy(this.kaelCtrl.position);
      this.kaelRig.root.rotation.y = this.kaelCtrl.headingRad;
      this.scene.add(this.kaelRig.root);

      this.fishingVisuals = new FishingVisuals();
      this.scene.add(this.fishingVisuals.group);

      this.submarineMesh = new SubmarineMesh(0xeab308, 0x1e293b, this.isSoftwareGl);
      this.submarineMesh.root.visible = false;
      this.scene.add(this.submarineMesh.root);

      this.pirateRenderer = new PirateRenderer();
      this.scene.add(this.pirateRenderer.group);

      this.surfaceVesselVisuals = new SurfaceVesselVisuals();
      this.surfaceVesselVisuals.root.visible = false;
      this.scene.add(this.surfaceVesselVisuals.root);

      if (!this.isSoftwareGl) {
        this.diveSpotLight = new THREE.SpotLight(0xbae6fd, 0.0, 42, Math.PI * 0.25, 0.45, 1.2);
        this.scene.add(this.diveSpotLight, this.diveSpotLight.target);
      }

      this.syncActiveVesselVisualsAndEconomy();
      this.applyGraphicsConfig(this.params);
      this.syncDivingVisuals();
      this.bindEvents();
      this.lastNow = performance.now();
      this.callbacks.onReady();
      this.scheduleNextTick();
    } catch (err) {
      this.callbacks.onError(
        err instanceof Error ? err.message : 'Falha ao inicializar motor naval 3D.',
      );
    }
  }

  private initThree(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const gs = this.getEffectiveGraphicsSettings(this.params);
    const initDpr = this.isSoftwareGl
      ? 1
      : Math.max(0.5, Math.min(window.devicePixelRatio || 1, gs.maxPixelRatio) * gs.renderScale);
    this.renderer.setPixelRatio(initDpr);
    this.renderer.setSize(width, height, false);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(this.atmosphere.skyHorizonHex, this.atmosphere.fogDensity * 0.65);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.3, 4500);
    this.camera.position.set(18, 18, 28);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envMapRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envMapRT.texture;
    this.scene.environmentIntensity = 0.72;
    roomEnv.dispose();
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0x9bd2f0, 0x0b2a38, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.15);
    this.sunLight.position.set(45, 55, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 210;
    const d = 52;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x7cc4e8, 0.55);
    this.rimLight.position.set(-40, 22, -45);
    this.scene.add(this.rimLight);

    this.textures = createProceduralTextures(this.renderer);
    this.oceanSurface = new OceanSurface(this.params.graphics);
    this.vessel = new AsterS01Vessel(this.textures, this.isSoftwareGl);
    this.envEffects = new EnvironmentEffects(this.textures);

    this.scene.add(this.oceanSurface.mesh);
    this.scene.add(this.oceanSurface.skirtMesh);
    this.scene.add(this.vessel.root);
    this.scene.add(this.envEffects.group);

    if (!this.isSoftwareGl) {
      const rt = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        samples: 2,
      });
      this.composer = new EffectComposer(this.renderer, rt);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.24,
        0.55,
        0.92,
      );
      const outputPass = new OutputPass();
      this.composer.addPass(renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(outputPass);
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private getEffectiveGraphicsSettings(params: SimulationParams): GraphicsSettings {
    return params.graphicsSettings ?? createGraphicsSettingsForProfile(params.graphics);
  }

  private applyGraphicsConfig(params: SimulationParams): void {
    if (!this.renderer || !this.scene || !this.sunLight) return;
    const gs = this.getEffectiveGraphicsSettings(params);
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    let dpr = 1;
    if (!this.isSoftwareGl) {
      const dev = window.devicePixelRatio || 1;
      dpr = Math.max(0.5, Math.min(dev, gs.maxPixelRatio) * gs.renderScale);
    }
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(width, height);

    const shadowsOn = !this.isSoftwareGl && gs.shadowQuality !== 'off';
    this.renderer.shadowMap.enabled = shadowsOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sunLight.castShadow = shadowsOn;

    const targetMapSize =
      gs.shadowQuality === 'high' ? 2048 : gs.shadowQuality === 'medium' ? 1024 : 512;
    if (targetMapSize !== this.activeShadowMapSize && shadowsOn) {
      this.activeShadowMapSize = targetMapSize;
      this.sunLight.shadow.mapSize.set(targetMapSize, targetMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }

    if (this.camera) {
      const targetFar = Math.max(1200, Math.min(6000, gs.viewDistanceM));
      if (Math.abs(this.camera.far - targetFar) > 10) {
        this.camera.far = targetFar;
        this.camera.updateProjectionMatrix();
      }
    }

    this.scene.environmentIntensity = gs.reflections ? 0.78 : 0.32;
    this.oceanSurface?.setGraphicsProfile(gs.oceanQuality, gs.reflections);
    this.envEffects?.setParticleDensity(gs.particleDensity);
    this.sectorStreamer?.setVegetationDensity(gs.vegetationDensity);
  }

  private applyGraphicsProfile(profile: GraphicsProfile): void {
    this.params.graphics = profile;
    this.params.graphicsSettings = createGraphicsSettingsForProfile(profile);
    this.applyGraphicsConfig(this.params);
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  private unbindEvents(): void {
    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      canvas.removeEventListener('pointerdown', this.handlePointerDown);
      canvas.removeEventListener('wheel', this.handleWheel);
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.callbacks.onContextLost(false);
    this.lastNow = performance.now();
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.audio.initOnUserGesture();
    this.cameraCtrl.onPointerDown(e.clientX, e.clientY);
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.cameraCtrl.onPointerMove(e.clientX, e.clientY);
  };

  private handlePointerUp = () => {
    this.cameraCtrl.onPointerUp();
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.cameraCtrl.onWheel(e.deltaY);
  };

  private handleResize = () => {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloomPass?.setSize(width, height);
  };

  private handleWindowBlur = () => {
    this.heldKeys.clear();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    this.audio.initOnUserGesture();
    const code = e.code;

    if (!e.repeat) {
      if (code === 'Tab') {
        e.preventDefault();
        if (this.phase === 'playing') this.callbacks.onToggleLab();
        return;
      }
      if (code === 'Escape') {
        e.preventDefault();
        if (this.phase !== 'title') this.callbacks.onTogglePause();
        return;
      }
      if (code === 'KeyM' && this.phase === 'playing') {
        e.preventDefault();
        this.callbacks.onToggleMap();
        return;
      }
      if (code === 'KeyI' && this.phase === 'playing') {
        e.preventDefault();
        this.callbacks.onToggleInventory();
        return;
      }
      if (code === 'KeyJ' && this.phase === 'playing') {
        e.preventDefault();
        this.callbacks.onToggleJournal();
        return;
      }
      if (code === 'KeyU' && this.phase === 'playing') {
        e.preventDefault();
        if (this.controlMode === 'sailing') {
          this.enterWaterFromVessel();
        } else if (this.controlMode === 'submarine') {
          this.exitSubmarineToPortOrSurface();
        }
        return;
      }
      if (code === 'KeyP' && this.phase === 'playing') {
        e.preventDefault();
        this.toggleFishingMode();
        return;
      }
      if (code === 'KeyF' && this.phase === 'playing') {
        if (this.controlMode === 'diving' || this.controlMode === 'swimming') {
          e.preventDefault();
          this.toggleDiveFlashlight();
          return;
        }
        if (this.controlMode === 'submarine') {
          e.preventDefault();
          this.toggleSubmarineHeadlights();
          return;
        }
      }
      if (code === 'KeyR' && this.phase === 'playing' && this.controlMode === 'submarine') {
        e.preventDefault();
        this.triggerSubmarineArmCollect();
        return;
      }
      if (code === 'KeyG' && this.phase === 'playing' && this.controlMode === 'sailing') {
        e.preventDefault();
        this.firePlayerCannon();
        return;
      }
      if (code === 'F1') {
        e.preventDefault();
        this.params.debugPhysics = !this.params.debugPhysics;
        this.callbacks.onParamsChanged(structuredClone(this.params));
        return;
      }
      if (code === 'F2') {
        e.preventDefault();
        this.cycleWeather();
        return;
      }
      if (code === 'F3') {
        e.preventDefault();
        this.params.wind.directionDeg = (this.params.wind.directionDeg + 30) % 360;
        this.callbacks.onParamsChanged(structuredClone(this.params));
        return;
      }
      if (code === 'KeyE' && this.phase === 'playing') {
        if (
          this.controlMode === 'on_foot' ||
          this.controlMode === 'swimming' ||
          this.controlMode === 'diving'
        ) {
          e.preventDefault();
          this.triggerInteraction();
          return;
        } else if (
          this.currentPrompt &&
          (this.currentPrompt.id === 'disembark_vessel' || this.currentPrompt.id === 'enter_water') &&
          !this.currentPrompt.blockedReason
        ) {
          e.preventDefault();
          this.triggerInteraction();
          return;
        }
      }
      if (code === 'Space' && this.phase === 'playing') {
        e.preventDefault();
        if (this.controlMode === 'on_foot') {
          this.jumpQueued = true;
        } else if (this.controlMode === 'fishing') {
          if (
            this.fishingSys.stage === 'idle' ||
            this.fishingSys.stage === 'caught' ||
            this.fishingSys.stage === 'lost'
          ) {
            this.startFishingCharge();
          } else if (this.fishingSys.stage === 'bite') {
            this.triggerFishingHookOrReel();
          }
        } else if (this.controlMode === 'sailing') {
          const activeV = this.getActiveSurfaceVessel();
          if (activeV.upgrades.weaponLevel > 0 && this.telemetryScratch.combat.threatLevel !== 'none') {
            this.firePlayerCannon();
          } else {
            this.controls.rudderTarget = 0;
          }
        }
      }
    }

    if (
      code === 'KeyW' ||
      code === 'KeyS' ||
      code === 'KeyA' ||
      code === 'KeyD' ||
      code === 'KeyQ' ||
      code === 'KeyE' ||
      code === 'KeyR' ||
      code === 'KeyF' ||
      code === 'KeyC' ||
      code === 'Space' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      this.heldKeys.add(code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
    if (e.code === 'Space' && this.controlMode === 'fishing' && this.fishingSys.stage === 'charging') {
      this.releaseFishingCast();
    }
  };

  private pushRadio(sender: string, channel: string, text: string, urgent = false): void {
    this.msgSeq++;
    this.audio.playRadioChirp();
    this.callbacks.onRadioMessage({
      id: `radio_${this.msgSeq}_${Date.now()}`,
      sender,
      channel,
      text,
      timestamp: Date.now(),
      urgent,
    });
  }

  private pushNotify(
    title: string,
    detail: string,
    tone: GameNotification['tone'] = 'info',
  ): void {
    this.msgSeq++;
    if (tone === 'warning' || tone === 'danger' || tone === 'success') {
      this.audio.playAlertBeep();
    }
    this.callbacks.onNotification({
      id: `note_${this.msgSeq}_${Date.now()}`,
      title,
      detail,
      tone,
      timestamp: Date.now(),
    });
  }

  private syncDivingVisuals(): void {
    if (!this.kaelRig) return;
    this.kaelRig.setDivingGearEquipped(
      hasEquipment(this.economy, 'equip_diver_mask'),
      hasEquipment(this.economy, 'equip_scuba_tank'),
    );
  }

  private cycleWeather(): void {
    const order: WeatherPresetId[] = ['clear', 'calm', 'cloudy', 'rain', 'fog', 'rough', 'storm'];
    const idx = order.indexOf(this.params.weather);
    const next = order[(idx + 1) % order.length];
    this.applyWeatherPreset(next);
    this.callbacks.onParamsChanged(structuredClone(this.params));
  }

  public applyWeatherPreset(preset: WeatherPresetId): void {
    const target = WEATHER_PRESETS[preset];
    this.params.weather = preset;
    this.params.wind.speedKnots = target.windKnots;
    this.params.wind.gustIntensity = target.gustIntensity;
    this.params.wind.turbulence = target.turbulence;
    this.params.ocean.waveScale = target.waveScale;
    this.params.ocean.chopScale = target.chopScale;
  }

  public setLightingPreset(preset: LightingPresetId): void {
    this.params.lighting = preset;
    this.callbacks.onParamsChanged(structuredClone(this.params));
  }

  public setParams(next: SimulationParams): void {
    const prevGraphics = this.params.graphics;
    const prevSettings = JSON.stringify(this.params.graphicsSettings ?? {});
    this.params = structuredClone(next);

    if (prevGraphics !== next.graphics && JSON.stringify(next.graphicsSettings ?? {}) === prevSettings) {
      this.applyGraphicsProfile(next.graphics);
    } else {
      if (!this.params.graphicsSettings) {
        this.params.graphicsSettings = createGraphicsSettingsForProfile(this.params.graphics);
      }
      this.applyGraphicsConfig(this.params);
    }

    if (next.audioVolumes) {
      this.audio.setVolumes(next.audioVolumes);
    }
  }

  public setAudioVolumes(vol: AudioVolumesConfig): void {
    this.audio.setVolumes(vol);
    this.params.audioVolumes = { ...vol };
    this.callbacks.onParamsChanged(structuredClone(this.params));
  }

  public setControlsPatch(patch: Partial<ControlInputs>): void {
    Object.assign(this.controls, patch);
  }

  public getControls(): ControlInputs {
    return { ...this.controls };
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase === 'playing') {
      this.audio.initOnUserGesture();
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraCtrl.setMode(mode);
    if (mode !== 'free') this.cameraCtrl.resetFreeOffset();
  }

  public getControlMode(): ControlMode {
    return this.controlMode;
  }

  public getGeoWorld(): GeoWorldManager {
    return this.geoWorld;
  }

  private grantXp(skill: PlayerSkillKey, amount: number): void {
    const res = awardSkillXp(this.progression, skill, amount);
    this.progression = res.next;
    if (res.leveledUpTo !== null) {
      const label = SKILL_LABELS[skill].title;
      this.pushNotify(`Habilidade Evoluída: ${label}`, `Nível ${res.leveledUpTo} alcançado!`, 'success');
    }
  }

  private getActiveSurfaceVessel(): OwnedVesselInstance {
    const found = this.ownedVessels.find((v) => v.instanceId === this.activeVesselId && v.specId !== 'nereid_s1');
    if (found) return found;
    return this.ownedVessels.find((v) => v.specId !== 'nereid_s1') ?? this.ownedVessels[0];
  }

  private syncActiveVesselVisualsAndEconomy(): void {
    const active = this.getActiveSurfaceVessel();
    const spec = getVesselSpecById(active.specId);
    this.activeVesselId = active.instanceId;

    this.economy = {
      ...this.economy,
      upgrades: {
        engineLevel: active.upgrades.engineLevel,
        hullArmorLevel: active.upgrades.hullArmorLevel,
        sailRigLevel: active.upgrades.sailRigLevel,
        cargoHoldLevel: active.upgrades.cargoHoldLevel,
      },
      maxCargoKg: computeEffectiveVesselCargoKg(active),
    };

    this.params.vessel.massKg = spec.massKg;
    this.params.vessel.maxAuxThrustN = computeEffectiveThrustN(active);

    if (this.vessel && this.surfaceVesselVisuals) {
      if (spec.id === 'aster_s01') {
        this.vessel.root.visible = true;
        this.surfaceVesselVisuals.root.visible = false;
        this.vessel.setHullPaint(active.hullColorHex, active.trimColorHex);
      } else {
        this.vessel.root.visible = false;
        this.surfaceVesselVisuals.root.visible = true;
        this.surfaceVesselVisuals.ensureModel(
          spec.id,
          active.hullColorHex,
          active.trimColorHex,
          active.upgrades.weaponLevel,
          this.isSoftwareGl,
        );
      }
    }

    if (this.submarineMesh) {
      const subOwned = this.ownedVessels.some((v) => v.specId === 'nereid_s1');
      this.submarineMesh.root.visible = subOwned;
    }
  }

  // --- Economy, Shop, Market, Repair, Fishing, Garage, Submarine & Combat Actions ---
  public buyShopItem(itemId: string): { ok: boolean; message: string } {
    const res = buyItem(this.economy, itemId);
    this.economy = res.next;
    this.fishingSys.syncEquipmentSelection(this.economy);
    this.syncDivingVisuals();
    this.pushNotify(res.ok ? 'Equipamento Adquirido' : 'Compra Negada', res.message, res.ok ? 'success' : 'warning');
    return { ok: res.ok, message: res.message };
  }

  public sellMarketItem(itemId: string): { ok: boolean; message: string } {
    const res = sellItem(this.economy, itemId);
    this.economy = res.next;
    this.pushNotify(res.ok ? 'Venda Portuária' : 'Venda Indisponível', res.message, res.ok ? 'success' : 'warning');
    return { ok: res.ok, message: res.message };
  }

  public buyUpgrade(slot: keyof VesselUpgrades): { ok: boolean; message: string } {
    return this.buyExtendedUpgrade(slot);
  }

  public buyExtendedUpgrade(slot: keyof ExtendedVesselUpgrades): { ok: boolean; message: string } {
    const active = this.getActiveSurfaceVessel();
    const spec = getVesselSpecById(active.specId);
    if (slot === 'weaponLevel' && !spec.armedCapable) {
      return { ok: false, message: `${spec.name} não comporta montagem de armamento defensivo.` };
    }
    if (slot === 'sailRigLevel' && !spec.sailRigged) {
      return { ok: false, message: `${spec.name} não utiliza velame.` };
    }

    const maxLvl = slot === 'weaponLevel' ? 2 : 3;
    const curLvl = active.upgrades[slot];
    if (curLvl >= maxLvl) {
      return { ok: false, message: 'Melhoria já está no nível máximo.' };
    }

    const baseCostMap: Record<keyof ExtendedVesselUpgrades, number> = {
      engineLevel: 360,
      hullArmorLevel: 320,
      sailRigLevel: 340,
      cargoHoldLevel: 280,
      propellerLevel: 300,
      sonarLevel: 350,
      lightingLevel: 220,
      weaponLevel: 540,
    };
    const cost = baseCostMap[slot] * Math.max(1, curLvl + (slot === 'weaponLevel' ? 1 : 0));
    if (this.economy.credits < cost) {
      return { ok: false, message: `Créditos insuficientes (${this.economy.credits}/${cost} CR).` };
    }

    this.economy = { ...this.economy, credits: this.economy.credits - cost };
    active.upgrades[slot] = curLvl + 1;
    this.syncActiveVesselVisualsAndEconomy();
    this.grantXp('mechanics', 25);
    this.pushNotify('Oficina & Garagem', `Melhoria instalada (Nv. ${active.upgrades[slot]}) por ${cost} CR.`, 'success');
    return { ok: true, message: `Melhoria instalada (Nível ${active.upgrades[slot]}) por ${cost} CR.` };
  }

  public buyMarketplaceVessel(specId: string): { ok: boolean; message: string } {
    const spec = VESSEL_CATALOG.find((v) => v.id === specId);
    if (!spec) return { ok: false, message: 'Embarcação não encontrada.' };
    if (specId === 'nereid_s1' && this.ownedVessels.some((v) => v.specId === 'nereid_s1')) {
      return { ok: false, message: 'Você já possui o submersível NEREID S-1 na Garagem.' };
    }
    if (this.economy.credits < spec.priceCr) {
      return {
        ok: false,
        message: `Créditos insuficientes (${this.economy.credits} / ${spec.priceCr} CR).`,
      };
    }

    this.economy = { ...this.economy, credits: this.economy.credits - spec.priceCr };
    const created = createOwnedVesselFromSpec(spec, this.vesselSeq++);
    this.ownedVessels = [...this.ownedVessels, created];

    if (spec.id === 'nereid_s1') {
      const offX = this.portScene?.group.position.x ?? 0;
      const offZ = this.portScene?.group.position.z ?? 0;
      this.submarineCtrl.resetAt(24 + offX, -1.2, -19 + offZ, 180);
      this.submarineMesh.root.visible = true;
      this.pushNotify('NEREID S-1 Adquirido!', 'Submersível ancorado na Doca Norte do Porto.', 'success');
      return { ok: true, message: 'NEREID S-1 adquirido e liberado na Doca Norte!' };
    }

    this.activeVesselId = created.instanceId;
    this.syncActiveVesselVisualsAndEconomy();
    this.pushNotify('Embarcação Adquirida', `${spec.name} adicionada à Garagem Marítima!`, 'success');
    return { ok: true, message: `${spec.name} comprada e ativada no píer.` };
  }

  public sellOwnedVessel(instanceId: string): { ok: boolean; message: string } {
    if (this.ownedVessels.length <= 1) {
      return { ok: false, message: 'Você deve manter pelo menos uma embarcação na garagem.' };
    }
    if (instanceId === this.activeVesselId) {
      return { ok: false, message: 'Troque para outra embarcação ativa antes de vender esta.' };
    }
    const target = this.ownedVessels.find((v) => v.instanceId === instanceId);
    if (!target) return { ok: false, message: 'Embarcação não encontrada.' };
    if (target.specId === 'nereid_s1' && this.controlMode === 'submarine') {
      return { ok: false, message: 'Desembarque do NEREID S-1 antes de vendê-lo.' };
    }

    const spec = getVesselSpecById(target.specId);
    const refund = Math.round(spec.priceCr * 0.65);
    this.ownedVessels = this.ownedVessels.filter((v) => v.instanceId !== instanceId);
    this.economy = { ...this.economy, credits: this.economy.credits + refund };
    this.syncActiveVesselVisualsAndEconomy();
    this.pushNotify('Embarcação Vendida', `${target.customName} vendida por +${refund} CR.`, 'success');
    return { ok: true, message: `Vendida por +${refund} CR.` };
  }

  public switchActiveVessel(instanceId: string): { ok: boolean; message: string } {
    const target = this.ownedVessels.find((v) => v.instanceId === instanceId);
    if (!target) return { ok: false, message: 'Embarcação não encontrada.' };
    if (target.specId === 'nereid_s1') {
      this.enterSubmarineMode();
      return { ok: true, message: 'Controle alternado para NEREID S-1.' };
    }
    if (this.controlMode === 'sailing') {
      return { ok: false, message: 'Retorne ao cais/modo a pé para trocar sua embarcação principal.' };
    }
    this.activeVesselId = target.instanceId;
    this.syncActiveVesselVisualsAndEconomy();
    this.pushNotify('Embarcação Ativa', `${target.customName} posicionada no píer principal.`, 'info');
    return { ok: true, message: `${target.customName} selecionada.` };
  }

  public customizeActiveVessel(patch: {
    customName?: string;
    hullColorHex?: number;
    trimColorHex?: number;
  }): void {
    const active = this.getActiveSurfaceVessel();
    if (patch.customName !== undefined && patch.customName.trim()) {
      active.customName = patch.customName.trim().slice(0, 26);
    }
    if (patch.hullColorHex !== undefined) active.hullColorHex = patch.hullColorHex;
    if (patch.trimColorHex !== undefined) active.trimColorHex = patch.trimColorHex;
    this.syncActiveVesselVisualsAndEconomy();
    this.pushNotify('Personalização Aplicada', `Visual de ${active.customName} atualizado.`, 'success');
  }

  // --- Fishing Actions ---
  public toggleFishingMode(): void {
    if (this.phase !== 'playing') return;
    if (this.controlMode === 'fishing') {
      this.fishingSys.cancel();
      this.controlMode = this.fishingReturnMode;
      this.cameraCtrl.setMode(this.fishingReturnMode === 'sailing' ? 'chase' : 'thirdperson');
      this.callbacks.onCameraModeSync(this.cameraCtrl.mode);
      return;
    }

    if (this.controlMode !== 'on_foot' && this.controlMode !== 'sailing') {
      this.pushNotify('Pesca Indisponível', 'Suba no píer ou na embarcação para pescar.', 'warning');
      return;
    }
    if (this.controlMode === 'sailing' && this.telemetryScratch.speedKnots > 2.4) {
      this.pushNotify('Velocidade Alta', 'Reduza abaixo de 2.4 kts para lançar a vara de bordo.', 'warning');
      return;
    }

    this.fishingSys.syncEquipmentSelection(this.economy);
    if (this.fishingSys.equippedRodId === 'none') {
      this.pushNotify('Sem Vara de Pesca', 'Compre uma vara com a Clara na Loja do Porto.', 'warning');
      return;
    }

    this.fishingReturnMode = this.controlMode;
    if (this.controlMode === 'sailing') {
      this.controls.throttle = 0;
      this.controls.rudderTarget = 0;
    }
    this.controlMode = 'fishing';
    this.heldKeys.clear();
    this.cameraCtrl.setMode('thirdperson');
    this.callbacks.onCameraModeSync('thirdperson');
    this.pushNotify('Modo de Pesca Ativo', 'Segure Espaço ou o botão de arremesso para lançar a linha.', 'info');
  }

  public startFishingCharge(): void {
    if (this.controlMode !== 'fishing') return;
    this.fishingSys.startCharge();
  }

  public releaseFishingCast(): void {
    if (this.controlMode !== 'fishing' || !this.kaelCtrl) return;
    const isFishingBoat = getVesselSpecById(this.getActiveSurfaceVessel().specId).category === 'fishing';
    const rareSchool = this.dynamicEvents.activeEvent?.type === 'rare_school';
    const dirX = Math.sin(this.kaelCtrl.headingRad);
    const dirZ = Math.cos(this.kaelCtrl.headingRad);
    const res = this.fishingSys.releaseCast(
      this.kaelCtrl.position.x,
      this.kaelCtrl.position.y + 1.1,
      this.kaelCtrl.position.z,
      dirX,
      dirZ,
      this.physics.getSimTime(),
      this.params.ocean,
      this.economy,
      this.progression.fishing.level,
      isFishingBoat,
      rareSchool,
    );
    if (res.consumedBaitId) {
      this.economy = removeItemFromInventory(this.economy, res.consumedBaitId, 1);
      this.fishingSys.syncEquipmentSelection(this.economy);
    }
  }

  public triggerFishingHookOrReel(): void {
    if (this.controlMode !== 'fishing') return;
    const isFishingBoat = getVesselSpecById(this.getActiveSurfaceVessel().specId).category === 'fishing';
    this.fishingSys.hookOrActionPressed(this.economy, this.progression.fishing.level, isFishingBoat);
  }

  public selectFishingRod(rodId: string): void {
    this.fishingSys.selectRod(rodId);
  }

  public selectFishingBait(baitId: string): void {
    this.fishingSys.selectBait(baitId);
  }

  public sellAllFishCatches(): { soldCount: number; earnedCr: number; releasedProtected: number } {
    const res = this.fishingSys.sellAllCatches();
    if (res.earnedCr > 0) {
      this.economy = { ...this.economy, credits: this.economy.credits + res.earnedCr };
    }
    const msg =
      res.soldCount > 0 || res.releasedProtected > 0
        ? `Vendidos: ${res.soldCount} (+${res.earnedCr} CR)${res.releasedProtected > 0 ? ` · ${res.releasedProtected} devolvido(s) (Reserva)` : ''}`
        : 'Nenhum peixe no viveiro para vender.';
    this.pushNotify('Mercado de Pescado · Bento', msg, res.earnedCr > 0 ? 'success' : 'info');
    return res;
  }

  // --- Diving Flashlight ---
  public toggleDiveFlashlight(): void {
    if (!hasEquipment(this.economy, 'equip_dive_flashlight')) {
      this.pushNotify('Sem Lanterna Subaquática', 'Adquira a Lanterna LED na loja da Clara.', 'warning');
      return;
    }
    this.kaelCtrl.flashlightOn = !this.kaelCtrl.flashlightOn;
  }

  // --- Submarine NEREID S-1 Actions ---
  public enterSubmarineMode(): void {
    const subOwned = this.ownedVessels.some((v) => v.specId === 'nereid_s1');
    if (!subOwned) {
      this.pushNotify('Submersível Bloqueado', 'Adquira o NEREID S-1 na Concessionária Naval.', 'warning');
      return;
    }
    if (this.controlMode === 'submarine') return;
    if (this.controlMode === 'sailing') {
      this.controls.throttle = 0;
      this.controls.rudderTarget = 0;
      this.physics.setMoored(true, this.boatPos.x, this.boatPos.z);
      this.condition.moored = true;
    }
    const offX = this.portScene?.group.position.x ?? 0;
    const offZ = this.portScene?.group.position.z ?? 0;
    if (Math.hypot(this.submarineCtrl.position.x - offX, this.submarineCtrl.position.z - offZ) < 120 && this.submarineCtrl.position.y > -0.5) {
      this.submarineCtrl.resetAt(24 + offX, -1.5, -19 + offZ, 180);
    }
    this.controlMode = 'submarine';
    this.kaelCtrl?.setAboardMode(true);
    this.heldKeys.clear();
    this.cameraCtrl.setMode('chase');
    this.callbacks.onCameraModeSync('chase');
    this.pushNotify('NEREID S-1 Ativo', 'W/S: Propulsão · A/D: Leme · Q/E: Lastro/Profundidade · F: Faróis · R: Braço', 'info');
  }

  public exitSubmarineToPortOrSurface(): void {
    if (this.controlMode !== 'submarine' || !this.kaelCtrl) return;
    const offX = this.portScene?.group.position.x ?? 0;
    const offZ = this.portScene?.group.position.z ?? 0;
    const distPort = Math.hypot(this.submarineCtrl.position.x - offX, this.submarineCtrl.position.z - offZ);
    if (distPort < 110) {
      this.controlMode = 'on_foot';
      this.kaelCtrl.setAboardMode(false);
      this.kaelCtrl.teleportOnFoot(7.5 + offX, 1.08, -19 + offZ);
      this.cameraCtrl.setMode('thirdperson');
      this.callbacks.onCameraModeSync('thirdperson');
      this.pushNotify('Doca Norte', 'Você desembarcou do NEREID S-1 no Píer Norte.', 'info');
      return;
    }

    // At sea: transfer to active surface boat nearby or reposition boat safely beside submarine
    const distBoat = Math.hypot(this.submarineCtrl.position.x - this.boatPos.x, this.submarineCtrl.position.z - this.boatPos.z);
    if (distBoat > 40) {
      this.physics.resetVessel(this.submarineCtrl.position.x + 12, this.submarineCtrl.position.z, 180, false);
    }
    this.controlMode = 'sailing';
    this.kaelCtrl.setAboardMode(true);
    this.cameraCtrl.setMode('chase');
    this.callbacks.onCameraModeSync('chase');
    this.pushNotify('Superfície', 'Transferido de volta para sua embarcação principal.', 'info');
  }

  public toggleSubmarineHeadlights(): void {
    this.submarineCtrl.headlightsOn = !this.submarineCtrl.headlightsOn;
  }

  public triggerSubmarineArmCollect(): void {
    if (this.controlMode !== 'submarine') return;
    this.submarineCtrl.triggerArm();
    const node = this.underwaterScene.findNearestCollectible(
      this.submarineCtrl.position.x,
      this.submarineCtrl.position.y,
      this.submarineCtrl.position.z,
      9.5,
    );
    if (node) {
      const collected = this.underwaterScene.collectNode(node.id);
      if (collected) {
        const res = addItemToInventory(this.economy, collected.itemId, 1);
        if (res.ok) {
          this.economy = res.next;
          if (collected.itemId.startsWith('clue_') && !this.storyCluesFound.includes(collected.itemId)) {
            this.storyCluesFound.push(collected.itemId);
          }
          this.grantXp('submarine', 35);
          this.grantXp('exploration', 30);
          this.pushNotify('Braço Robótico · Recuperado', collected.label, 'success');
        } else {
          this.pushNotify('Compartimento Cheio', res.reason || 'Libere espaço no inventário.', 'warning');
        }
      }
    } else {
      this.pushNotify('Braço Robótico', 'Nenhum objeto recuperável dentro de 9.5 m.', 'info');
    }
  }

  // --- Maritime Combat & Alternatives ---
  public firePlayerCannon(): void {
    if (this.controlMode !== 'sailing') return;
    const active = this.getActiveSurfaceVessel();
    if (active.upgrades.weaponLevel <= 0) {
      this.pushNotify('Sem Armamento', 'Instale o Canhão Defensivo na Garagem/Concessionária.', 'warning');
      return;
    }
    const fired = this.pirateAI.firePlayerCannon(
      this.boatPos.x,
      this.boatPos.y,
      this.boatPos.z,
      this.telemetryScratch.headingDeg,
      active.upgrades.weaponLevel,
    );
    if (fired) {
      this.audio.playHullImpact(0.6);
    }
  }

  public payPirateBribe(): void {
    if (this.economy.credits < 120) {
      this.pushNotify('Créditos Insuficientes', 'Necessário 120 CR para negociar passagem segura.', 'warning');
      return;
    }
    const res = this.pirateAI.payIntimidationBribe(this.physics.getSimTime());
    if (res.paidCr > 0) {
      this.economy = { ...this.economy, credits: this.economy.credits - res.paidCr };
      this.pushNotify('Pedágio Negociado', `${res.targetName} recuou após pagamento de ${res.paidCr} CR.`, 'info');
    }
  }

  public extinguishDeckFires(): void {
    if (this.pirateAI.activeFiresOnPlayer <= 0) return;
    this.pirateAI.extinguishFires();
    this.grantXp('mechanics', 20);
    this.pushNotify('Incêndio Controlado', 'Tripulação apagou o fogo no convés.', 'success');
  }

  public callPortDistressHelp(): void {
    const offX = this.portScene?.group.position.x ?? 0;
    const offZ = this.portScene?.group.position.z ?? 0;
    const dist = Math.hypot(this.boatPos.x - offX, this.boatPos.z - offZ);
    if (dist <= 450) {
      this.pirateAI.payIntimidationBribe(this.physics.getSimTime());
      this.pushRadio('Capitania · Santos', 'VHF Ch.16', 'Patrulha costeira acionada! Embarcações hostis intimidadas na entrada da barra.');
    } else {
      this.pushRadio('Capitania · Santos', 'VHF Ch.16', 'Fora do alcance de escolta imediata (>450 m). Use velocidade ou neblina!');
    }
  }

  public useInventoryItem(itemId: string): { ok: boolean; message: string } {
    if (itemId !== 'equip_repair_kit') {
      return { ok: false, message: 'Este item é passivo ou carga.' };
    }
    const qty = this.economy.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0;
    if (qty <= 0) {
      return { ok: false, message: 'Nenhum Kit de Reparo disponível.' };
    }
    this.economy = removeItemFromInventory(this.economy, itemId, 1);
    this.condition.subsystems = {
      hullPct: Math.min(100, this.condition.subsystems.hullPct + 25),
      enginePct: Math.min(100, this.condition.subsystems.enginePct + 20),
      rudderPct: Math.min(100, this.condition.subsystems.rudderPct + 15),
      mastPct: Math.min(100, this.condition.subsystems.mastPct + 15),
      sailsPct: Math.min(100, this.condition.subsystems.sailsPct + 15),
    };
    this.condition.hullIntegrityPct = computeOverallHullIntegrity(this.condition.subsystems);
    this.pushNotify('Reparo de Emergência', 'Subsistemas restaurados parcialmente em alto-mar.', 'success');
    return { ok: true, message: 'Kit aplicado: +25% Casco e +20% Motor.' };
  }

  public repairSubsystemsWithCredits(): { ok: boolean; message: string } {
    const cost = calculateFullRepairCost(this.condition.subsystems);
    if (cost <= 0) {
      return { ok: true, message: 'Todos os subsistemas já estão a 100%.' };
    }
    if (this.economy.credits < cost) {
      return { ok: false, message: `Créditos insuficientes (${this.economy.credits}/${cost} CR).` };
    }
    this.economy = { ...this.economy, credits: this.economy.credits - cost };
    this.condition.subsystems = repairAllSubsystems();
    this.condition.hullIntegrityPct = 100;
    this.pushNotify('Oficina Naval', `Aster S-01 reparado por ${cost} CR.`, 'success');
    return { ok: true, message: `Reparos completos por ${cost} CR.` };
  }

  public refuelWithCredits(): { ok: boolean; message: string } {
    const missing = Math.max(0, 100 - this.condition.fuelPct);
    const cost = Math.max(0, Math.round(missing * 0.8));
    if (missing < 1 && this.condition.batteryPct >= 99) {
      return { ok: true, message: 'Tanques e baterias já estão cheios.' };
    }
    if (this.economy.credits < cost) {
      return { ok: false, message: `Créditos insuficientes (${this.economy.credits}/${cost} CR).` };
    }
    this.economy = { ...this.economy, credits: this.economy.credits - cost };
    this.condition.fuelPct = 100;
    this.condition.batteryPct = 100;
    this.pushNotify('Posto de Abastecimento', `Diesel e carga elétrica completados (${cost} CR).`, 'success');
    return { ok: true, message: `Tanque completo por ${cost} CR.` };
  }

  public refuelAndRepair(): void {
    this.condition.fuelPct = 100;
    this.condition.batteryPct = 100;
    this.condition.subsystems = repairAllSubsystems();
    this.condition.hullIntegrityPct = 100;
  }

  public acceptMission(missionId: string): { ok: boolean; message: string } {
    const res = acceptMissionById(this.campaignMissions, missionId);
    if (!res.accepted) {
      return { ok: false, message: res.error || 'Não foi possível aceitar.' };
    }
    this.campaignMissions = res.next;

    // Grant required mission cargo if applicable
    const reqCargo = res.accepted.waypoints[0]?.requiresCargoId;
    if (reqCargo) {
      const hasCargo = this.economy.inventory.some((e) => e.itemId === reqCargo);
      if (!hasCargo) {
        const added = addItemToInventory(this.economy, reqCargo, 1);
        if (added.ok) this.economy = added.next;
      }
    }

    this.pushRadio(
      res.accepted.giverNpc,
      'Canal 16 · Capitania',
      `Contrato ativo: ${res.accepted.title}. ${res.accepted.objectiveText}`,
    );
    this.pushNotify('Missão Aceita', res.accepted.title, 'info');
    return { ok: true, message: `Missão "${res.accepted.title}" iniciada.` };
  }

  public cancelMission(missionId: string): void {
    this.campaignMissions = cancelMissionById(this.campaignMissions, missionId);
    this.pushNotify('Missão Cancelada', 'Contrato removido do rastreador ativo.', 'warning');
  }

  // --- Vessel / Water / Terrestrial Transitions ---
  public resetVessel(x = 0, z = 0, headingDeg = 0): void {
    if (!this.physics) return;
    this.physics.resetVessel(x, z, headingDeg, false);
    this.condition.moored = false;
    this.controlMode = 'sailing';
    this.kaelCtrl?.setAboardMode(true);
    this.cameraCtrl.setMode('topdown');
    this.callbacks.onCameraModeSync('topdown');
    this.cameraCtrl.resetFreeOffset();
  }

  public resetToPort(): void {
    if (!this.physics || !this.kaelCtrl) return;
    this.controls.throttle = 0;
    this.controls.rudderTarget = 0;
    this.controls.sailArea = 0;
    this.physics.resetVessel(
      this.initialMooringX,
      this.initialMooringZ,
      MOOR_HEADING_DEG,
      true,
    );
    this.condition.moored = true;
    this.controlMode = 'on_foot';
    this.kaelCtrl.setAboardMode(false);
    this.kaelCtrl.teleportOnFoot(
      KAEL_SPAWN.x - this.geoWorld.floatingOffsetX,
      KAEL_SPAWN.y,
      KAEL_SPAWN.z - this.geoWorld.floatingOffsetZ,
      KAEL_SPAWN.headingRad,
    );
    this.cameraCtrl.setMode('thirdperson');
    this.callbacks.onCameraModeSync('thirdperson');
  }

  public enterWaterFromVessel(): void {
    if (this.controlMode !== 'sailing' || !this.kaelCtrl) return;
    if (this.telemetryScratch.speedKnots > 2.2) {
      this.pushNotify('Velocidade Alta', 'Reduza abaixo de 2.2 kts para saltar na água.', 'warning');
      return;
    }
    this.controls.throttle = 0;
    this.controls.rudderTarget = 0;
    this.physics.setMoored(true, this.boatPos.x, this.boatPos.z);
    this.condition.moored = true;

    // Enter water 3.4m to starboard/port beside ladder
    const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.boatQuat);
    const ex = this.boatPos.x + side.x * 3.5;
    const ez = this.boatPos.z + side.z * 3.5;

    this.kaelCtrl.setAboardMode(false);
    this.kaelCtrl.enterWaterAt(ex, ez, this.physics.getSimTime(), this.params.ocean);
    this.controlMode = 'swimming';
    this.heldKeys.clear();
    this.cameraCtrl.setMode('thirdperson');
    this.callbacks.onCameraModeSync('thirdperson');
    this.pushNotify('Na Água', 'Use C para mergulhar, Espaço para subir e E perto do barco para reembarcar.', 'info');
  }

  public triggerInteraction(): void {
    if (this.phase !== 'playing' || !this.currentPrompt) return;
    if (this.currentPrompt.blockedReason) return;

    const id = this.currentPrompt.id;
    if (id === 'board_vessel') {
      this.boardVessel();
    } else if (id === 'disembark_vessel') {
      this.disembarkVessel();
    } else if (id === 'enter_water') {
      this.enterWaterFromVessel();
    } else if (id === 'dive_collect' && this.currentPrompt.targetId) {
      const collected = this.underwaterScene.collectNode(this.currentPrompt.targetId);
      if (collected) {
        const res = addItemToInventory(this.economy, collected.itemId, 1);
        if (res.ok) {
          this.economy = res.next;
          if (collected.itemId.startsWith('clue_') && !this.storyCluesFound.includes(collected.itemId)) {
            this.storyCluesFound.push(collected.itemId);
          }
          this.pushNotify('Item Recuperado', collected.label, 'success');
        } else {
          this.pushNotify('Porão Cheio', res.reason || 'Libere espaço no inventário.', 'warning');
        }
      }
    } else if (id === 'port_map') {
      this.callbacks.onToggleMap();
    } else {
      this.callbacks.onOpenInteraction(id);
    }
  }

  public boardVessel(): void {
    if (this.controlMode === 'sailing' || !this.kaelCtrl) return;
    this.controlMode = 'sailing';
    this.kaelCtrl.setAboardMode(true);
    this.kaelCtrl.triggerBoardAnim();
    this.heldKeys.clear();
    if (this.cameraCtrl.mode === 'thirdperson' || this.cameraCtrl.mode === 'underwater') {
      this.cameraCtrl.setMode('chase');
      this.callbacks.onCameraModeSync('chase');
    }
  }

  public disembarkVessel(): void {
    if (this.controlMode === 'on_foot' || !this.kaelCtrl || !this.portScene) return;
    const dockPoint = this.findNearestSafeDisembarkPoint();
    if (!dockPoint || this.telemetryScratch.speedKnots >= 2.5) return;

    this.controls.throttle = 0;
    this.controls.rudderTarget = 0;
    this.physics.setMoored(true, this.boatPos.x, this.boatPos.z);
    this.condition.moored = true;

    this.controlMode = 'on_foot';
    this.kaelCtrl.teleportOnFoot(dockPoint.x, dockPoint.zone.surfaceY, dockPoint.z);
    this.kaelCtrl.setAboardMode(false);
    this.kaelCtrl.triggerBoardAnim();
    this.heldKeys.clear();

    if (
      this.cameraCtrl.mode === 'chase' ||
      this.cameraCtrl.mode === 'inspect' ||
      this.cameraCtrl.mode === 'underwater'
    ) {
      this.cameraCtrl.setMode('thirdperson');
      this.callbacks.onCameraModeSync('thirdperson');
    }
  }

  private findNearestSafeDisembarkPoint(): {
    x: number;
    z: number;
    dist: number;
    zone: SafeDisembarkZone;
  } | null {
    if (!this.portScene) return null;
    const offX = this.portScene.group.position.x;
    const offZ = this.portScene.group.position.z;
    const refX = this.controlMode === 'swimming' ? this.kaelCtrl.position.x : this.boatPos.x;
    const refZ = this.controlMode === 'swimming' ? this.kaelCtrl.position.z : this.boatPos.z;
    let best: { x: number; z: number; dist: number; zone: SafeDisembarkZone } | null = null;

    for (const zZone of this.portScene.safeZones) {
      const worldMinX = zZone.minX + offX;
      const worldMaxX = zZone.maxX + offX;
      const worldMinZ = zZone.minZ + offZ;
      const worldMaxZ = zZone.maxZ + offZ;

      const cx = THREE.MathUtils.clamp(refX, worldMinX + 0.8, worldMaxX - 0.8);
      const cz = THREE.MathUtils.clamp(refZ, worldMinZ + 0.8, worldMaxZ - 0.8);
      const dist = Math.hypot(refX - cx, refZ - cz);
      if (dist <= 6.8 && (!best || dist < best.dist)) {
        best = { x: cx, z: cz, dist, zone: zZone };
      }
    }
    return best;
  }

  private evaluateActivePrompt(): ActivePrompt | null {
    if (this.phase !== 'playing' || !this.kaelCtrl || !this.portScene) return null;

    if (this.controlMode === 'swimming' || this.controlMode === 'diving') {
      // 1. Check underwater collectible nodes
      const node = this.underwaterScene.findNearestCollectible(
        this.kaelCtrl.position.x,
        this.kaelCtrl.position.y,
        this.kaelCtrl.position.z,
        4.8,
      );
      if (node) {
        return {
          id: 'dive_collect',
          keyLabel: 'E',
          label: `Pressione E · Recolher ${node.label}`,
          sublabel: 'Recuperação Subaquática',
          targetId: node.id,
        };
      }

      // 2. Check proximity to Aster S-01 boarding ladder
      const distBoat = Math.hypot(
        this.boatPos.x - this.kaelCtrl.position.x,
        this.boatPos.z - this.kaelCtrl.position.z,
      );
      if (distBoat <= 6.2 && !this.kaelCtrl.underwater) {
        return {
          id: 'board_vessel',
          keyLabel: 'E',
          label: 'Pressione E para embarcar pela escada',
          sublabel: 'Aster S-01',
        };
      }

      // 3. Check pier ladder return to quay
      const nearPier = this.findNearestSafeDisembarkPoint();
      if (nearPier && !this.kaelCtrl.underwater) {
        return {
          id: 'disembark_vessel',
          keyLabel: 'E',
          label: 'Pressione E para subir ao Píer',
          sublabel: nearPier.zone.name,
        };
      }
      return null;
    }

    if (this.controlMode === 'on_foot') {
      this.helmWorldPos.set(0.45, 1.0, 4.18).applyQuaternion(this.boatQuat).add(this.boatPos);
      const distBoat = Math.min(
        Math.hypot(this.boatPos.x - this.kaelCtrl.position.x, this.boatPos.z - this.kaelCtrl.position.z),
        Math.hypot(this.helmWorldPos.x - this.kaelCtrl.position.x, this.helmWorldPos.z - this.kaelCtrl.position.z),
      );
      if (distBoat <= 6.0) {
        return {
          id: 'board_vessel',
          keyLabel: 'E',
          label: 'Pressione E para embarcar',
          sublabel: 'Aster S-01 · Assumir o leme',
        };
      }

      const offX = this.portScene.group.position.x;
      const offZ = this.portScene.group.position.z;
      for (const inter of this.portScene.interactables) {
        const d = Math.hypot(inter.x + offX - this.kaelCtrl.position.x, inter.z + offZ - this.kaelCtrl.position.z);
        if (d <= inter.radius) {
          return {
            id: inter.id,
            keyLabel: 'E',
            label: `Pressione E · ${inter.label}`,
            sublabel: inter.sublabel,
          };
        }
      }
      return null;
    }

    // Sailing mode
    const nearPier = this.findNearestSafeDisembarkPoint();
    if (nearPier) {
      const tooFast = this.telemetryScratch.speedKnots >= 2.5;
      return {
        id: 'disembark_vessel',
        keyLabel: 'E',
        label: tooFast ? 'Aproximando do Píer' : 'Pressione E para desembarcar',
        sublabel: nearPier.zone.name,
        blockedReason: tooFast
          ? 'Reduza a velocidade (< 2.5 kts) para desembarcar com segurança.'
          : undefined,
      };
    }

    // Prompt dive overboard near dive sites when slow
    const offU = this.underwaterScene.group.position;
    const nearDiveSite =
      Math.hypot(this.boatPos.x - (45 + offU.x), this.boatPos.z - (55 + offU.z)) < 38 ||
      Math.hypot(this.boatPos.x - (-145 + offU.x), this.boatPos.z - (290 + offU.z)) < 42 ||
      Math.hypot(this.boatPos.x - (-210 + offU.x), this.boatPos.z - (520 + offU.z)) < 48;
    if (nearDiveSite && this.telemetryScratch.speedKnots < 2.2) {
      return {
        id: 'enter_water',
        keyLabel: 'U',
        label: 'Pressione U para mergulhar na água',
        sublabel: 'Área de Mergulho detectada · C para descer / Espaço para subir',
      };
    }

    return null;
  }

  private processHeldInputs(dt: number, simTime: number): void {
    if (this.phase !== 'playing') return;

    let freeFwd = 0;
    let freeRight = 0;
    if (this.heldKeys.has('ArrowUp')) freeFwd += 1;
    if (this.heldKeys.has('ArrowDown')) freeFwd -= 1;
    if (this.heldKeys.has('ArrowRight')) freeRight += 1;
    if (this.heldKeys.has('ArrowLeft')) freeRight -= 1;
    if (freeFwd !== 0 || freeRight !== 0) {
      this.cameraCtrl.panFree(freeFwd, freeRight, dt);
    }

    if (this.controlMode === 'on_foot') {
      let fwd = 0;
      let right = 0;
      if (this.heldKeys.has('KeyW')) fwd += 1;
      if (this.heldKeys.has('KeyS')) fwd -= 1;
      if (this.heldKeys.has('KeyD')) right += 1;
      if (this.heldKeys.has('KeyA')) right -= 1;
      const sprint = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

      const stepRes = this.kaelCtrl.stepOnFoot(
        dt,
        {
          forward: fwd,
          right,
          sprint,
          jumpPressed: this.jumpQueued,
          cameraYaw: this.cameraCtrl.getYaw(),
        },
        simTime,
        this.params.ocean,
      );
      this.jumpQueued = false;
      if (stepRes.enteredWater) {
        this.controlMode = 'swimming';
        this.pushNotify('Entrou na Água', 'Nade com WASD, pressione C para mergulhar.', 'info');
      }
      return;
    }

    if (this.controlMode === 'swimming' || this.controlMode === 'diving') {
      let fwd = 0;
      let right = 0;
      if (this.heldKeys.has('KeyW')) fwd += 1;
      if (this.heldKeys.has('KeyS')) fwd -= 1;
      if (this.heldKeys.has('KeyD')) right += 1;
      if (this.heldKeys.has('KeyA')) right -= 1;
      const sprint = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
      const ascend = this.heldKeys.has('Space');
      const descend = this.heldKeys.has('KeyC');

      const hasMask = hasEquipment(this.economy, 'equip_diver_mask');
      const hasTank = hasEquipment(this.economy, 'equip_scuba_tank');
      const hasComputer = hasEquipment(this.economy, 'equip_dive_computer');
      const prevUnderwater = this.kaelCtrl.underwater;

      const waterRes = this.kaelCtrl.stepInWater(
        dt,
        simTime,
        this.params.ocean,
        {
          forward: fwd,
          right,
          sprint,
          jumpPressed: false,
          ascendHeld: ascend,
          descendHeld: descend,
          cameraYaw: this.cameraCtrl.getYaw(),
        },
        hasMask,
        hasTank,
        hasComputer,
        this.progression.diving.level,
      );

      this.controlMode = this.kaelCtrl.underwater ? 'diving' : 'swimming';
      if (this.kaelCtrl.underwater && !prevUnderwater) {
        this.cameraCtrl.setMode('underwater');
        this.callbacks.onCameraModeSync('underwater');
      } else if (!this.kaelCtrl.underwater && prevUnderwater) {
        this.cameraCtrl.setMode('thirdperson');
        this.callbacks.onCameraModeSync('thirdperson');
      }
      if (waterRes.oxygenDepleted) {
        this.pushNotify('Oxigênio Crítico!', 'Subida de emergência à superfície.', 'danger');
      }
      return;
    }

    if (this.controlMode === 'fishing') {
      const isFishingBoat = getVesselSpecById(this.getActiveSurfaceVessel().specId).category === 'fishing';
      const holdingSpace = this.heldKeys.has('Space');
      const fRes = this.fishingSys.step(
        dt,
        simTime,
        this.kaelCtrl.position.x,
        this.kaelCtrl.position.y + 1.1,
        this.kaelCtrl.position.z,
        this.params.ocean,
        this.params.weather,
        this.atmosphere.nightFactor,
        this.economy,
        this.progression.fishing.level,
        isFishingBoat,
        holdingSpace,
        holdingSpace,
      );
      if (fRes.justBit) {
        this.audio.playAlertBeep();
      }
      if (fRes.justCaught) {
        this.grantXp('fishing', fRes.justCaught.protectedSpecies ? 20 : 38);
        this.pushNotify(
          'Peixe Capturado!',
          `${fRes.justCaught.speciesName} (${fRes.justCaught.weightKg.toFixed(1)} kg · ${fRes.justCaught.quality})`,
          'success',
        );
      } else if (fRes.justLost) {
        this.pushNotify('Peixe Escapou', fRes.justLost, 'warning');
      }
      return;
    }

    if (this.controlMode === 'submarine') {
      const subOwned = this.ownedVessels.find((v) => v.specId === 'nereid_s1');
      const sonarLevel = subOwned?.upgrades.sonarLevel ?? 1;
      const propLevel = subOwned?.upgrades.propellerLevel ?? 1;
      let throttle = 0;
      let steer = 0;
      if (this.heldKeys.has('KeyW')) throttle += 1;
      if (this.heldKeys.has('KeyS')) throttle -= 0.7;
      if (this.heldKeys.has('KeyD')) steer += 1;
      if (this.heldKeys.has('KeyA')) steer -= 1;
      const ascend = this.heldKeys.has('KeyQ') || this.heldKeys.has('Space');
      const descend = this.heldKeys.has('KeyE') || this.heldKeys.has('KeyC');

      const targets: SonarSceneObject[] = [
        ...this.underwaterScene.getSonarSceneTargets(),
        {
          id: 'sonar_player_vessel',
          label: this.getActiveSurfaceVessel().customName,
          kind: 'vessel',
          x: this.boatPos.x,
          y: this.boatPos.y,
          z: this.boatPos.z,
        },
        ...this.trafficMgr.getSnapshots().map((n) => ({
          id: `sonar_npc_${n.id}`,
          label: n.name,
          kind: 'vessel' as const,
          x: n.x,
          y: 0,
          z: n.z,
        })),
        ...this.pirateAI.getPirateSnapshots(this.submarineCtrl.position.x, this.submarineCtrl.position.z).map((p) => ({
          id: `sonar_pir_${p.id}`,
          label: p.name,
          kind: 'pirate' as const,
          x: p.x,
          y: 0,
          z: p.z,
        })),
      ];
      const floorY = this.underwaterScene.getSeabedFloorYAt(
        this.submarineCtrl.position.x,
        this.submarineCtrl.position.z,
      );
      const subRes = this.submarineCtrl.step(
        dt,
        simTime,
        this.params.ocean,
        { throttle, steer, ascend, descend },
        sonarLevel,
        propLevel,
        this.progression.submarine.level,
        targets,
        floorY + 1.1,
      );
      if (subRes.crushWarning && Math.floor(simTime * 2) % 4 === 0) {
        this.pushNotify('Pressão Crítica!', 'Submersível acima da profundidade segura de 85 m!', 'danger');
      }
      return;
    }

    // Sailing mode: preserve all 0.3 / 0.4 Aster S-01 controls
    if (this.heldKeys.has('KeyW')) {
      this.controls.throttle = Math.min(1.0, this.controls.throttle + dt * 0.55);
    } else if (this.heldKeys.has('KeyS')) {
      this.controls.throttle = Math.max(-0.5, this.controls.throttle - dt * 0.65);
    }

    if (this.heldKeys.has('KeyD')) {
      this.controls.rudderTarget = Math.min(1.0, this.controls.rudderTarget + dt * 1.9);
    } else if (this.heldKeys.has('KeyA')) {
      this.controls.rudderTarget = Math.max(-1.0, this.controls.rudderTarget - dt * 1.9);
    } else {
      this.controls.rudderTarget *= Math.exp(-1.1 * dt);
    }

    if (this.heldKeys.has('KeyQ')) {
      this.controls.sailTrim = Math.max(0.08, this.controls.sailTrim - dt * 0.45);
    } else if (this.heldKeys.has('KeyE')) {
      this.controls.sailTrim = Math.min(1.0, this.controls.sailTrim + dt * 0.45);
    }

    if (this.heldKeys.has('KeyR')) {
      this.controls.sailArea = Math.min(1.0, this.controls.sailArea + dt * 0.4);
    } else if (this.heldKeys.has('KeyF')) {
      this.controls.sailArea = Math.max(0.0, this.controls.sailArea - dt * 0.4);
    }

    if (Math.abs(this.controls.throttle) > 0.05) {
      if (this.condition.fuelPct > 0) {
        this.condition.fuelPct = Math.max(
          0,
          this.condition.fuelPct - Math.abs(this.controls.throttle) * 0.2 * dt,
        );
      } else {
        this.controls.throttle = 0;
      }
    }

    if (this.condition.moored && (Math.abs(this.controls.throttle) > 0.08 || this.controls.sailArea > 0.3)) {
      this.condition.moored = false;
      this.physics.setMoored(false);
    }
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const frameStart = performance.now();
    const rawDt = Math.max(0.001, (frameStart - this.lastNow) / 1000);
    this.lastNow = frameStart;
    const dt = Math.min(rawDt, 0.05);
    const now = frameStart;

    const instantFps = 1 / rawDt;
    this.fpsEma = this.fpsEma * 0.92 + instantFps * 0.08;

    if (!this.contextLost && this.physics) {
      const preTime = this.physics.getSimTime();
      const modifiers = computeVesselModifiers(this.condition.subsystems, this.economy.upgrades);

      if (this.phase !== 'paused') {
        this.processHeldInputs(dt, preTime);
        stepAtmosphere(this.atmosphere, this.params.weather, dt, this.params.lighting ?? 'auto');

        this.accumulator += dt;
        let substeps = 0;
        while (this.accumulator >= FIXED_DT && substeps < 4) {
          this.physics.step(
            FIXED_DT,
            this.params.ocean,
            this.params.wind,
            this.params.vessel,
            this.controls,
            modifiers,
          );
          this.accumulator -= FIXED_DT;
          substeps++;
        }
      }

      this.physics.getPose(this.boatPos, this.boatQuat);
      this.boatForward.set(0, 0, -1).applyQuaternion(this.boatQuat).normalize();
      this.boatEuler.setFromQuaternion(this.boatQuat, 'YXZ');
      const headingRad = -this.boatEuler.y;
      const simTime = this.physics.getSimTime();

      // Vessel collision vs Port Quay/Piers & Grounding & Weather Wear when playing & sailing
      if (this.phase === 'playing' && !this.condition.moored) {
        const portHit = this.portScene.checkVesselCollision(this.boatPos.x, this.boatPos.z, 2.35);
        if (portHit.hit) {
          const imp = this.physics.applyExternalBump(portHit.pushX, portHit.pushZ);
          if (imp > 1.25) {
            const dmg = applyCollisionDamage(this.condition.subsystems, imp, this.economy.upgrades.hullArmorLevel);
            this.condition.subsystems = dmg.next;
            this.condition.hullIntegrityPct = computeOverallHullIntegrity(dmg.next);
            if (now - this.lastCollisionAudioMs > 700) {
              this.lastCollisionAudioMs = now;
              this.audio.playHullImpact(Math.min(1, imp / 5));
              if (dmg.hullDelta > 0.3) {
                this.pushNotify('Colisão no Cais', `Casco -${dmg.hullDelta.toFixed(1)}% · Leme -${dmg.rudderDelta.toFixed(1)}%`, 'danger');
              }
            }
          }
          this.physics.getPose(this.boatPos, this.boatQuat);
        }

        if (this.portScene.isWaterShallow(this.boatPos.x, this.boatPos.z)) {
          this.condition.subsystems = applyGroundingDamage(
            this.condition.subsystems,
            dt,
            this.telemetryScratch.speedMs,
            this.economy.upgrades.hullArmorLevel,
          );
          this.condition.hullIntegrityPct = computeOverallHullIntegrity(this.condition.subsystems);
          this.groundingNoticeCooldown -= dt;
          if (this.groundingNoticeCooldown <= 0) {
            this.groundingNoticeCooldown = 5.0;
            this.pushNotify('Águas Rasas / Encalhamento', 'Recue imediatamente para o canal profundo!', 'danger');
          }
        }

        const prevWear = this.condition.subsystems;
        this.condition.subsystems = applyWeatherAndUsageWear(
          prevWear,
          dt,
          this.params.weather,
          this.controls.sailArea,
          this.controls.throttle,
          this.economy.upgrades,
        );
        if (this.condition.subsystems !== prevWear) {
          this.condition.hullIntegrityPct = computeOverallHullIntegrity(this.condition.subsystems);
        }
      }

      // Maritime Traffic Simulation & NPC Vessel Collision check
      if (this.phase !== 'paused') {
        this.trafficMgr.step(dt, this.boatPos.x, this.boatPos.z);
      }
      const npcSnapshots = this.trafficMgr.getSnapshots();
      if (this.phase === 'playing' && !this.condition.moored) {
        for (const npc of npcSnapshots) {
          const dx = this.boatPos.x - npc.x;
          const dz = this.boatPos.z - npc.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 7.2 && dist > 0.01) {
            const overlap = 7.2 - dist;
            const imp = this.physics.applyExternalBump((dx / dist) * overlap, (dz / dist) * overlap);
            if (imp > 1.1) {
              const dmg = applyCollisionDamage(this.condition.subsystems, imp, this.economy.upgrades.hullArmorLevel);
              this.condition.subsystems = dmg.next;
              this.condition.hullIntegrityPct = computeOverallHullIntegrity(dmg.next);
              if (now - this.lastCollisionAudioMs > 800) {
                this.lastCollisionAudioMs = now;
                this.audio.playHullImpact(0.75);
                this.pushNotify(`Colisão com ${npc.name}`, `Avaria no casco (-${dmg.hullDelta.toFixed(1)}%).`, 'danger');
              }
            }
          }
        }
      }

      // Sync Kael at helm when sailing or fishing from boat
      if (this.controlMode === 'sailing' || (this.controlMode === 'fishing' && this.fishingReturnMode === 'sailing')) {
        this.kaelCtrl.syncAboardVessel(
          this.phase === 'paused' ? 0 : dt,
          this.boatPos,
          this.boatQuat,
          this.boatEuler.y,
        );
      }

      this.kaelRig.root.position.copy(this.kaelCtrl.position);
      this.kaelRig.root.rotation.y = this.kaelCtrl.headingRad;
      this.kaelRig.updateAnimation(
        this.phase === 'paused' ? 0 : dt,
        simTime,
        this.kaelCtrl.animState,
        this.kaelCtrl.horizontalSpeed,
        this.controls.rudderTarget,
      );

      // Update Port, Underwater Area, Fishing Visuals, Submarine, and Maritime Traffic 3D Visuals
      this.portScene.update(
        this.phase === 'paused' ? 0 : dt,
        simTime,
        this.params.ocean,
        this.mission.step !== 'completed',
        this.atmosphere.nightFactor,
      );
      this.underwaterScene.update(simTime, this.params.ocean);

      this.fishingVisuals.update(
        this.controlMode === 'fishing',
        simTime,
        this.kaelCtrl.position,
        this.kaelCtrl.headingRad,
        this.fishingSys.getSnapshot(),
      );

      if (this.diveSpotLight) {
        const diveLightOn = this.controlMode === 'diving' && this.kaelCtrl.flashlightOn;
        this.diveSpotLight.intensity = diveLightOn ? 10.5 : 0.0;
        if (diveLightOn) {
          this.diveSpotLight.position.set(
            this.kaelCtrl.position.x,
            this.kaelCtrl.position.y + 1.35,
            this.kaelCtrl.position.z,
          );
          this.diveSpotLight.target.position.set(
            this.kaelCtrl.position.x + Math.sin(this.kaelCtrl.headingRad) * 10,
            this.kaelCtrl.position.y + 0.5,
            this.kaelCtrl.position.z + Math.cos(this.kaelCtrl.headingRad) * 10,
          );
        }
      }

      const subUnlocked = this.ownedVessels.some((v) => v.specId === 'nereid_s1');
      if (subUnlocked) {
        this.submarineMesh.root.visible = true;
        this.submarineMesh.update(
          this.phase === 'paused' ? 0 : dt,
          simTime,
          this.submarineCtrl.position.x,
          this.submarineCtrl.position.y,
          this.submarineCtrl.position.z,
          this.submarineCtrl.headingRad,
          this.submarineCtrl.pitchRad,
          this.submarineCtrl.rollRad,
          Math.hypot(this.submarineCtrl.velocity.x, this.submarineCtrl.velocity.z) * 1.94,
          this.submarineCtrl.headlightsOn,
          this.submarineCtrl.armBusy,
        );
      }

      // Dynamic Ocean Events update
      if (this.phase === 'playing') {
        const completedCount = this.campaignMissions.filter((m) => m.status === 'completed').length;
        const evtRes = this.dynamicEvents.step(
          simTime,
          this.boatPos.x,
          this.boatPos.z,
          this.telemetryScratch.headingDeg,
          this.params.weather,
          this.condition.subsystems.enginePct,
          completedCount,
          hasEquipment(this.economy, 'equip_vhf_scanner'),
        );
        if (evtRes.spawned) {
          this.pushRadio(
            'Rádio Costeiro · Santos',
            'VHF Ch.16',
            `${evtRes.spawned.title}: ${evtRes.spawned.description}`,
            evtRes.spawned.type === 'distress_call' ||
              evtRes.spawned.type === 'squall_storm' ||
              evtRes.spawned.type === 'pirates_spotted',
          );
          this.pushNotify(evtRes.spawned.title, evtRes.spawned.description, 'warning');
          if (evtRes.applyWeatherSquall) {
            this.applyWeatherPreset('rain');
            this.callbacks.onParamsChanged(structuredClone(this.params));
          }
          if (evtRes.applyMechanicalFault) {
            this.condition.subsystems = {
              ...this.condition.subsystems,
              enginePct: Math.max(15, this.condition.subsystems.enginePct - 18),
            };
            this.condition.hullIntegrityPct = computeOverallHullIntegrity(this.condition.subsystems);
          }
        }
        if (evtRes.resolved) {
          this.economy = { ...this.economy, credits: this.economy.credits + evtRes.resolved.rewardCredits };
          let extra = `+${evtRes.resolved.rewardCredits} CR`;
          if (evtRes.resolved.rewardItemId) {
            const added = addItemToInventory(this.economy, evtRes.resolved.rewardItemId, 1);
            if (added.ok) {
              this.economy = added.next;
              extra += ` · +1 ${ITEM_CATALOG[evtRes.resolved.rewardItemId]?.name || 'Carga'}`;
            }
          }
          this.grantXp('exploration', 25);
          this.pushNotify(`Evento Concluído: ${evtRes.resolved.title}`, extra, 'success');
        }
      }

      this.trafficRenderer.update(
        simTime,
        this.params.ocean,
        npcSnapshots,
        this.dynamicEvents.activeEvent,
        this.atmosphere.nightFactor,
      );

      // Step Pirate AI & Maritime Combat
      const offXPre = this.portScene.group.position.x;
      const offZPre = this.portScene.group.position.z;
      const activeVessel = this.getActiveSurfaceVessel();
      if (this.phase === 'playing') {
        const isSafeFromPirates =
          this.controlMode === 'on_foot' ||
          this.controlMode === 'submarine' ||
          this.controlMode === 'diving';
        const pRes = this.pirateAI.step(
          dt,
          simTime,
          this.boatPos.x,
          this.boatPos.z,
          offXPre,
          offZPre,
          isSafeFromPirates,
          this.fog.density,
          this.atmosphere.nightFactor,
          this.atmosphere.rainIntensity,
          activeVessel.upgrades.hullArmorLevel,
        );
        if (pRes.alertTriggered) {
          this.pushRadio('Alarme Radar · Canal Externo', 'VHF', pRes.alertTriggered, true);
          this.pushNotify('Ameaça Detectada', pRes.alertTriggered, 'danger');
        }
        if (pRes.hullDamage > 0) {
          this.condition.subsystems = {
            hullPct: Math.max(10, this.condition.subsystems.hullPct - pRes.hullDamage),
            enginePct: Math.max(10, this.condition.subsystems.enginePct - pRes.engineDamage),
            rudderPct: Math.max(18, this.condition.subsystems.rudderPct - pRes.rudderDamage),
            mastPct: this.condition.subsystems.mastPct,
            sailsPct: Math.max(20, this.condition.subsystems.sailsPct - pRes.sailDamage),
          };
          this.condition.hullIntegrityPct = computeOverallHullIntegrity(this.condition.subsystems);
          this.audio.playHullImpact(0.8);
        }
        if (pRes.sunkEnemyRewardCr > 0) {
          this.economy = { ...this.economy, credits: this.economy.credits + pRes.sunkEnemyRewardCr };
          this.grantXp('navigation', 45);
          this.pushNotify(
            `Ameaça Neutralizada: ${pRes.sunkEnemyName}`,
            `Recompensa da Capitania: +${pRes.sunkEnemyRewardCr} CR`,
            'success',
          );
        }
        if (this.controlMode === 'sailing' && this.telemetryScratch.speedKnots > 2.5) {
          this.navXpTimerS += dt;
          if (this.navXpTimerS >= 12) {
            this.navXpTimerS = 0;
            this.grantXp('navigation', 15);
          }
        }
      }
      const pirateSnapshots = this.pirateAI.getPirateSnapshots(this.boatPos.x, this.boatPos.z);
      this.pirateRenderer.update(simTime, this.params.ocean, pirateSnapshots, this.pirateAI.projectiles);

      // Stream Baixada Santista sectors around active anchor
      const isCharView =
        this.controlMode === 'on_foot' ||
        this.controlMode === 'swimming' ||
        this.controlMode === 'diving' ||
        this.controlMode === 'fishing';
      const isSubView = this.controlMode === 'submarine';
      this.subPosScratch.copy(this.submarineCtrl.position);
      this.anchorVec.copy(isSubView ? this.subPosScratch : isCharView ? this.kaelCtrl.position : this.boatPos);
      this.sectorStreamer.update(this.anchorVec.x, this.anchorVec.z);

      // Floating origin check for long voyages
      const originShift = this.geoWorld.checkFloatingOriginShift(
        this.anchorVec.x,
        this.anchorVec.z,
        3200,
      );
      if (originShift.shifted) {
        this.physics.shiftOrigin(originShift.dx, originShift.dz);
        this.portScene.group.position.x -= originShift.dx;
        this.portScene.group.position.z -= originShift.dz;
        this.underwaterScene.shiftOrigin(originShift.dx, originShift.dz);
        this.trafficMgr.shiftOrigin(originShift.dx, originShift.dz);
        this.trafficRenderer.shiftOrigin(originShift.dx, originShift.dz);
        this.sectorStreamer.shiftOrigin(originShift.dx, originShift.dz);
        this.submarineCtrl.shiftOrigin(originShift.dx, originShift.dz);
        this.pirateAI.shiftOrigin(originShift.dx, originShift.dz);
        this.fishingSys.bobberX -= originShift.dx;
        this.fishingSys.bobberZ -= originShift.dz;
        this.initialMooringX -= originShift.dx;
        this.initialMooringZ -= originShift.dz;
        if (this.dynamicEvents.activeEvent) {
          this.dynamicEvents.activeEvent.x -= originShift.dx;
          this.dynamicEvents.activeEvent.z -= originShift.dz;
        }
        if (isCharView) {
          this.kaelCtrl.teleportOnFoot(
            this.kaelCtrl.position.x - originShift.dx,
            this.kaelCtrl.position.y,
            this.kaelCtrl.position.z - originShift.dz,
          );
        }
        this.physics.getPose(this.boatPos, this.boatQuat);
        this.subPosScratch.copy(this.submarineCtrl.position);
        this.anchorVec.copy(isSubView ? this.subPosScratch : isCharView ? this.kaelCtrl.position : this.boatPos);
      }

      // Fill Naval & Geographic Telemetry
      this.physics.fillTelemetry(
        this.fpsEma,
        this.params.wind,
        this.controls,
        this.params.weather,
        this.telemetryScratch,
      );

      this.geoWorld.localToGeo(this.boatPos.x, this.boatPos.z, this.geoCoordScratch);
      this.geoWorld.localToGeo(this.kaelCtrl.position.x, this.kaelCtrl.position.z, this.charGeoScratch);

      const offX = this.portScene.group.position.x;
      const offZ = this.portScene.group.position.z;

      // Keep legacy Primeira Travessia mission step evaluated
      this.mission = evaluatePrimeiraTravessia(
        this.mission,
        this.controlMode === 'sailing' ? 'sailing' : 'on_foot',
        this.kaelCtrl.position.x - offX,
        this.kaelCtrl.position.z - offZ,
        this.boatPos.x - offX,
        this.boatPos.z - offZ,
        this.initialMooringX - offX,
        this.initialMooringZ - offZ,
        this.controls.throttle,
        this.telemetryScratch.speedKnots,
      );

      // Evaluate v0.5 & v0.7 Campaign MissionManager
      if (this.phase === 'playing') {
        const ownedIds = new Set(this.economy.inventory.map((e) => e.itemId));
        const mRes = evaluateCampaignMissions(
          this.campaignMissions,
          this.boatPos.x - offX,
          this.boatPos.z - offZ,
          this.kaelCtrl.position.x - offX,
          this.kaelCtrl.position.y,
          this.kaelCtrl.position.z - offZ,
          this.controlMode === 'diving',
          ownedIds,
          this.condition.hullIntegrityPct <= 14,
          {
            subActive: isSubView,
            subX: this.submarineCtrl.position.x - offX,
            subY: this.submarineCtrl.position.y,
            subZ: this.submarineCtrl.position.z - offZ,
            caughtFishCount: this.fishingSys.totalCaught,
            soldFishCr: this.fishingSys.totalSoldCr,
          },
        );
        this.campaignMissions = mRes.next;
        for (const itemId of mRes.grantedItemIds) {
          const added = addItemToInventory(this.economy, itemId, 1);
          if (added.ok) this.economy = added.next;
          if (itemId.startsWith('clue_') && !this.storyCluesFound.includes(itemId)) {
            this.storyCluesFound.push(itemId);
            this.pushNotify('Pista Nereus Descoberta!', ITEM_CATALOG[itemId]?.name || itemId, 'info');
          }
        }
        if (mRes.waypointJustCompleted) {
          this.pushNotify('Objetivo Alcançado', mRes.waypointJustCompleted, 'info');
        }
        if (mRes.completedMission) {
          const cm = mRes.completedMission;
          this.economy = { ...this.economy, credits: this.economy.credits + cm.rewardCredits };
          const reqCargo = cm.waypoints[0]?.requiresCargoId;
          if (reqCargo) {
            this.economy = removeItemFromInventory(this.economy, reqCargo, 1);
          }
          if (cm.narrativeClue && !this.storyCluesFound.includes(cm.narrativeClue)) {
            this.storyCluesFound.push(cm.narrativeClue);
          }
          this.grantXp('exploration', 55);
          this.pushRadio(
            cm.giverNpc,
            'Canal 16 · Capitania',
            `Excelente trabalho, Kael! Recompensa de +${cm.rewardCredits} CR transferida para sua conta.`,
          );
          this.pushNotify(`Missão Concluída: ${cm.title}`, `Créditos: +${cm.rewardCredits} CR`, 'success');
          this.callbacks.onMissionCompleted(cm);
        }
      }

      this.currentPrompt = this.evaluateActivePrompt();

      const activeMission = this.campaignMissions.find((m) => m.status === 'in_progress') ?? null;

      this.fishingSys.syncEquipmentSelection(this.economy);
      this.fishingSys.zoneDepthM = computeZoneDepthAt(this.kaelCtrl.position.x, this.kaelCtrl.position.z);

      const envInfo = this.underwaterScene.getEnvironmentInfoAt(
        this.kaelCtrl.position.x,
        this.kaelCtrl.position.y,
        this.kaelCtrl.position.z,
        hasEquipment(this.economy, 'equip_diver_mask'),
        hasEquipment(this.economy, 'equip_dive_flashlight') && this.kaelCtrl.flashlightOn,
      );

      this.telemetryScratch.controlMode = this.controlMode;
      this.telemetryScratch.geoLat = this.geoCoordScratch.lat;
      this.telemetryScratch.geoLon = this.geoCoordScratch.lon;
      this.telemetryScratch.charX = this.kaelCtrl.position.x;
      this.telemetryScratch.charY = this.kaelCtrl.position.y;
      this.telemetryScratch.charZ = this.kaelCtrl.position.z;
      this.telemetryScratch.charLat = this.charGeoScratch.lat;
      this.telemetryScratch.charLon = this.charGeoScratch.lon;
      this.telemetryScratch.charHeadingDeg =
        (((this.kaelCtrl.headingRad * 180) / Math.PI) % 360 + 360) % 360;
      this.telemetryScratch.charGrounded = this.kaelCtrl.grounded;
      this.telemetryScratch.charAnim = this.kaelCtrl.animState;
      this.telemetryScratch.oxygenPct = Math.round(
        (this.kaelCtrl.oxygenSeconds / Math.max(1, this.kaelCtrl.maxOxygenSeconds)) * 100,
      );
      this.telemetryScratch.maxOxygenSeconds = this.kaelCtrl.maxOxygenSeconds;
      this.telemetryScratch.waterDepthM = this.kaelCtrl.waterDepthM;
      this.telemetryScratch.condition = {
        ...this.condition,
        subsystems: { ...this.condition.subsystems },
      };
      this.telemetryScratch.activePrompt = this.currentPrompt;
      this.telemetryScratch.loadedSectorsCount = this.sectorStreamer.getLoadedSectorCount();
      this.telemetryScratch.geoDataSource = this.sectorStreamer.currentDataSource;
      this.telemetryScratch.mission = this.mission;
      this.telemetryScratch.activeMission = activeMission;
      this.telemetryScratch.allMissions = this.campaignMissions;
      this.telemetryScratch.economy = this.economy;
      this.telemetryScratch.npcVessels = npcSnapshots;
      this.telemetryScratch.activeEvent = this.dynamicEvents.activeEvent;
      this.telemetryScratch.underwaterNodes = this.underwaterScene.getNodesSnapshot();
      this.telemetryScratch.storyCluesFound = [...this.storyCluesFound];

      // Populate v0.7 telemetry slices
      this.telemetryScratch.fishing = this.fishingSys.getSnapshot();
      this.telemetryScratch.fishingStats = {
        totalCaught: this.fishingSys.totalCaught,
        totalSoldCr: this.fishingSys.totalSoldCr,
        catches: this.fishingSys.catches,
      };
      this.telemetryScratch.underwater = {
        depthM: Math.round(this.kaelCtrl.waterDepthM * 10) / 10,
        maxSafeDepthM: this.kaelCtrl.maxSafeDepthM,
        waterTempC: this.kaelCtrl.waterTempC,
        visibilityM: envInfo.visibilityM,
        pressureAtm: this.kaelCtrl.pressureAtm,
        decompressionRiskPct: Math.round(this.kaelCtrl.decompressionRiskPct),
        flashlightOn: this.kaelCtrl.flashlightOn,
        currentSpeedMs: this.params.ocean.currentSpeed,
        environmentName: envInfo.name,
        depthWarning: this.kaelCtrl.depthLimitBlocked
          ? `Limite do equipamento (${this.kaelCtrl.maxSafeDepthM} m). Adquira cilindro/profundímetro!`
          : null,
      };
      this.telemetryScratch.submarine = this.submarineCtrl.getSnapshot(
        isSubView,
        subUnlocked,
        simTime,
        this.params.ocean,
      );
      this.telemetryScratch.garage = {
        activeVesselId: this.activeVesselId,
        ownedVessels: this.ownedVessels,
      };
      this.telemetryScratch.pirates = pirateSnapshots;
      this.telemetryScratch.combat = this.pirateAI.getCombatSnapshot(
        this.boatPos.x,
        this.boatPos.z,
        activeVessel.upgrades.weaponLevel,
      );
      this.telemetryScratch.progression = this.progression;

      // Update active surface vessel mesh (Aster S-01 or catalog vessel)
      if (activeVessel.specId === 'aster_s01') {
        this.vessel.setWeaponEquipped(activeVessel.upgrades.weaponLevel, this.pirateAI.activeFiresOnPlayer, simTime);
        this.vessel.updateVisuals(
          this.phase === 'paused' ? 0 : dt,
          simTime,
          this.boatPos,
          this.boatQuat,
          this.physics.getBoomAngleRad(),
          this.physics.getJibAngleRad(),
          this.physics.getRudderAngleRad(),
          (this.telemetryScratch.apparentWindRelDeg * Math.PI) / 180,
          this.controls.sailArea,
          this.physics.getClothPressure(),
          this.physics.getLuffingFactor(),
          this.params.wind.turbulence,
          this.controls.throttle,
          this.atmosphere.nightFactor,
        );
      } else {
        this.surfaceVesselVisuals.update(
          this.phase === 'paused' ? 0 : dt,
          simTime,
          this.boatPos,
          this.boatQuat,
          this.controls.throttle,
          this.pirateAI.activeFiresOnPlayer,
        );
      }

      const subDepthM = this.submarineCtrl.getDepthM(simTime, this.params.ocean);
      const isUnderwater =
        this.controlMode === 'diving' || (isSubView && subDepthM > 0.65);

      this.cameraCtrl.update(
        this.camera,
        dt,
        simTime,
        isSubView ? this.subPosScratch : this.boatPos,
        isSubView ? -this.submarineCtrl.headingRad : headingRad,
        this.kaelCtrl.position,
        isCharView,
        this.phase === 'title',
        isUnderwater,
        isSubView ? this.telemetryScratch.submarine.speedKnots : this.telemetryScratch.speedKnots,
        isSubView,
      );

      // Sync sun/moon shadows & HDR atmosphere exposure
      const elevDeg = this.atmosphere.sunElevationDeg;
      const effectiveElevDeg = elevDeg < 2 ? Math.max(14, Math.abs(elevDeg) + 12) : elevDeg;
      const elev = (effectiveElevDeg * Math.PI) / 180;
      const azim = (this.atmosphere.sunAzimuthDeg * Math.PI) / 180;
      const sunDist = 82;
      this.sunLight.position.set(
        this.anchorVec.x + Math.cos(elev) * Math.sin(azim) * sunDist,
        Math.sin(elev) * sunDist,
        this.anchorVec.z + Math.cos(elev) * Math.cos(azim) * sunDist,
      );
      this.sunLight.target.position.copy(this.anchorVec);
      this.sunLight.color.setHex(this.atmosphere.sunColorHex);

      const dayOrMoonDirect = this.atmosphere.nightFactor > 0.5 ? 0.58 : 2.35;
      this.sunLight.intensity = isUnderwater
        ? 0.95
        : dayOrMoonDirect * this.atmosphere.ambientFactor * (1.0 - this.atmosphere.cloudCover * 0.42) +
          this.atmosphere.lightningFlash * 2.6;

      this.hemiLight.color.setHex(this.atmosphere.skyTopHex);
      this.hemiLight.groundColor.setHex(this.atmosphere.waterDeepHex);
      this.hemiLight.intensity = isUnderwater
        ? 0.55
        : Math.max(0.42, 0.86 * this.atmosphere.ambientFactor - this.atmosphere.cloudCover * 0.16) +
          this.atmosphere.lightningFlash * 0.9;

      this.rimLight.color.setHex(this.atmosphere.skyHorizonHex);
      this.rimLight.intensity = isUnderwater ? 0.25 : 0.48 * this.atmosphere.ambientFactor;

      this.renderer.toneMappingExposure = isUnderwater ? 0.95 : this.atmosphere.exposure;
      if (this.bloomPass) {
        this.bloomPass.strength = 0.2 + this.atmosphere.nightFactor * 0.18 + this.atmosphere.lightningFlash * 0.28;
      }

      if (isUnderwater) {
        const hasMask = hasEquipment(this.economy, 'equip_diver_mask');
        this.fog.color.setHex(0x052d3e);
        this.fog.density = hasMask ? 0.032 : 0.055;
      } else {
        this.fog.color.setHex(this.atmosphere.skyHorizonHex);
        this.fog.density = this.atmosphere.fogDensity * 0.65;
      }

      this.oceanSurface.update(
        simTime,
        this.params.ocean,
        this.atmosphere,
        this.boatPos,
        this.boatForward,
        this.telemetryScratch.speedMs,
        this.anchorVec,
        isUnderwater,
        offX,
        offZ,
      );
      this.envEffects.update(
        this.phase === 'paused' ? 0 : dt,
        simTime,
        this.params.ocean,
        this.atmosphere,
        this.boatPos,
        this.boatForward,
        this.telemetryScratch.speedMs,
        this.camera.position,
        this.params.debugPhysics,
        this.physics.debugVectors,
      );

      const distPort = Math.hypot(this.anchorVec.x - offX, this.anchorVec.z - offZ);
      const onWoodPier = Boolean(
        this.controlMode === 'on_foot' &&
          this.portScene.isPointOverSafePier(this.kaelCtrl.position.x, this.kaelCtrl.position.z)?.name.includes('Píer'),
      );
      this.audio.update(
        dt,
        this.telemetryScratch.speedKnots,
        this.telemetryScratch.apparentWindKnots,
        this.params.ocean.waveScale,
        this.controls.throttle,
        this.telemetryScratch.luffingFactor,
        this.atmosphere.rainIntensity,
        distPort,
        isUnderwater,
        this.controlMode === 'on_foot' ? this.kaelCtrl.horizontalSpeed : 0,
        onWoodPier,
        this.phase === 'playing',
      );

      const gs = this.getEffectiveGraphicsSettings(this.params);
      if (!this.isSoftwareGl && gs.postProcessing && this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      const cpuFrameMs = performance.now() - frameStart;
      this.frameTimeEmaMs = this.frameTimeEmaMs * 0.9 + cpuFrameMs * 0.1;

      if (now - this.lastTelemetryEmit >= 65) {
        this.lastTelemetryEmit = now;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        this.renderStatsScratch.drawCalls = this.renderer.info.render.calls;
        this.renderStatsScratch.triangles = this.renderer.info.render.triangles;
        this.renderStatsScratch.textures = this.renderer.info.memory.textures;
        this.renderStatsScratch.geometries = this.renderer.info.memory.geometries;
        this.renderStatsScratch.frameTimeMs = Number(this.frameTimeEmaMs.toFixed(2));
        this.renderStatsScratch.jsHeapMb = mem ? Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)) : null;
        this.telemetryScratch.renderStats = { ...this.renderStatsScratch };
        this.callbacks.onTelemetry({ ...this.telemetryScratch });
      }
    }

    this.scheduleNextTick();
  };

  // --- Versioned Campaign Save & Load (v2) ---
  public buildSaveFile(): AbyssalSaveFile {
    const offX = this.portScene?.group.position.x ?? 0;
    const offZ = this.portScene?.group.position.z ?? 0;
    return {
      version: SAVE_FORMAT_VERSION,
      savedAt: Date.now(),
      chapterTitle: 'Capítulo 1–2 · Vida Marinha, Submersíveis & Piratas',
      controlMode: this.controlMode,
      playerPos: {
        x: this.kaelCtrl ? this.kaelCtrl.position.x - offX : KAEL_SPAWN.x,
        y: this.kaelCtrl ? this.kaelCtrl.position.y : KAEL_SPAWN.y,
        z: this.kaelCtrl ? this.kaelCtrl.position.z - offZ : KAEL_SPAWN.z,
        headingRad: this.kaelCtrl ? this.kaelCtrl.headingRad : KAEL_SPAWN.headingRad,
      },
      vesselPos: {
        x: this.boatPos.x - offX,
        z: this.boatPos.z - offZ,
        headingDeg: this.telemetryScratch.headingDeg,
        moored: this.condition.moored,
      },
      fuelPct: this.condition.fuelPct,
      batteryPct: this.condition.batteryPct,
      subsystems: { ...this.condition.subsystems },
      economy: structuredClone(this.economy),
      missions: structuredClone(this.campaignMissions),
      storyCluesFound: [...this.storyCluesFound],
      collectedUnderwaterIds: this.underwaterScene?.getCollectedIds() ?? [],
      fishingCatches: structuredClone(this.fishingSys.catches),
      fishingTotalCaught: this.fishingSys.totalCaught,
      fishingTotalSoldCr: this.fishingSys.totalSoldCr,
      activeVesselId: this.activeVesselId,
      ownedVessels: structuredClone(this.ownedVessels),
      progression: structuredClone(this.progression),
      submarineState: {
        x: this.submarineCtrl.position.x - offX,
        y: this.submarineCtrl.position.y,
        z: this.submarineCtrl.position.z - offZ,
        headingDeg: Math.round((((this.submarineCtrl.headingRad * 180) / Math.PI) % 360 + 360) % 360),
        batteryPct: this.submarineCtrl.batteryPct,
        hullPct: this.submarineCtrl.hullPct,
      },
    };
  }

  public applySaveFile(save: AbyssalSaveFile): void {
    this.economy = structuredClone(save.economy);
    this.campaignMissions = structuredClone(save.missions);
    this.storyCluesFound = [...save.storyCluesFound];
    this.condition.fuelPct = save.fuelPct;
    this.condition.batteryPct = save.batteryPct;
    this.condition.subsystems = { ...save.subsystems };
    this.condition.hullIntegrityPct = computeOverallHullIntegrity(save.subsystems);
    this.condition.moored = save.vesselPos.moored;

    if (save.fishingCatches) {
      this.fishingSys.loadState(
        save.fishingCatches,
        save.fishingTotalCaught ?? save.fishingCatches.length,
        save.fishingTotalSoldCr ?? 0,
      );
    }
    this.fishingSys.syncEquipmentSelection(this.economy);

    if (save.ownedVessels && save.ownedVessels.length > 0) {
      this.ownedVessels = structuredClone(save.ownedVessels);
    }
    if (save.activeVesselId) {
      this.activeVesselId = save.activeVesselId;
    }
    if (save.progression) {
      this.progression = structuredClone(save.progression);
    }

    this.underwaterScene?.setCollectedIds(save.collectedUnderwaterIds);
    this.syncDivingVisuals();
    this.syncActiveVesselVisualsAndEconomy();

    const offX = this.portScene?.group.position.x ?? 0;
    const offZ = this.portScene?.group.position.z ?? 0;

    if (save.submarineState) {
      this.submarineCtrl.resetAt(
        save.submarineState.x + offX,
        save.submarineState.y,
        save.submarineState.z + offZ,
        save.submarineState.headingDeg,
      );
      this.submarineCtrl.batteryPct = save.submarineState.batteryPct;
      this.submarineCtrl.hullPct = save.submarineState.hullPct;
    }

    this.physics?.resetVessel(
      save.vesselPos.x + offX,
      save.vesselPos.z + offZ,
      save.vesselPos.headingDeg,
      save.vesselPos.moored,
    );

    if (save.controlMode === 'submarine' && this.ownedVessels.some((v) => v.specId === 'nereid_s1')) {
      this.controlMode = 'submarine';
      this.kaelCtrl?.setAboardMode(true);
      this.cameraCtrl.setMode('chase');
      this.callbacks.onCameraModeSync('chase');
    } else if (save.controlMode === 'swimming' || save.controlMode === 'diving') {
      // Oxygen and a dive session are not persisted. Resume safely at the surface,
      // keeping the saved horizontal location instead of spawning on foot underwater.
      this.controlMode = 'swimming';
      this.kaelCtrl?.setAboardMode(false);
      this.kaelCtrl?.enterWaterAt(save.playerPos.x + offX, save.playerPos.z + offZ,
        this.physics.getSimTime(), this.params.ocean);
      this.cameraCtrl.setMode('thirdperson');
      this.callbacks.onCameraModeSync('thirdperson');
    } else if (save.controlMode === 'sailing') {
      this.controlMode = 'sailing';
      this.kaelCtrl?.setAboardMode(true);
      this.cameraCtrl.setMode('chase');
      this.callbacks.onCameraModeSync('chase');
    } else {
      this.controlMode = 'on_foot';
      this.kaelCtrl?.setAboardMode(false);
      this.kaelCtrl?.teleportOnFoot(
        save.playerPos.x + offX,
        save.playerPos.y,
        save.playerPos.z + offZ,
        save.playerPos.headingRad,
      );
      this.cameraCtrl.setMode('thirdperson');
      this.callbacks.onCameraModeSync('thirdperson');
    }
    this.pushNotify('Campanha Carregada', `Créditos: ${this.economy.credits} CR`, 'success');
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.audio.dispose();
    this.kaelCtrl?.dispose();
    this.kaelRig?.dispose();
    this.fishingVisuals?.dispose();
    this.submarineMesh?.dispose();
    this.pirateRenderer?.dispose();
    this.surfaceVesselVisuals?.dispose();
    this.portScene?.dispose(this.physics?.getWorld());
    this.underwaterScene?.dispose();
    this.trafficRenderer?.dispose();
    this.sectorStreamer?.dispose();
    this.physics?.dispose();
    this.oceanSurface?.dispose();
    this.vessel?.dispose();
    this.envEffects?.dispose();
    this.textures?.dispose();
    this.envMapRT?.dispose();
    this.composer?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}
