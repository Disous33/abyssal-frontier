import React, { useMemo, useRef, useState } from 'react';
import { Anchor, Compass, Layers, Map as MapIcon, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
  BAIXADA_SANTISTA_LANDMARKS,
  BAIXADA_SANTISTA_POLYGONS,
  SANTOS_ORIGIN,
} from '../geo/baixadaSantistaData';
import { GeoWorldManager } from '../geo/geoWorldManager';
import { TelemetrySnapshot } from '../sim/types';

interface NavigationMapProps {
  telemetry: TelemetrySnapshot;
  expanded: boolean;
  onToggleExpand: () => void;
}

const CHART_BOUNDS_M = 4600;

export const NavigationMap: React.FC<NavigationMapProps> = ({
  telemetry,
  expanded,
  onToggleExpand,
}) => {
  const geoMgr = useMemo(() => new GeoWorldManager(SANTOS_ORIGIN), []);

  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursorGeo, setCursorGeo] = useState<{ lat: number; lon: number } | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const landPaths = useMemo(() => {
    return BAIXADA_SANTISTA_POLYGONS.map((poly) => {
      const pts = poly.coordinates
        .map((c) => {
          const lp = geoMgr.geoToLocal(c.lat, c.lon);
          return `${lp.x.toFixed(1)},${lp.z.toFixed(1)}`;
        })
        .join(' ');
      return { ...poly, points: pts };
    });
  }, [geoMgr]);

  const landmarks = useMemo(() => {
    return BAIXADA_SANTISTA_LANDMARKS.map((lm) => {
      const lp = geoMgr.geoToLocal(lm.coord.lat, lm.coord.lon);
      return { ...lm, lx: lp.x, lz: lp.z };
    });
  }, [geoMgr]);

  const boatChart = useMemo(
    () => geoMgr.geoToLocal(telemetry.geoLat, telemetry.geoLon),
    [geoMgr, telemetry.geoLat, telemetry.geoLon],
  );
  const kaelChart = useMemo(
    () => geoMgr.geoToLocal(telemetry.charLat, telemetry.charLon),
    [geoMgr, telemetry.charLat, telemetry.charLon],
  );

  // Active target waypoint on origin-anchored chart
  const targetPoint = useMemo(() => {
    const am = telemetry.activeMission;
    if (am) {
      const wp = am.waypoints[am.currentWaypointIndex];
      if (wp) return { x: wp.x, z: wp.z, active: true };
      if (am.returnToPortRequired) return { x: -8, z: 10, active: true };
    }
    return {
      x: telemetry.mission.checkpointLocalX,
      z: telemetry.mission.checkpointLocalZ,
      active: telemetry.mission.step !== 'completed',
    };
  }, [telemetry.activeMission, telemetry.mission]);

  // Project NPC vessels and active dynamic event relative to origin-anchored boatChart
  const npcMarkers = useMemo(
    () =>
      telemetry.npcVessels.map((v) => ({
        ...v,
        cx: boatChart.x + (v.x - telemetry.posX),
        cz: boatChart.z + (v.z - telemetry.posZ),
      })),
    [telemetry.npcVessels, boatChart.x, boatChart.z, telemetry.posX, telemetry.posZ],
  );

  const eventMarker = useMemo(() => {
    const ev = telemetry.activeEvent;
    if (!ev || !ev.active) return null;
    return {
      ...ev,
      cx: boatChart.x + (ev.x - telemetry.posX),
      cz: boatChart.z + (ev.z - telemetry.posZ),
    };
  }, [telemetry.activeEvent, boatChart.x, boatChart.z, telemetry.posX, telemetry.posZ]);

  const pirateMarkers = useMemo(
    () =>
      telemetry.pirates.map((p) => ({
        ...p,
        cx: boatChart.x + (p.x - telemetry.posX),
        cz: boatChart.z + (p.z - telemetry.posZ),
      })),
    [telemetry.pirates, boatChart.x, boatChart.z, telemetry.posX, telemetry.posZ],
  );

  const subChart = useMemo(
    () => ({
      x: boatChart.x + (telemetry.submarine.x - telemetry.posX),
      z: boatChart.z + (telemetry.submarine.z - telemetry.posZ),
    }),
    [telemetry.submarine.x, telemetry.submarine.z, boatChart.x, boatChart.z, telemetry.posX, telemetry.posZ],
  );

  const activeVessel =
    telemetry.garage.ownedVessels.find((v) => v.instanceId === telemetry.garage.activeVesselId) ??
    telemetry.garage.ownedVessels[0];

  const miniSize = 980;
  const miniCenterX = boatChart.x * 0.45 + 30;
  const miniCenterZ = boatChart.z * 0.45 + 140;
  const miniViewBox = `${miniCenterX - miniSize / 2} ${miniCenterZ - miniSize / 2} ${miniSize} ${miniSize}`;

  const chartHalf = CHART_BOUNDS_M / zoom;
  const chartViewBox = `${pan.x - chartHalf} ${pan.y - chartHalf} ${chartHalf * 2} ${chartHalf * 2}`;

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const wx = pan.x - chartHalf + nx * (chartHalf * 2);
    const wz = pan.y - chartHalf + ny * (chartHalf * 2);
    const g = geoMgr.localToGeo(wx, wz);
    setCursorGeo({ lat: g.lat, lon: g.lon });

    if (dragRef.current.active) {
      const dxPx = e.clientX - dragRef.current.startX;
      const dyPx = e.clientY - dragRef.current.startY;
      const mPerPx = (chartHalf * 2) / Math.max(1, rect.width);
      setPan({
        x: dragRef.current.origX - dxPx * mPerPx,
        y: dragRef.current.origY - dyPx * mPerPx,
      });
    }
  };

  const handleChartPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const handleChartPointerUp = () => {
    dragRef.current.active = false;
  };

  return (
    <>
      {/* Compact Bottom-Right Interactive Minimap */}
      {!expanded && (
        <div className="pointer-events-auto bg-[#071520]/92 border border-slate-700/75 rounded-lg p-2 shadow-xl w-[188px]">
          <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1.5">
            <span className="font-semibold tracking-wide flex items-center gap-1 text-amber-300">
              <Compass className="w-3 h-3" />
              SANTOS · SP
            </span>
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
              title="Abrir Carta Náutica (M)"
            >
              <Maximize2 className="w-2.5 h-2.5" />
              M
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            className="block w-full h-[128px] rounded overflow-hidden border border-slate-800 bg-[#052433] cursor-pointer"
            aria-label="Expandir mapa da Baixada Santista"
          >
            <svg viewBox={miniViewBox} className="w-full h-full">
              {landPaths.map((p) => (
                <polygon
                  key={p.id}
                  points={p.points}
                  fill="#27362e"
                  stroke="#526a5d"
                  strokeWidth={6}
                />
              ))}
              <rect x={-88} y={-65} width={76} height={120} fill="#64748b" />
              <rect x={-6} y={4} width={19} height={10} fill="#9a6e4a" />

              {/* Dive Sites & Protected Reserve */}
              <circle cx={45} cy={55} r={12} fill="#0ea5e9" fillOpacity={0.35} stroke="#38bdf8" strokeWidth={3} />
              <circle cx={-210} cy={520} r={120} fill="#10b981" fillOpacity={0.12} stroke="#34d399" strokeWidth={3} strokeDasharray="8 6" />

              {/* Planned Route */}
              {targetPoint.active && (
                <>
                  <line
                    x1={boatChart.x}
                    y1={boatChart.z}
                    x2={targetPoint.x}
                    y2={targetPoint.z}
                    stroke="#f59e0b"
                    strokeWidth={4}
                    strokeDasharray="12 10"
                    opacity={0.75}
                  />
                  <circle
                    cx={targetPoint.x}
                    cy={targetPoint.z}
                    r={22}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={6}
                  />
                </>
              )}

              {/* Active Ocean Event */}
              {eventMarker && (
                <circle
                  cx={eventMarker.cx}
                  cy={eventMarker.cz}
                  r={18}
                  fill="#ef4444"
                  fillOpacity={0.28}
                  stroke="#f87171"
                  strokeWidth={5}
                />
              )}

              {/* Hostile Pirates */}
              {pirateMarkers.map((p) => (
                <g key={p.id} transform={`translate(${p.cx}, ${p.cz}) rotate(${p.headingDeg})`}>
                  <polygon points="0,-18 11,13 -11,13" fill="#dc2626" stroke="#fecaca" strokeWidth={2} />
                </g>
              ))}

              {/* NPC Ships */}
              {npcMarkers.map((v) => (
                <g key={v.id} transform={`translate(${v.cx}, ${v.cz}) rotate(${v.headingDeg})`}>
                  <polygon
                    points="0,-16 9,12 -9,12"
                    fill={v.vesselType === 'nereus' ? '#ef4444' : '#38bdf8'}
                  />
                </g>
              ))}

              {/* Active Surface Vessel Heading Marker */}
              <g transform={`translate(${boatChart.x}, ${boatChart.z}) rotate(${telemetry.headingDeg})`}>
                <polygon
                  points="0,-24 14,18 0,10 -14,18"
                  fill="#f59e0b"
                  stroke="#071520"
                  strokeWidth={3}
                />
              </g>

              {/* Submarine Marker */}
              {telemetry.submarine.unlocked && (
                <polygon
                  points={`${subChart.x},${subChart.z - 14} ${subChart.x + 12},${subChart.z} ${subChart.x},${subChart.z + 14} ${subChart.x - 12},${subChart.z}`}
                  fill="#22d3ee"
                  stroke="#071520"
                  strokeWidth={2}
                />
              )}

              {/* Kael Rivera Marker when on foot or in water */}
              {telemetry.controlMode !== 'sailing' && (
                <circle
                  cx={kaelChart.x}
                  cy={kaelChart.z}
                  r={11}
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth={3}
                />
              )}
            </svg>
          </button>

          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
            <span>{telemetry.geoLat.toFixed(4)}°</span>
            <span>{telemetry.geoLon.toFixed(4)}°</span>
          </div>
        </div>
      )}

      {/* Enlarged Interactive Baixada Santista Nautical Chart Modal */}
      {expanded && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4 pointer-events-auto">
          <div className="w-full max-w-5xl h-[86vh] bg-[#071520] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-800 bg-[#051018]">
              <div className="flex items-center gap-3">
                <MapIcon className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="font-display text-base font-bold text-white leading-tight">
                    Carta Náutica Regional · Baixada Santista (Brasil)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Tráfego AIS · Áreas de Mergulho · Eventos Dinâmicos · Rota Ativa
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(8, z * 1.4))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Aproximar"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z / 1.4))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Afastar"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Porto
                </button>
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  aria-label="Fechar carta náutica"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-[#042130] overflow-hidden">
              <svg
                viewBox={chartViewBox}
                onMouseMove={handleChartMouseMove}
                onPointerDown={handleChartPointerDown}
                onPointerUp={handleChartPointerUp}
                onPointerLeave={handleChartPointerUp}
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              >
                <g stroke="#0e3c52" strokeWidth={10 / zoom} opacity={0.45}>
                  {[-4000, -3000, -2000, -1000, 0, 1000, 2000, 3000, 4000].map((v) => (
                    <React.Fragment key={v}>
                      <line x1={v} y1={-6000} x2={v} y2={6000} />
                      <line x1={-6000} y1={v} x2={6000} y2={v} />
                    </React.Fragment>
                  ))}
                </g>

                <text
                  x={-400}
                  y={2550}
                  fill="#1f6a8a"
                  fontSize={220 / Math.sqrt(zoom)}
                  fontWeight="700"
                  letterSpacing="18"
                >
                  OCEANO ATLÂNTICO
                </text>

                {landPaths.map((p) => (
                  <polygon
                    key={p.id}
                    points={p.points}
                    fill="#26382f"
                    stroke="#5f7a6c"
                    strokeWidth={16 / zoom}
                  />
                ))}

                <rect x={-88} y={-65} width={76} height={120} fill="#64748b" />
                <rect x={-6} y={4} width={19} height={10} fill="#b47b49" />

                {/* Underwater Dive Sites, Deep Biomes, Protected Reserve & Nereus-04 */}
                <g transform="translate(45, 55)">
                  <circle r={40 / zoom} fill="#0ea5e9" fillOpacity={0.22} stroke="#38bdf8" strokeWidth={8 / zoom} />
                  <text x={52 / zoom} y={10 / zoom} fill="#7dd3fc" fontSize={85 / zoom}>Recife do Píer (Mergulho)</text>
                </g>
                <g transform="translate(-145, 290)">
                  <circle r={48 / zoom} fill="#0ea5e9" fillOpacity={0.22} stroke="#22d3ee" strokeWidth={8 / zoom} />
                  <text x={55 / zoom} y={10 / zoom} fill="#67e8f9" fontSize={85 / zoom}>Caverna Ponta Grossa</text>
                </g>
                <g transform="translate(-210, 520)">
                  <circle r={120} fill="#10b981" fillOpacity={0.12} stroke="#34d399" strokeWidth={10 / zoom} strokeDasharray={`${32 / zoom} ${20 / zoom}`} />
                  <text x={132} y={10 / zoom} fill="#6ee7b7" fontSize={88 / zoom}>Laje Norte (Reserva · Mergulho)</text>
                </g>
                <g transform="translate(120, 720)">
                  <circle r={60 / zoom} fill="#0284c7" fillOpacity={0.22} stroke="#38bdf8" strokeWidth={8 / zoom} />
                  <text x={70 / zoom} y={10 / zoom} fill="#7dd3fc" fontSize={85 / zoom}>Fossa Nereus (-25m)</text>
                </g>
                <g transform="translate(-280, 880)">
                  <rect x={-26 / zoom} y={-26 / zoom} width={52 / zoom} height={52 / zoom} fill="#06b6d4" fillOpacity={0.3} stroke="#22d3ee" strokeWidth={8 / zoom} />
                  <text x={45 / zoom} y={10 / zoom} fill="#67e8f9" fontSize={85 / zoom}>Naufrágio Profundo Nereus-Alpha</text>
                </g>
                <g transform="translate(215, 610)">
                  <rect x={-25 / zoom} y={-25 / zoom} width={50 / zoom} height={50 / zoom} fill="#ef4444" fillOpacity={0.35} stroke="#f87171" strokeWidth={8 / zoom} />
                  <text x={45 / zoom} y={10 / zoom} fill="#fca5a5" fontSize={85 / zoom}>Barcaça Nereus-04</text>
                </g>

                {/* Planned Route */}
                {targetPoint.active && (
                  <>
                    <line
                      x1={boatChart.x}
                      y1={boatChart.z}
                      x2={targetPoint.x}
                      y2={targetPoint.z}
                      stroke="#f59e0b"
                      strokeWidth={14 / zoom}
                      strokeDasharray={`${42 / zoom} ${28 / zoom}`}
                    />
                    <circle
                      cx={targetPoint.x}
                      cy={targetPoint.z}
                      r={65 / Math.sqrt(zoom)}
                      fill="#f59e0b"
                      fillOpacity={0.18}
                      stroke="#f59e0b"
                      strokeWidth={14 / zoom}
                    />
                  </>
                )}

                {/* Active Dynamic Ocean Event */}
                {eventMarker && (
                  <g transform={`translate(${eventMarker.cx}, ${eventMarker.cz})`}>
                    <circle r={75 / Math.sqrt(zoom)} fill="#ef4444" fillOpacity={0.2} stroke="#f87171" strokeWidth={12 / zoom} />
                    <text x={55 / zoom} y={12 / zoom} fill="#fecaca" fontSize={95 / zoom} fontWeight="600">
                      {eventMarker.title}
                    </text>
                  </g>
                )}

                {/* Landmarks */}
                {landmarks.map((lm) => {
                  const color =
                    lm.kind === 'port'
                      ? '#38bdf8'
                      : lm.kind === 'checkpoint'
                        ? '#f59e0b'
                        : lm.kind === 'island'
                          ? '#34d399'
                          : '#e2e8f0';
                  return (
                    <g key={lm.id} transform={`translate(${lm.lx}, ${lm.lz})`}>
                      <circle r={34 / zoom} fill={color} stroke="#071520" strokeWidth={8 / zoom} />
                      <text x={48 / zoom} y={14 / zoom} fill={color} fontSize={105 / zoom} fontWeight="600">
                        {lm.name}
                      </text>
                    </g>
                  );
                })}

                {/* AI Traffic Vessels */}
                {npcMarkers.map((v) => (
                  <g key={v.id} transform={`translate(${v.cx}, ${v.cz})`}>
                    <g transform={`rotate(${v.headingDeg})`}>
                      <polygon
                        points={`0,${-65 / zoom} ${36 / zoom},${45 / zoom} ${-36 / zoom},${45 / zoom}`}
                        fill={v.vesselType === 'nereus' ? '#ef4444' : '#38bdf8'}
                        stroke="#071520"
                        strokeWidth={6 / zoom}
                      />
                    </g>
                    <text x={42 / zoom} y={10 / zoom} fill="#bae6fd" fontSize={82 / zoom}>
                      {v.name} ({v.speedKnots.toFixed(1)} kts)
                    </text>
                  </g>
                ))}

                {/* Hostile Pirate Vessels */}
                {pirateMarkers.map((p) => (
                  <g key={p.id} transform={`translate(${p.cx}, ${p.cz})`}>
                    <g transform={`rotate(${p.headingDeg})`}>
                      <polygon
                        points={`0,${-72 / zoom} ${42 / zoom},${52 / zoom} ${-42 / zoom},${52 / zoom}`}
                        fill="#dc2626"
                        stroke="#fecaca"
                        strokeWidth={7 / zoom}
                      />
                    </g>
                    <text x={48 / zoom} y={10 / zoom} fill="#fca5a5" fontSize={84 / zoom} fontWeight="700">
                      {p.name} ({p.aiState})
                    </text>
                  </g>
                ))}

                {/* Active Surface Vessel */}
                <g transform={`translate(${boatChart.x}, ${boatChart.z}) rotate(${telemetry.headingDeg})`}>
                  <polygon
                    points={`0,${-90 / zoom} ${52 / zoom},${65 / zoom} 0,${36 / zoom} ${-52 / zoom},${65 / zoom}`}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={10 / zoom}
                  />
                </g>

                {/* NEREID S-1 Submarine Marker */}
                {telemetry.submarine.unlocked && (
                  <g transform={`translate(${subChart.x}, ${subChart.z})`}>
                    <polygon
                      points={`0,${-62 / zoom} ${50 / zoom},0 0,${62 / zoom} ${-50 / zoom},0`}
                      fill="#22d3ee"
                      stroke="#ffffff"
                      strokeWidth={8 / zoom}
                    />
                    <text x={60 / zoom} y={10 / zoom} fill="#67e8f9" fontSize={82 / zoom}>
                      NEREID S-1 ({telemetry.submarine.depthM.toFixed(0)}m)
                    </text>
                  </g>
                )}

                {/* Kael Rivera */}
                <g transform={`translate(${kaelChart.x}, ${kaelChart.z})`}>
                  <circle r={32 / zoom} fill="#38bdf8" stroke="#ffffff" strokeWidth={8 / zoom} />
                </g>
              </svg>

              {/* Legend Overlay */}
              <div className="absolute bottom-3 left-3 bg-[#071520]/92 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-[11px] space-y-1">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <Anchor className="w-3.5 h-3.5" />
                  <span>{activeVessel?.customName ?? 'Aster S-01'}: {telemetry.geoLat.toFixed(5)}°, {telemetry.geoLon.toFixed(5)}°</span>
                </div>
                <div className="flex items-center gap-2 text-sky-300">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <span>
                    AIS: {npcMarkers.length} navios · Piratas: {pirateMarkers.length} · Modo:{' '}
                    {telemetry.controlMode === 'on_foot'
                      ? 'Em Terra'
                      : telemetry.controlMode === 'swimming'
                        ? 'Nadando'
                        : telemetry.controlMode === 'diving'
                          ? 'Submerso'
                          : telemetry.controlMode === 'fishing'
                            ? 'Pescando'
                            : telemetry.controlMode === 'submarine'
                              ? 'Submarino'
                              : 'No Leme'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-800 bg-[#051018] text-[11px] text-slate-400">
              <div className="flex items-center gap-4 font-mono-tabular">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Setores ativos: {telemetry.loadedSectorsCount}
                </span>
                <span>
                  Cursor WGS84:{' '}
                  {cursorGeo ? `${cursorGeo.lat.toFixed(5)}°, ${cursorGeo.lon.toFixed(5)}°` : 'Mova sobre a carta'}
                </span>
              </div>
              <span>Fonte: {telemetry.geoDataSource} · © OpenStreetMap contributors (ODbL)</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
