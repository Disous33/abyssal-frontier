import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Cpu,
  FlaskConical,
  HardDrive,
  MapPin,
  MapPinOff,
  RotateCcw,
  Ship,
  Sliders,
  Sparkles,
  Sun,
  XCircle,
} from 'lucide-react';
import { createGraphicsSettingsForProfile, REPRODUCIBLE_SCENARIOS } from '../sim/scenarios';
import {
  CampaignBlueprintState,
  ControlInputs,
  GeoSectorInfo,
  GraphicsProfile,
  GraphicsSettings,
  LightingPresetId,
  ScenarioId,
  SimulationParams,
  TelemetrySnapshot,
  WeatherPresetId,
} from '../sim/types';
import { LIGHTING_PRESETS, WEATHER_PRESETS } from '../sim/weatherSystem';
import { runNavalPhysicsTestSuite, TestCaseResult } from '../tests/physics.test';

interface PhysicsLabDrawerProps {
  open: boolean;
  onToggleOpen: () => void;
  params: SimulationParams;
  controls: ControlInputs;
  telemetry: TelemetrySnapshot;
  geoSector: GeoSectorInfo;
  campaign: CampaignBlueprintState;
  isOnline: boolean;
  onChangeParams: (next: SimulationParams) => void;
  onChangeWeather: (preset: WeatherPresetId) => void;
  onChangeControls: (patch: Partial<ControlInputs>) => void;
  onRunScenario: (id: ScenarioId) => void;
  onResetVessel: () => void;
  onStartGeo: () => void;
  onStopGeo: () => void;
  onResetDefaults: () => void;
}

type LabTab = 'physics' | 'graphics_profiler' | 'weather_scenarios' | 'geo_campaign';

