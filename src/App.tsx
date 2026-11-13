import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Backpack,
  BookOpen,
  Camera,
  CloudSun,
  Compass,
  Download,
  Eye,
  EyeOff,
  Fish,
  Footprints,
  Map as MapIcon,
  Pause,
  Radar,
  Radio,
  Ship,
  Sun,
  Volume2,
  VolumeX,
  Waves,
  WifiOff,
} from 'lucide-react';
import { CombatThreatHUD } from './components/CombatThreatHUD';
import { DivingHUD } from './components/DivingHUD';
import { FishingHUD } from './components/FishingHUD';
import { InventoryEquipmentModal } from './components/InventoryEquipmentModal';
import { MissionJournalModal } from './components/MissionJournalModal';
import { MissionTracker } from './components/MissionTracker';
import { NavalMarketplaceModal } from './components/NavalMarketplaceModal';
import { NavigationMap } from './components/NavigationMap';
import { PauseModal } from './components/PauseModal';
import { PhysicsLabDrawer } from './components/PhysicsLabDrawer';
import { PortInteractionModal } from './components/PortInteractionModal';
import { SubmarineHUD } from './components/SubmarineHUD';
import { TitleOverlay } from './components/TitleOverlay';
import { WindRoseGauge } from './components/WindRoseGauge';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWA';
import { DEFAULT_AUDIO_VOLUMES } from './scene/audioEngine';
import { createInitialTelemetrySnapshot, NavalSimulationEngine } from './scene/navalEngine';
import { createDefaultGeoSector, GeolocationMonitor } from './services/geolocationService';
import { AbyssalSaveFile, loadCampaignFromLocal, saveCampaignToLocal } from './services/saveSystem';
import {
  loadCampaignBlueprint,
  loadLabState,
  saveCampaignBlueprint,
  saveLabState,
} from './services/storageService';
import {
  createDefaultSimulationParams,
  createGraphicsSettingsForProfile,
  createInitialCampaignBlueprint,
  REPRODUCIBLE_SCENARIOS,
} from './sim/scenarios';
import {
  AudioVolumesConfig,
  CameraMode,
  CampaignBlueprintState,
  ControlInputs,
  GameNotification,
  GamePhase,
  GeoSectorInfo,
  HudMode,
  InteractableType,
  LightingPresetId,
  RadioMessage,
  ScenarioId,
  SimulationParams,
  TelemetrySnapshot,
  WeatherPresetId,
} from './sim/types';
import { LIGHTING_PRESETS, WEATHER_PRESETS } from './sim/weatherSystem';

const INITIAL_TELEMETRY: TelemetrySnapshot = createInitialTelemetrySnapshot();

const CAMERA_MODES: Array<{ id: CameraMode; label: string }> = [
  { id: 'thirdperson', label: '3ª Pessoa' },
  { id: 'topdown', label: 'Top-Down' },
  { id: 'chase', label: 'Popa' },
  { id: 'cinematic', label: 'Cinemática' },
  { id: 'inspect', label: 'Inspeção' },
  { id: 'free', label: 'Livre' },
];

