import React from 'react';
import { Crosshair, Flame, Radio, ShieldAlert, Skull } from 'lucide-react';
import { TelemetrySnapshot } from '../sim/types';

interface CombatThreatHUDProps {
  telemetry: TelemetrySnapshot;
  onFireCannon: () => void;
  onPayBribe: () => void;
  onCallDistress: () => void;
  onExtinguishFires: () => void;
}

export const CombatThreatHUD: React.FC<CombatThreatHUDProps> = ({
  telemetry,
  onFireCannon,
  onPayBribe,
  onCallDistress,
  onExtinguishFires,
}) => {
  if (telemetry.controlMode !== 'sailing') return null;

  const c = telemetry.combat;
  const showHud = c.threatLevel !== 'none' || c.playerArmed || c.activeFires > 0;
  if (!showHud) return null;

  const activeHostile = telemetry.pirates
    .slice()
    .sort((a, b) => a.distToPlayerM - b.distToPlayerM)[0];

  const isCombat = c.threatLevel === 'combat' || c.activeFires > 0;

  return (
    <div className="fixed top-20 right-3 z-20 pointer-events-auto w-[min(92vw,310px)]">
      <div
        className={`rounded-xl border p-3 shadow-2xl text-slate-100 space-y-2 ${
          isCombat
            ? 'bg-rose-950/92 border-rose-500/75'
            : c.threatLevel === 'alert'
              ? 'bg-amber-950/92 border-amber-500/70'
              : 'bg-[#071520]/92 border-slate-700/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5">
            {isCombat ? (
              <Skull className="w-4 h-4 text-rose-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            {c.threatLevel === 'combat'
              ? 'Ameaça Hostil em Combate'
              : c.threatLevel === 'alert'
                ? 'Embarcação Suspeita Próxima'
                : 'Defesa Naval Ativa'}
          </span>
          {c.nearestThreatDistM !== null && (
            <span className="font-mono-tabular text-[11px] text-amber-300">
              {Math.round(c.nearestThreatDistM)} m
            </span>
          )}
        </div>

        {activeHostile && c.threatLevel !== 'none' && (
          <div className="text-[11px] text-slate-200 bg-slate-950/60 rounded px-2.5 py-1.5 flex items-center justify-between font-mono-tabular">
            <span className="truncate">{activeHostile.name}</span>
            <span className="text-amber-300 uppercase text-[10px]">
              {activeHostile.aiState} · {Math.round(activeHostile.hullPct)}%
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {c.playerArmed && (
            <button
              type="button"
              disabled={c.cannonCooldownS > 0.05}
              onClick={onFireCannon}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              {c.cannonCooldownS > 0.05
                ? `Recarga ${c.cannonCooldownS.toFixed(1)}s`
                : 'Disparar (Espaço/G)'}
            </button>
          )}

          {c.intimidatePromptActive && (
            <button
              type="button"
              onClick={onPayBribe}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
            >
              Pagar Pedágio ({c.bribeCostCr} CR)
            </button>
          )}

          {c.activeFires > 0 && (
            <button
              type="button"
              onClick={onExtinguishFires}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              Apagar Fogo ({c.activeFires})
            </button>
          )}

          {c.threatLevel !== 'none' && (
            <button
              type="button"
              onClick={onCallDistress}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              Apoio VHF
            </button>
          )}
        </div>

        {c.threatLevel !== 'none' && (
          <div className="text-[10px] text-slate-300 leading-snug">
            Evasão: acelere, use neblina/chuva ou aproxime-se a &lt;145 m do Porto de Santos.
          </div>
        )}
      </div>
    </div>
  );
};