export const PhysicsLabDrawer: React.FC<PhysicsLabDrawerProps> = ({
  open,
  onToggleOpen,
  params,
  controls,
  telemetry,
  geoSector,
  campaign,
  isOnline,
  onChangeParams,
  onChangeWeather,
  onChangeControls,
  onRunScenario,
  onResetVessel,
  onStartGeo,
  onStopGeo,
  onResetDefaults,
}) => {
  const [activeTab, setActiveTab] = useState<LabTab>('physics');
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);
  const [testing, setTesting] = useState(false);

  const gs: GraphicsSettings =
    params.graphicsSettings ?? createGraphicsSettingsForProfile(params.graphics);

  const handleRunTests = async () => {
    setTesting(true);
    try {
      const res = await runNavalPhysicsTestSuite();
      setTestResults(res);
    } finally {
      setTesting(false);
    }
  };

  const updateWind = (patch: Partial<SimulationParams['wind']>) => {
    onChangeParams({ ...params, wind: { ...params.wind, ...patch } });
  };

  const updateOcean = (patch: Partial<SimulationParams['ocean']>) => {
    onChangeParams({ ...params, ocean: { ...params.ocean, ...patch } });
  };

  const updateVessel = (patch: Partial<SimulationParams['vessel']>) => {
    onChangeParams({ ...params, vessel: { ...params.vessel, ...patch } });
  };

  const updateGraphicsSettings = (patch: Partial<GraphicsSettings>) => {
    onChangeParams({
      ...params,
      graphicsSettings: { ...gs, ...patch },
    });
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] pointer-events-none flex flex-col items-center">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="pointer-events-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-t-lg bg-[#071520]/94 border border-b-0 border-slate-700/70 text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
      >
        <Sliders className="w-3.5 h-3.5 text-amber-400" />
        <span>Laboratório Naval</span>
        <span className="text-slate-400 font-mono-tabular">Tab</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="pointer-events-auto w-full bg-[#071520]/95 border border-slate-700/75 rounded-lg shadow-2xl overflow-hidden">
          {/* Tab Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800/90 bg-[#051018]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('physics')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'physics'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Telemetria & Física
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('graphics_profiler')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'graphics_profiler'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gráficos & Profiler
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weather_scenarios')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'weather_scenarios'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" />
                Clima, Cenários & Testes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('geo_campaign')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'geo_campaign'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Geolocalização & Campanha
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetVessel}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
                title="Reposicionar embarcação na origem"
              >
                <RotateCcw className="w-3 h-3" />
                Reposicionar
              </button>
              <button
                type="button"
                onClick={onResetDefaults}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
              >
                Padrão
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 max-h-[340px] overflow-y-auto naval-scroll">
            {activeTab === 'physics' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Live Physical Telemetry Table */}
                <div className="lg:col-span-5 bg-[#051018] border border-slate-800 rounded p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
                    <span className="font-medium text-slate-200">Telemetria Física em Tempo Real</span>
                    <span className="font-mono-tabular text-emerald-400">{telemetry.fps} FPS</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <TelemetryRow label="Velocidade" value={`${telemetry.speedKnots.toFixed(1)} kts (${telemetry.speedMs.toFixed(1)} m/s)`} />
                    <TelemetryRow label="Rumo / COG" value={`${Math.round(telemetry.headingDeg)}° / ${Math.round(telemetry.courseOverGroundDeg)}°`} />
                    <TelemetryRow label="Roll (Balanço)" value={`${telemetry.rollDeg.toFixed(1)}°`} />
                    <TelemetryRow label="Pitch (Arfagem)" value={`${telemetry.pitchDeg.toFixed(1)}°`} />
                    <TelemetryRow label="Yaw Rate" value={`${telemetry.yawRateDegS.toFixed(1)} °/s`} />
                    <TelemetryRow label="Deriva (Leeway)" value={`${telemetry.leewayDeg.toFixed(1)}°`} />
                    <TelemetryRow label="Vento Real" value={`${telemetry.trueWindKnots.toFixed(1)} kts @ ${Math.round(telemetry.trueWindDirDeg)}°`} />
                    <TelemetryRow label="Vento Aparente" value={`${telemetry.apparentWindKnots.toFixed(1)} kts (${Math.round(telemetry.apparentWindRelDeg)}°)`} />
                    <TelemetryRow label="Força Aero" value={`${(telemetry.aeroForceN / 1000).toFixed(2)} kN`} />
                    <TelemetryRow label="Empuxo (Flut.)" value={`${(telemetry.buoyancyForceN / 1000).toFixed(1)} kN`} />
                    <TelemetryRow label="Arrasto Hidro" value={`${(telemetry.hydroDragN / 1000).toFixed(2)} kN`} />
                    <TelemetryRow label="Sustent. Quilha" value={`${(telemetry.keelLiftN / 1000).toFixed(2)} kN`} />
                  </div>
                </div>

                {/* Interactive Physics Sliders */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
                  <SliderRow
                    label="Vento Verdadeiro"
                    valueText={`${params.wind.speedKnots.toFixed(0)} kts`}
                    min={0}
                    max={45}
                    step={1}
                    value={params.wind.speedKnots}
                    onChange={(v) => updateWind({ speedKnots: v })}
                  />
                  <SliderRow
                    label="Direção do Vento"
                    valueText={`${Math.round(params.wind.directionDeg)}°`}
                    min={0}
                    max={359}
                    step={5}
                    value={params.wind.directionDeg}
                    onChange={(v) => updateWind({ directionDeg: v })}
                  />
                  <SliderRow
                    label="Amplitude das Ondas"
                    valueText={`${params.ocean.waveScale.toFixed(2)}×`}
                    min={0.05}
                    max={2.4}
                    step={0.05}
                    value={params.ocean.waveScale}
                    onChange={(v) => updateOcean({ waveScale: v })}
                  />
                  <SliderRow
                    label="Corrente Marítima"
                    valueText={`${params.ocean.currentSpeed.toFixed(2)} m/s`}
                    min={0}
                    max={3.0}
                    step={0.05}
                    value={params.ocean.currentSpeed}
                    onChange={(v) => updateOcean({ currentSpeed: v })}
                  />
                  <SliderRow
                    label="Massa da Embarcação"
                    valueText={`${Math.round(params.vessel.massKg)} kg`}
                    min={4200}
                    max={11000}
                    step={100}
                    value={params.vessel.massKg}
                    onChange={(v) => updateVessel({ massKg: v })}
                  />
                  <SliderRow
                    label="Centro de Massa (Y)"
                    valueText={`${params.vessel.comOffsetY >= 0 ? '+' : ''}${params.vessel.comOffsetY.toFixed(2)} m`}
                    min={-0.6}
                    max={0.4}
                    step={0.05}
                    value={params.vessel.comOffsetY}
                    onChange={(v) => updateVessel({ comOffsetY: v })}
                  />
                  <SliderRow
                    label="Área das Velas"
                    valueText={`${Math.round(controls.sailArea * 100)}%`}
                    min={0}
                    max={1}
                    step={0.05}
                    value={controls.sailArea}
                    onChange={(v) => onChangeControls({ sailArea: v })}
                  />
                  <SliderRow
                    label="Ângulo da Vela (Escota)"
                    valueText={`${Math.round(controls.sailTrim * 100)}%`}
                    min={0.08}
                    max={1}
                    step={0.02}
                    value={controls.sailTrim}
                    onChange={(v) => onChangeControls({ sailTrim: v })}
                  />
                  <SliderRow
                    label="Leme Manual"
                    valueText={`${Math.round(controls.rudderTarget * 34)}°`}
                    min={-1}
                    max={1}
                    step={0.05}
                    value={controls.rudderTarget}
                    onChange={(v) => onChangeControls({ rudderTarget: v })}
                  />
                  <SliderRow
                    label="Amortecimento Hidro"
                    valueText={`${params.vessel.hullDamping.toFixed(2)}×`}
                    min={0.4}
                    max={2.2}
                    step={0.05}
                    value={params.vessel.hullDamping}
                    onChange={(v) => updateVessel({ hullDamping: v })}
                  />

                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                      <span className="text-slate-400">Qualidade Gráfica:</span>
                      {(['low', 'medium', 'high', 'ultra'] as GraphicsProfile[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            onChangeParams({
                              ...params,
                              graphics: g,
                              graphicsSettings: createGraphicsSettingsForProfile(g),
                            })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize cursor-pointer ${
                            params.graphics === g
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onChangeParams({ ...params, debugPhysics: !params.debugPhysics })
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                        params.debugPhysics
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Vetores 3D (F1): {params.debugPhysics ? 'Ativo' : 'Oculto'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'graphics_profiler' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                {/* WebGL Live Profiler & Illumination Presets */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="bg-[#051018] border border-slate-800 rounded p-3">
                    <div className="flex items-center justify-between text-slate-300 mb-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        WebGL2 Profiler em Tempo Real
                      </span>
                      <span className="font-mono-tabular text-emerald-400 font-semibold">
                        {telemetry.fps} FPS · {telemetry.renderStats?.frameTimeMs.toFixed(1) ?? '—'} ms
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <TelemetryRow
                        label="Draw Calls"
                        value={`${telemetry.renderStats?.drawCalls ?? '—'}`}
                      />
                      <TelemetryRow
                        label="Triângulos"
                        value={
                          telemetry.renderStats
                            ? telemetry.renderStats.triangles.toLocaleString('pt-BR')
                            : '—'
                        }
                      />
                      <TelemetryRow
                        label="Geometrias GPU"
                        value={`${telemetry.renderStats?.geometries ?? '—'}`}
                      />
                      <TelemetryRow
                        label="Texturas GPU"
                        value={`${telemetry.renderStats?.textures ?? '—'}`}
                      />
                      <TelemetryRow
                        label="Heap JS"
                        value={
                          telemetry.renderStats?.jsHeapMb != null
                            ? `${telemetry.renderStats.jsHeapMb} MB`
                            : 'Indisponível'
                        }
                      />
                      <TelemetryRow label="Perfil Base" value={params.graphics.toUpperCase()} />
                    </div>
                  </div>

                  {/* Illumination Presets */}
                  <div className="bg-[#051018] border border-slate-800 rounded p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      Iluminação & Período (HDR)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {(
                        [
                          ['auto', 'Automático'],
                          ['dawn', LIGHTING_PRESETS.dawn.label],
                          ['noon', LIGHTING_PRESETS.noon.label],
                          ['sunset', LIGHTING_PRESETS.sunset.label],
                          ['clear_night', LIGHTING_PRESETS.clear_night.label],
                          ['overcast_night', LIGHTING_PRESETS.overcast_night.label],
                          ['storm', LIGHTING_PRESETS.storm.label],
                        ] as Array<[LightingPresetId, string]>
                      ).map(([lid, label]) => (
                        <button
                          key={lid}
                          type="button"
                          onClick={() => onChangeParams({ ...params, lighting: lid })}
                          className={`px-2 py-1.5 rounded text-[11px] font-medium text-left cursor-pointer border ${
                            (params.lighting ?? 'auto') === lid
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Granular Graphics Settings (Zero Reload) */}
                <div className="lg:col-span-7 bg-[#051018] border border-slate-800 rounded p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <span className="font-semibold text-slate-200">Configuração Gráfica Ao Vivo</span>
                    <div className="flex items-center gap-1.5">
                      {(['low', 'medium', 'high', 'ultra'] as GraphicsProfile[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            onChangeParams({
                              ...params,
                              graphics: g,
                              graphicsSettings: createGraphicsSettingsForProfile(g),
                            })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-medium uppercase cursor-pointer ${
                            params.graphics === g
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                    <SliderRow
                      label="Escala de Render"
                      valueText={`${Math.round(gs.renderScale * 100)}%`}
                      min={0.65}
                      max={1.25}
                      step={0.05}
                      value={gs.renderScale}
                      onChange={(v) => updateGraphicsSettings({ renderScale: v })}
                    />
                    <SliderRow
                      label="Pixel Ratio Máximo"
                      valueText={`${gs.maxPixelRatio.toFixed(1)}×`}
                      min={1.0}
                      max={2.0}
                      step={0.1}
                      value={gs.maxPixelRatio}
                      onChange={(v) => updateGraphicsSettings({ maxPixelRatio: v })}
                    />
                    <SliderRow
                      label="Distância de Visão"
                      valueText={`${Math.round(gs.viewDistanceM)} m`}
                      min={1500}
                      max={5500}
                      step={250}
                      value={gs.viewDistanceM}
                      onChange={(v) => updateGraphicsSettings({ viewDistanceM: v })}
                    />
                    <SliderRow
                      label="Densidade de Partículas"
                      valueText={`${Math.round(gs.particleDensity * 100)}%`}
                      min={0.2}
                      max={1.5}
                      step={0.1}
                      value={gs.particleDensity}
                      onChange={(v) => updateGraphicsSettings({ particleDensity: v })}
                    />
                    <SliderRow
                      label="Densidade de Vegetação"
                      valueText={`${Math.round(gs.vegetationDensity * 100)}%`}
                      min={0.0}
                      max={1.5}
                      step={0.1}
                      value={gs.vegetationDensity}
                      onChange={(v) => updateGraphicsSettings({ vegetationDensity: v })}
                    />

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-300">Qualidade de Sombras</span>
                      <div className="flex gap-1">
                        {(['off', 'low', 'medium', 'high'] as GraphicsSettings['shadowQuality'][]).map((sq) => (
                          <button
                            key={sq}
                            type="button"
                            onClick={() => updateGraphicsSettings({ shadowQuality: sq })}
                            className={`flex-1 py-1 rounded text-[11px] uppercase cursor-pointer ${
                              gs.shadowQuality === sq
                                ? 'bg-amber-500 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {sq}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-300">Malha do Oceano</span>
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high', 'ultra'] as GraphicsProfile[]).map((oq) => (
                          <button
                            key={oq}
                            type="button"
                            onClick={() => updateGraphicsSettings({ oceanQuality: oq })}
                            className={`flex-1 py-1 rounded text-[11px] uppercase cursor-pointer ${
                              gs.oceanQuality === oq
                                ? 'bg-sky-600 text-white font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {oq}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => updateGraphicsSettings({ reflections: !gs.reflections })}
                        className={`flex-1 py-1.5 rounded text-[11px] font-medium cursor-pointer border ${
                          gs.reflections
                            ? 'bg-emerald-700/80 border-emerald-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        Reflexos: {gs.reflections ? 'Ativo' : 'Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateGraphicsSettings({ postProcessing: !gs.postProcessing })}
                        className={`flex-1 py-1.5 rounded text-[11px] font-medium cursor-pointer border ${
                          gs.postProcessing
                            ? 'bg-emerald-700/80 border-emerald-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        Pós-Proc HDR: {gs.postProcessing ? 'Ativo' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'weather_scenarios' && (
              <div className="space-y-4">
                {/* Weather Presets */}
                <div>
                  <div className="text-xs font-medium text-slate-300 mb-2">
                    Clima Dinâmico (Transição Gradual · Tecla F2)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {(Object.keys(WEATHER_PRESETS) as WeatherPresetId[]).map((presetKey) => {
                      const info = WEATHER_PRESETS[presetKey];
                      const active = params.weather === presetKey;
                      return (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() => onChangeWeather(presetKey)}
                          className={`p-2 rounded border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-[#051018] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-medium">{info.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono-tabular">
                            {info.windKnots} kts · {info.waveScale.toFixed(1)}×
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 13 Reproducible Scenarios */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">
                      Cenários Reproduzíveis de Engenharia (13 Presets)
                    </span>
                    <button
                      type="button"
                      disabled={testing}
                      onClick={handleRunTests}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      {testing ? 'Executando...' : 'Executar Testes Automatizados'}
                    </button>
                  </div>

                  {testResults && (
                    <div className="mb-3 bg-[#051018] border border-emerald-700/40 rounded p-2.5 space-y-1.5">
                      {testResults.map((r) => (
                        <div key={r.name} className="flex items-start gap-2 text-xs">
                          {r.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-medium text-slate-100">{r.name}: </span>
                            <span className="text-slate-400">{r.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {REPRODUCIBLE_SCENARIOS.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => onRunScenario(sc.id)}
                        className="p-2.5 rounded bg-[#051018] border border-slate-800 hover:border-amber-500/60 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-100">{sc.title}</span>
                          <span className="text-[10px] text-amber-400">{sc.category}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{sc.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'geo_campaign' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Geolocation & Offline Storage */}
                <div className="bg-[#051018] border border-slate-800 rounded p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      Geolocalização Opcional & Privacidade
                    </span>
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      {geoSector.monitoringActive ? 'Monitorando' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Setor atual: <strong className="text-slate-200">{geoSector.sectorName}</strong> ·{' '}
                    {geoSector.climateZone} ({geoSector.latitudeBand}). Coordenadas brutas não são
                    transmitidas a servidores nem exibidas publicamente.
                  </p>
                  {geoSector.errorMessage && (
                    <p className="text-amber-300 text-[11px]">{geoSector.errorMessage}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onStartGeo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-medium cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Ativar watchPosition()
                    </button>
                    <button
                      type="button"
                      onClick={onStopGeo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                    >
                      <MapPinOff className="w-3.5 h-3.5" />
                      Interromper Monitoramento
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                      IndexedDB & Service Worker PWA
                    </span>
                    <span className="font-mono-tabular">
                      Rede: {isOnline ? 'Online (Cache Pronto)' : 'Offline Ativo'}
                    </span>
                  </div>
                </div>

                {/* Kael Rivera Campaign Architecture */}
                <div className="bg-[#051018] border border-slate-800 rounded p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <Ship className="w-3.5 h-3.5 text-amber-400" />
                      Arquitetura de Campanha Offline
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono-tabular">
                      Cap. {campaign.captainName}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Embarcação: <span className="text-slate-200">{campaign.vesselName}</span> ({campaign.vesselClass}) ·
                    Porto Base: <span className="text-slate-200">{campaign.homePort}</span> ·
                    Milhas registradas: <span className="font-mono-tabular text-amber-300">{(campaign.voyageMilesTotal + telemetry.distanceNm).toFixed(2)} nm</span>.
                  </p>
                  <div className="space-y-1.5">
                    {campaign.activeDirectives.map((dir) => (
                      <div
                        key={dir.id}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70 last:border-b-0"
                      >
                        <div>
                          <div className="text-slate-200 font-medium">{dir.title}</div>
                          <div className="text-[10px] text-slate-400">{dir.faction}</div>
                        </div>
                        <span className="text-[10px] font-mono-tabular text-slate-400">
                          {dir.status === 'ready' ? 'Núcleo Ativo' : 'Módulo Futuro'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TelemetryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1">
    <span className="text-slate-400">{label}</span>
    <span className="font-mono-tabular text-slate-100">{value}</span>
  </div>
);

const SliderRow: React.FC<{
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, valueText, min, max, step, value, onChange }) => (
  <label className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono-tabular text-amber-300">{valueText}</span>
    </div>
    <input
      type="range"
      className="naval-slider w-full"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </label>
);
