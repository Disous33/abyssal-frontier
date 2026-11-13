import React from 'react';
import { Anchor, Battery, Flashlight, Gauge, Hand, Radar } from 'lucide-react';
import { SonarContact, TelemetrySnapshot } from '../sim/types';

interface SubmarineHUDProps {
  telemetry: TelemetrySnapshot;
  onToggleHeadlights: () => void;
  onTriggerArm: () => void;
  onExitSubmarine: () => void;
}

const CONTACT_COLORS: Record<SonarContact['kind'], string> = {
  wreck: '#f59e0b',
  collectible: '#22d3ee',
  pirate: '#ef4444',
  vessel: '#38bdf8',
  reef: '#34d399',
  terrain: '#94a3b8',
};

export const SubmarineHUD: React.FC<SubmarineHUDProps> = ({
  telemetry,
  onToggleHeadlights,
  onTriggerArm,
  onExitSubmarine,
}) => {
  if (telemetry.controlMode !== 'submarine') return null;

  const sub = telemetry.submarine;
  const sweepRad = ((sub.sonarSweepDeg - 90) * Math.PI) / 180;
  const beamX = 80 + Math.cos(sweepRad) * 72;
  const beamY = 80 + Math.sin(sweepRad) * 72;

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[min(96vw,640px)]">
      <div className="bg-[#06131d]/95 border border-amber-500/60 rounded-xl p-4 shadow-2xl text-slate-100 flex flex-col sm:flex-row gap-4 items-center">
        {/* Active SVG Circular Sonar */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-300 mb-1 uppercase tracking-wider">
            <Radar className="w-3.5 h-3.5" />
            Sonar Ativo · {sub.sonarRangeM}m
          </div>
          <svg
            viewBox="0 0 160 160"
            className="w-36 h-36 rounded-full bg-[#031520] border border-cyan-500/50"
          >
            <circle cx={80} cy={80} r={24} fill="none" stroke="#0e4a61" strokeWidth={1} />
            <circle cx={80} cy={80} r={48} fill="none" stroke="#0e4a61" strokeWidth={1} />
            <circle cx={80} cy={80} r={72} fill="none" stroke="#155e75" strokeWidth={1.2} />
            <line x1={80} y1={8} x2={80} y2={152} stroke="#0e4a61" strokeWidth={0.8} />
            <line x1={8} y1={80} x2={152} y2={80} stroke="#0e4a61" strokeWidth={0.8} />

            {/* Sweep Beam */}
            <line x1={80} y1={80} x2={beamX} y2={beamY} stroke="#22d3ee" strokeWidth={2} opacity={0.85} />

            {/* Contacts relative to submarine heading */}
            {sub.sonarContacts.slice(0, 14).map((c) => {
              const normDist = Math.min(1, c.distM / Math.max(1, sub.sonarRangeM));
              const angleRad = ((c.relAngleDeg - 90) * Math.PI) / 180;
              const cx = 80 + Math.cos(angleRad) * normDist * 70;
              const cy = 80 + Math.sin(angleRad) * normDist * 70;
              return (
                <g key={c.id}>
                  <circle cx={cx} cy={cy} r={3.5} fill={CONTACT_COLORS[c.kind] ?? '#38bdf8'} />
                  <title>{`${c.label} (${Math.round(c.distM)}m)`}</title>
                </g>
              );
            })}

            <polygon points="80,74 84,84 76,84" fill="#eab308" />
          </svg>
        </div>

        {/* Telemetry & Submarine Controls */}
        <div className="flex-1 w-full space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
            <div>
              <div className="text-sm font-bold text-amber-300 leading-tight">{sub.modelName}</div>
              <div className="text-[10px] text-slate-400">
                W/S Empuxo · A/D Leme · Q/E Profundidade · F Faróis · R Braço
              </div>
            </div>
            <button
              type="button"
              onClick={onExitSubmarine}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 cursor-pointer shrink-0"
            >
              <Anchor className="w-3.5 h-3.5 text-amber-400" />
              Sair / Superfície (U)
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono-tabular text-center text-[11px]">
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400">Profund.</div>
              <div className={`font-bold ${sub.depthM > sub.maxSafeDepthM ? 'text-rose-400' : 'text-cyan-300'}`}>
                {sub.depthM.toFixed(1)}m
              </div>
            </div>
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400">Pressão</div>
              <div className="font-bold text-white">{sub.pressureAtm.toFixed(1)}atm</div>
            </div>
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400">Veloc.</div>
              <div className="font-bold text-white">{sub.speedKnots.toFixed(1)}kt</div>
            </div>
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400">Lastro</div>
              <div className="font-bold text-sky-300">{Math.round(sub.ballastPct)}%</div>
            </div>
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                <Battery className="w-2.5 h-2.5 text-emerald-400" />
                Bat.
              </div>
              <div className="font-bold text-emerald-300">{Math.round(sub.batteryPct)}%</div>
            </div>
            <div className="bg-[#041019] border border-slate-800 rounded p-1.5">
              <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                <Gauge className="w-2.5 h-2.5 text-amber-400" />
                Casco
              </div>
              <div className="font-bold text-amber-300">{Math.round(sub.hullPct)}%</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-slate-300 truncate max-w-[230px]">
              {sub.sonarContacts.length > 0
                ? `Alvo próximo: ${sub.sonarContacts[0].label} (${Math.round(sub.sonarContacts[0].distM)}m)`
                : 'Varredura limpa no raio do sonar'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleHeadlights}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-semibold cursor-pointer ${
                  sub.headlightsOn
                    ? 'bg-amber-400 border-amber-300 text-slate-950'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                Faróis (F)
              </button>
              <button
                type="button"
                onClick={onTriggerArm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                <Hand className="w-3.5 h-3.5" />
                Braço Coletor (R)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