const LIGHTING_ORDER: LightingPresetId[] = [
  'auto',
  'dawn',
  'noon',
  'sunset',
  'clear_night',
  'overcast_night',
  'storm',
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NavalSimulationEngine | null>(null);
  const geoMonitorRef = useRef<GeolocationMonitor | null>(null);

  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [labOpen, setLabOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [dealershipOpen, setDealershipOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<InteractableType | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('thirdperson');
  const [hudMode, setHudMode] = useState<HudMode>('full');
  const [muted, setMuted] = useState(false);
  const [audioVolumes, setAudioVolumes] = useState<AudioVolumesConfig>(() => ({ ...DEFAULT_AUDIO_VOLUMES }));

  const [params, setParams] = useState<SimulationParams>(() => createDefaultSimulationParams());
  const [controlsEcho, setControlsEcho] = useState<ControlInputs>({
    throttle: 0,
    rudderTarget: 0,
    sailTrim: 0.45,
    sailArea: 0.0,
  });
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);
  const [geoSector, setGeoSector] = useState<GeoSectorInfo>(() => createDefaultGeoSector());
  const [campaign, setCampaign] = useState<CampaignBlueprintState>(() =>
    createInitialCampaignBlueprint(),
  );
  const [savedCampaign, setSavedCampaign] = useState<AbyssalSaveFile | null>(() =>
    loadCampaignFromLocal(),
  );
  const [radioLog, setRadioLog] = useState<RadioMessage[]>([]);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(false);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadLabState();
      if (saved && mounted) {
        const defaults = createDefaultSimulationParams();
        const profile = saved.params?.graphics ?? defaults.graphics;
        const mergedParams: SimulationParams = {
          ...defaults,
          ...saved.params,
          ocean: { ...defaults.ocean, ...saved.params?.ocean },
          wind: { ...defaults.wind, ...saved.params?.wind },
          vessel: { ...defaults.vessel, ...saved.params?.vessel },
          lighting: saved.params?.lighting ?? defaults.lighting,
          graphics: profile,
          graphicsSettings: {
            ...createGraphicsSettingsForProfile(profile),
            ...saved.params?.graphicsSettings,
          },
        };
        setParams(mergedParams);
        setMuted(saved.muted);
        if (mergedParams.audioVolumes) setAudioVolumes(mergedParams.audioVolumes);
        engineRef.current?.setParams(mergedParams);
        engineRef.current?.audio.setMuted(saved.muted);
      }
      const savedBp = await loadCampaignBlueprint();
      if (savedBp && mounted) {
        setCampaign(savedBp);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveLabState({
        params: { ...params, audioVolumes },
        geoAuthorized: geoSector.status === 'active',
        muted,
        savedAt: Date.now(),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [params, audioVolumes, geoSector.status, muted]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const geoMon = new GeolocationMonitor();
    geoMonitorRef.current = geoMon;

    const engine = new NavalSimulationEngine(mount, params, false, {
      onTelemetry: (snap) => {
        setTelemetry(snap);
        setControlsEcho({
          throttle: snap.throttle,
          rudderTarget: snap.rudderDeg / 34,
          sailTrim: snap.sailTrimPct / 100,
          sailArea: snap.sailAreaPct / 100,
        });
      },
      onToggleLab: () => setLabOpen((prev) => !prev),
      onTogglePause: () => {
        setMapExpanded(false);
        setInventoryOpen(false);
        setJournalOpen(false);
        setDealershipOpen(false);
        setActiveModal(null);
        setPhase((prev) =>
          prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev,
        );
      },
      onToggleMap: () => {
        setInventoryOpen(false);
        setJournalOpen(false);
        setDealershipOpen(false);
        setActiveModal(null);
        setMapExpanded((prev) => !prev);
      },
      onToggleInventory: () => {
        setMapExpanded(false);
        setJournalOpen(false);
        setDealershipOpen(false);
        setActiveModal(null);
        setInventoryOpen((prev) => !prev);
      },
      onToggleJournal: () => {
        setMapExpanded(false);
        setInventoryOpen(false);
        setDealershipOpen(false);
        setActiveModal(null);
        setJournalOpen((prev) => !prev);
      },
      onOpenInteraction: (type) => {
        if (type === 'naval_dealership') {
          setDealershipOpen(true);
        } else if (type === 'submarine_dock') {
          if (engineRef.current) {
            // Query the engine now: this callback is registered once and must not
            // read the initial React telemetry snapshot after a later purchase.
            engineRef.current.enterSubmarineMode();
            if (engineRef.current.getControlMode() !== 'submarine') setDealershipOpen(true);
          }
        } else {
          setActiveModal(type);
        }
      },
      onCameraModeSync: (mode) => setCameraMode(mode),
      onParamsChanged: (next) => setParams(next),
      onRadioMessage: (msg) => {
        setRadioLog((prev) => [msg, ...prev].slice(0, 3));
      },
      onNotification: (note) => {
        setNotifications((prev) => [note, ...prev].slice(0, 3));
        window.setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== note.id));
        }, 4500);
      },
      onMissionCompleted: () => {
        const nextCamp: CampaignBlueprintState = {
          ...campaignRef.current,
          missionCompleted: true,
        };
        setCampaign(nextCamp);
        void saveCampaignBlueprint(nextCamp);
      },
      onContextLost: (lost) => setContextLost(lost),
      onReady: () => setEngineReady(true),
      onError: (msg) => setEngineError(msg),
    });

    engineRef.current = engine;

    return () => {
      geoMon.stop();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPhase(phase);
  }, [phase]);

  const handleStartSimulation = useCallback(() => {
    engineRef.current?.audio.initOnUserGesture();
    engineRef.current?.setControlsPatch({ throttle: 0.0, sailArea: 0.0, sailTrim: 0.45 });
    setCameraMode('thirdperson');
    engineRef.current?.setCameraMode('thirdperson');
    setPhase('playing');
  }, []);

  const handleContinueSave = useCallback(() => {
    if (!savedCampaign || !engineRef.current) return;
    engineRef.current.audio.initOnUserGesture();
    engineRef.current.applySaveFile(savedCampaign);
    setPhase('playing');
  }, [savedCampaign]);

  const handleSaveCampaign = useCallback(() => {
    if (!engineRef.current) return false;
    const file = engineRef.current.buildSaveFile();
    const ok = saveCampaignToLocal(file);
    if (ok) setSavedCampaign(file);
    return ok;
  }, []);

  useEffect(() => {
    if (phase !== 'title' || !engineReady) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleStartSimulation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, engineReady, handleStartSimulation]);

  const handleChangeParams = useCallback((next: SimulationParams) => {
    setParams(next);
    engineRef.current?.setParams(next);
  }, []);

  const handleChangeWeather = useCallback((preset: WeatherPresetId) => {
    engineRef.current?.applyWeatherPreset(preset);
    const target = WEATHER_PRESETS[preset];
    setParams((prev) => ({
      ...prev,
      weather: preset,
      wind: {
        ...prev.wind,
        speedKnots: target.windKnots,
        gustIntensity: target.gustIntensity,
        turbulence: target.turbulence,
      },
      ocean: {
        ...prev.ocean,
        waveScale: target.waveScale,
        chopScale: target.chopScale,
      },
    }));
  }, []);

  const handleCycleWeather = useCallback(() => {
    const order: WeatherPresetId[] = ['clear', 'calm', 'cloudy', 'rain', 'fog', 'rough', 'storm'];
    const next = order[(order.indexOf(params.weather) + 1) % order.length];
    handleChangeWeather(next);
  }, [params.weather, handleChangeWeather]);

  const handleCycleLighting = useCallback(() => {
    const cur = params.lighting ?? 'auto';
    const next = LIGHTING_ORDER[(LIGHTING_ORDER.indexOf(cur) + 1) % LIGHTING_ORDER.length];
    engineRef.current?.setLightingPreset(next);
    setParams((prev) => ({ ...prev, lighting: next }));
  }, [params.lighting]);

  const handleCycleHudMode = useCallback(() => {
    setHudMode((prev) => (prev === 'full' ? 'compact' : prev === 'compact' ? 'cinema' : 'full'));
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!e.repeat && e.code === 'KeyH') {
        e.preventDefault();
        handleCycleHudMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleCycleHudMode]);

  const handleChangeControls = useCallback((patch: Partial<ControlInputs>) => {
    engineRef.current?.setControlsPatch(patch);
    setControlsEcho((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleChangeCamera = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.audio.setMuted(next);
      return next;
    });
  }, []);

  const handleChangeAudioVolumes = useCallback((next: AudioVolumesConfig) => {
    setAudioVolumes(next);
    engineRef.current?.setAudioVolumes(next);
  }, []);

  const handleRequestGeo = useCallback(() => {
    geoMonitorRef.current?.start((info) => {
      setGeoSector(info);
      if (info.status === 'active' || info.status === 'inaccurate') {
        setParams((prev) => {
          const updated: SimulationParams = {
            ...prev,
            wind: { ...prev.wind, speedKnots: info.recommendedWindKnots },
            ocean: {
              ...prev.ocean,
              waveScale: info.recommendedWaveScale,
              currentSpeed: info.recommendedCurrentSpeed,
            },
          };
          engineRef.current?.setParams(updated);
          return updated;
        });
      }
    });
  }, []);

  const handleStopGeo = useCallback(() => {
    geoMonitorRef.current?.stop();
    setGeoSector(createDefaultGeoSector());
  }, []);

  const handleRunScenario = useCallback(
    (id: ScenarioId) => {
      const sc = REPRODUCIBLE_SCENARIOS.find((s) => s.id === id);
      if (!sc) return;
      setParams((prev) => {
        const merged: SimulationParams = {
          ...prev,
          ...sc.paramsPatch,
          ocean: { ...prev.ocean, ...sc.oceanPatch },
          wind: { ...prev.wind, ...sc.windPatch },
          vessel: { ...prev.vessel, ...sc.vesselPatch },
        };
        engineRef.current?.setParams(merged);
        return merged;
      });
      if (sc.controlsPatch) {
        engineRef.current?.setControlsPatch(sc.controlsPatch);
        setControlsEcho((prev) => ({ ...prev, ...sc.controlsPatch }));
      }
      if (sc.vesselReset) {
        engineRef.current?.resetVessel(
          sc.vesselReset.x,
          sc.vesselReset.z,
          sc.vesselReset.headingDeg,
        );
      }
      if (id === 'geo_authorized') handleRequestGeo();
      else if (id === 'geo_denied') handleStopGeo();
    },
    [handleRequestGeo, handleStopGeo],
  );

  const handleResetDefaults = useCallback(() => {
    const def = createDefaultSimulationParams();
    setParams(def);
    engineRef.current?.setParams(def);
    engineRef.current?.resetToPort();
    engineRef.current?.setControlsPatch({
      throttle: 0,
      rudderTarget: 0,
      sailTrim: 0.45,
      sailArea: 0.0,
    });
  }, []);

  const handleReturnTitle = useCallback(() => {
    handleSaveCampaign();
    void saveCampaignBlueprint({
      ...campaign,
      voyageMilesTotal: campaign.voyageMilesTotal + telemetry.distanceNm,
    });
    setPhase('title');
  }, [campaign, telemetry.distanceNm, handleSaveCampaign]);

  const activeVessel =
    telemetry.garage.ownedVessels.find((v) => v.instanceId === telemetry.garage.activeVesselId) ??
    telemetry.garage.ownedVessels[0];
  const isCharSurfaceOrDive =
    telemetry.controlMode !== 'sailing' && telemetry.controlMode !== 'submarine';
  const isInWater = telemetry.controlMode === 'swimming' || telemetry.controlMode === 'diving';
  const lowHullWarning = telemetry.condition.hullIntegrityPct < 85;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#06131c]">
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {(engineError || contextLost) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06131c]/95 p-6">
          <div className="max-w-md bg-[#0a1d2b] border border-slate-700 rounded-xl p-6 text-center space-y-3">
            <h2 className="font-display text-lg font-bold text-white">
              {contextLost ? 'Contexto WebGL Interrompido' : 'Erro na Inicialização Naval'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {contextLost
                ? 'O navegador suspendeu temporariamente o contexto gráfico. Aguarde a restauração automática ou recarregue a página.'
                : engineError}
            </p>
          </div>
        </div>
      )}

      {phase === 'title' && (
        <TitleOverlay
          ready={engineReady}
          geoSector={geoSector}
          savedCampaign={savedCampaign}
          onStart={handleStartSimulation}
          onContinueSave={handleContinueSave}
          onRequestGeo={handleRequestGeo}
          onSkipGeo={() => {
            handleStopGeo();
            handleStartSimulation();
          }}
        />
      )}

      {phase !== 'title' && hudMode === 'cinema' && (
        <div className="fixed bottom-3 right-3 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => setHudMode('full')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071520]/85 border border-slate-700/70 text-xs text-slate-200 hover:border-amber-400/60 cursor-pointer"
            title="Restaurar HUD (H)"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            HUD (H)
          </button>
        </div>
      )}

      {phase !== 'title' && hudMode !== 'cinema' && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          {/* Top-Left Compact Telemetry, Credits, Oxygen & Mission Tracker */}
          <div className="absolute top-3 left-3 pointer-events-none flex flex-col items-start">
            <div className="bg-[#071520]/90 border border-slate-700/70 rounded-lg px-3.5 py-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-1.5 pb-1.5 border-b border-slate-800/80 text-[10px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                  {telemetry.controlMode === 'on_foot' ? (
                    <>
                      <Footprints className="w-3 h-3 text-sky-400" />
                      Em Terra · Kael Rivera
                    </>
                  ) : telemetry.controlMode === 'fishing' ? (
                    <>
                      <Fish className="w-3 h-3 text-cyan-400" />
                      Pesca Marítima · Kael Rivera
                    </>
                  ) : telemetry.controlMode === 'submarine' ? (
                    <>
                      <Radar className="w-3 h-3 text-amber-400" />
                      Submersível · {telemetry.submarine.modelName}
                    </>
                  ) : isInWater ? (
                    <>
                      <Waves className="w-3 h-3 text-cyan-400" />
                      {telemetry.controlMode === 'diving' ? 'Mergulho Submerso' : 'Natação'} · Prof. {telemetry.waterDepthM.toFixed(1)}m
                    </>
                  ) : (
                    <>
                      <Anchor className="w-3 h-3 text-amber-400" />
                      No Leme · {activeVessel?.customName ?? 'Aster S-01'}
                    </>
                  )}
                </span>
                <span className="font-mono-tabular font-bold text-amber-300">
                  {telemetry.economy.credits} CR
                </span>
              </div>

              {telemetry.controlMode === 'submarine' ? (
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-[10px] text-slate-400">Profundidade</div>
                    <div className="font-mono-tabular text-2xl font-bold text-cyan-300 leading-tight">
                      {telemetry.submarine.depthM.toFixed(1)}
                      <span className="text-xs font-normal text-slate-300 ml-1">m</span>
                    </div>
                  </div>
                  <div className="border-l border-slate-700/70 pl-3.5">
                    <div className="text-[10px] text-slate-400">Velocidade</div>
                    <div className="font-mono-tabular text-xl font-semibold text-white leading-tight">
                      {telemetry.submarine.speedKnots.toFixed(1)} kts
                    </div>
                  </div>
                  <div className="border-l border-slate-700/70 pl-3.5 hidden sm:block">
                    <div className="text-[10px] text-slate-400">Bateria / Casco</div>
                    <div className="font-mono-tabular text-xs text-emerald-300 mt-1">
                      {telemetry.submarine.batteryPct.toFixed(0)}% · {telemetry.submarine.hullPct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ) : isCharSurfaceOrDive ? (
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-[10px] text-slate-400">Estado</div>
                    <div className="font-mono-tabular text-lg font-bold text-white leading-tight">
                      {telemetry.controlMode === 'fishing'
                        ? 'Pescando'
                        : telemetry.charAnim === 'run'
                          ? 'Corrida'
                          : telemetry.charAnim === 'walk'
                            ? 'Caminhada'
                            : telemetry.charAnim === 'jump'
                              ? 'Salto'
                              : telemetry.charAnim === 'dive'
                                ? 'Mergulho'
                                : telemetry.charAnim === 'swim'
                                  ? 'Nado'
                                  : 'Repouso'}
                    </div>
                  </div>
                  <div className="border-l border-slate-700/70 pl-3.5">
                    <div className="text-[10px] text-slate-400">Coordenadas WGS84</div>
                    <div className="font-mono-tabular text-[11px] text-sky-300 mt-0.5">
                      {telemetry.charLat.toFixed(4)}°, {telemetry.charLon.toFixed(4)}°
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400">Velocidade</div>
                      <div className="font-mono-tabular text-2xl font-bold text-white leading-tight">
                        {telemetry.speedKnots.toFixed(1)}
                        <span className="text-xs font-normal text-amber-400 ml-1">kts</span>
                      </div>
                    </div>
                    <div className="border-l border-slate-700/70 pl-3.5">
                      <div className="text-[10px] text-slate-400">Rumo</div>
                      <div className="font-mono-tabular text-xl font-semibold text-sky-300 leading-tight">
                        {String(Math.round(telemetry.headingDeg)).padStart(3, '0')}°
                      </div>
                    </div>
                    <div className="border-l border-slate-700/70 pl-3.5 hidden sm:block">
                      <div className="text-[10px] text-slate-400">Casco / Motor</div>
                      <div className="font-mono-tabular text-xs text-slate-200 mt-1">
                        {telemetry.condition.subsystems.hullPct.toFixed(0)}% · {telemetry.condition.subsystems.enginePct.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {hudMode === 'full' && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-3.5 text-[11px] font-mono-tabular text-slate-300">
                      <span>Motor {Math.round(telemetry.throttle * 100)}%</span>
                      <span>Leme {Math.round(telemetry.rudderDeg)}°</span>
                      <span>Comb. {telemetry.condition.fuelPct.toFixed(0)}%</span>
                      <span className="text-slate-400">{telemetry.distanceNm.toFixed(2)} nm</span>
                    </div>
                  )}
                </>
              )}

              {/* Oxygen Meter when Swimming / Diving */}
              {isInWater && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-[10px] font-mono-tabular mb-1">
                    <span className="text-cyan-300">Oxigênio ({telemetry.maxOxygenSeconds}s)</span>
                    <span className={telemetry.oxygenPct < 25 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {telemetry.oxygenPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${telemetry.oxygenPct < 25 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                      style={{ width: `${telemetry.oxygenPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Subsystem Damage Alert */}
              {lowHullWarning && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300 font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Avaria detectada ({telemetry.condition.hullIntegrityPct.toFixed(0)}%) · Repare no estaleiro ou use Kit (I)
                </div>
              )}
            </div>

            {hudMode === 'full' && (
              <MissionTracker
                mission={telemetry.mission}
                activeCampaignMission={telemetry.activeMission}
              />
            )}

            {/* VHF Radio Feed */}
            {hudMode === 'full' && radioLog.length > 0 && (
              <div className="mt-2 bg-[#071520]/88 border border-sky-700/50 rounded-lg px-3 py-2 max-w-[310px] text-[11px]">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-300 mb-0.5">
                  <Radio className="w-3 h-3" />
                  {radioLog[0].sender} · {radioLog[0].channel}
                </div>
                <div className="text-slate-200 leading-snug">{radioLog[0].text}</div>
              </div>
            )}
          </div>

          {/* Notification Toasts (Top Center) */}
          {notifications.length > 0 && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-1.5 pointer-events-none">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-3.5 py-2 rounded-lg border shadow-lg text-xs ${
                    n.tone === 'success'
                      ? 'bg-emerald-950/92 border-emerald-500/60 text-emerald-100'
                      : n.tone === 'danger'
                        ? 'bg-rose-950/92 border-rose-500/60 text-rose-100'
                        : n.tone === 'warning'
                          ? 'bg-amber-950/92 border-amber-500/60 text-amber-100'
                          : 'bg-[#071520]/94 border-sky-500/60 text-slate-100'
                  }`}
                >
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-[11px] opacity-90">{n.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top-Right Compact Action & Mode Bar */}
          <div className="absolute top-3 right-3 pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
            {!isOnline && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-900/90 border border-amber-500/50 text-amber-200 text-xs font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </div>
            )}

            <div className="inline-flex items-center bg-[#071520]/90 border border-slate-700/65 rounded-lg p-0.5">
              <Camera className="w-3.5 h-3.5 text-slate-400 mx-1.5 hidden sm:block" />
              {CAMERA_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleChangeCamera(m.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    cameraMode === m.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {hudMode === 'full' && (
              <>
                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleFishingMode()}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer whitespace-nowrap ${
                    telemetry.controlMode === 'fishing'
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950 font-semibold'
                      : 'bg-[#071520]/90 border-slate-700/65 text-slate-200 hover:border-cyan-400/60'
                  }`}
                  title="Pesca Marítima (P)"
                >
                  <Fish className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Pescar (P)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDealershipOpen((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-400/60 cursor-pointer whitespace-nowrap"
                  title="Concessionária Naval & Garagem"
                >
                  <Ship className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden lg:inline">Frota</span>
                </button>

                {telemetry.submarine.unlocked && telemetry.controlMode !== 'submarine' && (
                  <button
                    type="button"
                    onClick={() => engineRef.current?.enterSubmarineMode()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-900/80 border border-cyan-500/60 text-xs text-cyan-100 hover:bg-cyan-800 cursor-pointer whitespace-nowrap"
                    title="Operar Submersível NEREID S-1"
                  >
                    <Radar className="w-3.5 h-3.5 text-cyan-300" />
                    <span className="hidden xl:inline">NEREID S-1</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setInventoryOpen((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-400/60 cursor-pointer whitespace-nowrap"
                  title="Inventário, Viveiro & Habilidades (I)"
                >
                  <Backpack className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden lg:inline">Porão (I)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setJournalOpen((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-400/60 cursor-pointer whitespace-nowrap"
                  title="Diário de Missões (J)"
                >
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden lg:inline">Diário (J)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('inspect_vessel')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-sky-400/60 cursor-pointer whitespace-nowrap"
                  title={`Inspecionar ${activeVessel?.customName ?? 'Embarcação'}`}
                >
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden xl:inline">{activeVessel?.customName ?? 'Aster S-01'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMapExpanded((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer whitespace-nowrap ${
                    mapExpanded
                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-semibold'
                      : 'bg-[#071520]/90 border-slate-700/65 text-slate-200 hover:border-amber-500/60'
                  }`}
                  title="Carta Náutica (M)"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Mapa (M)</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleCycleLighting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-500/60 cursor-pointer whitespace-nowrap"
              title="Alternar Período / Iluminação"
            >
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden md:inline">
                {params.lighting && params.lighting !== 'auto'
                  ? LIGHTING_PRESETS[params.lighting].label
                  : 'Luz Auto'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCycleWeather}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-500/60 cursor-pointer whitespace-nowrap"
              title="Alternar Clima (F2)"
            >
              <CloudSun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{WEATHER_PRESETS[params.weather].label}</span>
            </button>

            <button
              type="button"
              onClick={handleCycleHudMode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-xs text-slate-200 hover:border-amber-400/60 cursor-pointer whitespace-nowrap"
              title="Alternar Modo HUD (Completo / Reduzido / Cinema · Tecla H)"
            >
              {hudMode === 'compact' ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-sky-300" />
              )}
              <span className="hidden xl:inline">HUD (H)</span>
            </button>

            {hudMode === 'full' && (
              <button
                type="button"
                onClick={() =>
                  handleChangeParams({ ...params, debugPhysics: !params.debugPhysics })
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer whitespace-nowrap ${
                  params.debugPhysics
                    ? 'bg-emerald-700/90 border-emerald-400 text-white'
                    : 'bg-[#071520]/90 border-slate-700/65 text-slate-300 hover:text-white'
                }`}
                title="Vetores 3D de Física (F1)"
              >
                <span className="font-mono-tabular">F1</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-slate-200 hover:text-amber-300 cursor-pointer"
              aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {!isInstalled && (isInstallable || isIOS) && (
              <button
                type="button"
                onClick={() => (isInstallable ? void install() : setShowIOSInstallGuide(true))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar App
              </button>
            )}

            <button
              type="button"
              onClick={() => setPhase('paused')}
              className="p-1.5 rounded-lg bg-[#071520]/90 border border-slate-700/65 text-slate-200 hover:text-amber-300 cursor-pointer"
              aria-label="Pausar simulação (Esc)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Contextual Prompt */}
          {telemetry.activePrompt && !mapExpanded && !activeModal && !inventoryOpen && !journalOpen && !dealershipOpen && (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={() => engineRef.current?.triggerInteraction()}
                disabled={Boolean(telemetry.activePrompt.blockedReason)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-xl text-left transition-colors ${
                  telemetry.activePrompt.blockedReason
                    ? 'bg-[#071520]/94 border-rose-500/60 text-slate-200 cursor-not-allowed'
                    : 'bg-[#071520]/95 border-amber-400/80 hover:border-amber-300 text-white cursor-pointer'
                }`}
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-amber-500 text-slate-950 font-mono-tabular font-bold text-xs shrink-0">
                  {telemetry.activePrompt.keyLabel}
                </span>
                <div>
                  <div className="text-xs font-semibold leading-tight">
                    {telemetry.activePrompt.label}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {telemetry.activePrompt.blockedReason || telemetry.activePrompt.sublabel}
                  </div>
                </div>
              </button>
            </div>
          )}

          {hudMode === 'full' && (
            <>
              {telemetry.controlMode === 'sailing' && (
                <div className="absolute bottom-3 left-3 hidden md:block">
                  <WindRoseGauge telemetry={telemetry} />
                </div>
              )}

              <div className="absolute bottom-3 right-3">
                <NavigationMap
                  telemetry={telemetry}
                  expanded={mapExpanded}
                  onToggleExpand={() => setMapExpanded((prev) => !prev)}
                />
              </div>
            </>
          )}

          {/* v0.7 Dedicated Mode & Combat HUDs */}
          <FishingHUD
            telemetry={telemetry}
            onStartCharge={() => engineRef.current?.startFishingCharge()}
            onReleaseCast={() => engineRef.current?.releaseFishingCast()}
            onHookOrReel={() => engineRef.current?.triggerFishingHookOrReel()}
            onSelectRod={(id) => engineRef.current?.selectFishingRod(id)}
            onSelectBait={(id) => engineRef.current?.selectFishingBait(id)}
            onExitFishing={() => engineRef.current?.toggleFishingMode()}
          />

          <DivingHUD
            telemetry={telemetry}
            onToggleFlashlight={() => engineRef.current?.toggleDiveFlashlight()}
          />

          <SubmarineHUD
            telemetry={telemetry}
            onToggleHeadlights={() => engineRef.current?.toggleSubmarineHeadlights()}
            onTriggerArm={() => engineRef.current?.triggerSubmarineArmCollect()}
            onExitSubmarine={() => engineRef.current?.exitSubmarineToPortOrSurface()}
          />

          <CombatThreatHUD
            telemetry={telemetry}
            onFireCannon={() => engineRef.current?.firePlayerCannon()}
            onPayBribe={() => engineRef.current?.payPirateBribe()}
            onCallDistress={() => engineRef.current?.callPortDistressHelp()}
            onExtinguishFires={() => engineRef.current?.extinguishDeckFires()}
          />

          <PhysicsLabDrawer
            open={labOpen}
            onToggleOpen={() => setLabOpen((prev) => !prev)}
            params={params}
            controls={controlsEcho}
            telemetry={telemetry}
            geoSector={geoSector}
            campaign={campaign}
            isOnline={isOnline}
            onChangeParams={handleChangeParams}
            onChangeWeather={handleChangeWeather}
            onChangeControls={handleChangeControls}
            onRunScenario={handleRunScenario}
            onResetVessel={() => engineRef.current?.resetToPort()}
            onStartGeo={handleRequestGeo}
            onStopGeo={handleStopGeo}
            onResetDefaults={handleResetDefaults}
          />
        </div>
      )}

      {activeModal && (
        <PortInteractionModal
          type={activeModal}
          telemetry={telemetry}
          params={params}
          onRefuelPaid={() => engineRef.current?.refuelWithCredits() ?? { ok: false, message: '' }}
          onRepairPaid={() => engineRef.current?.repairSubsystemsWithCredits() ?? { ok: false, message: '' }}
          onBuyShopItem={(id) => engineRef.current?.buyShopItem(id) ?? { ok: false, message: '' }}
          onSellMarketItem={(id) => engineRef.current?.sellMarketItem(id) ?? { ok: false, message: '' }}
          onSellAllFish={() =>
            engineRef.current?.sellAllFishCatches() ?? { soldCount: 0, earnedCr: 0, releasedProtected: 0 }
          }
          onBuyUpgrade={(slot) => engineRef.current?.buyUpgrade(slot) ?? { ok: false, message: '' }}
          onAcceptMission={(id) => engineRef.current?.acceptMission(id) ?? { ok: false, message: '' }}
          onBoardVessel={() => engineRef.current?.boardVessel()}
          onOpenMap={() => setMapExpanded(true)}
          onOpenJournal={() => setJournalOpen(true)}
          onOpenDealership={() => setDealershipOpen(true)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {dealershipOpen && (
        <NavalMarketplaceModal
          telemetry={telemetry}
          onBuyVessel={(id) => engineRef.current?.buyMarketplaceVessel(id) ?? { ok: false, message: '' }}
          onSellVessel={(id) => engineRef.current?.sellOwnedVessel(id) ?? { ok: false, message: '' }}
          onSwitchVessel={(id) => engineRef.current?.switchActiveVessel(id) ?? { ok: false, message: '' }}
          onCustomizeVessel={(patch) => engineRef.current?.customizeActiveVessel(patch)}
          onBuyUpgrade={(slot) => engineRef.current?.buyExtendedUpgrade(slot) ?? { ok: false, message: '' }}
          onClose={() => setDealershipOpen(false)}
        />
      )}

      {inventoryOpen && (
        <InventoryEquipmentModal
          telemetry={telemetry}
          onUseItem={(id) => engineRef.current?.useInventoryItem(id)}
          onClose={() => setInventoryOpen(false)}
        />
      )}

      {journalOpen && (
        <MissionJournalModal
          telemetry={telemetry}
          onAcceptMission={(id) => engineRef.current?.acceptMission(id)}
          onCancelMission={(id) => engineRef.current?.cancelMission(id)}
          onClose={() => setJournalOpen(false)}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          audioVolumes={audioVolumes}
          onChangeAudioVolumes={handleChangeAudioVolumes}
          onSaveCampaign={handleSaveCampaign}
          onResume={() => setPhase('playing')}
          onResetVessel={() => engineRef.current?.resetToPort()}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {showIOSInstallGuide && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="max-w-sm w-full bg-[#071520] border border-slate-700 rounded-xl p-5 text-slate-100">
            <h3 className="font-display text-base font-bold mb-2">Instalar Abyssal Frontier</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              1. Toque no ícone de <strong>Compartilhar</strong> na barra do Safari.
              <br />
              2. Role e selecione <strong>Adicionar à Tela de Início</strong> para executar em
              modo offline completo.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSInstallGuide(false)}
              className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
