import React from 'react';
import { Anchor, Fish, ShieldAlert, X } from 'lucide-react';
import { getItemQuantity, hasEquipment, ITEM_CATALOG } from '../sim/economySystem';
import { TelemetrySnapshot } from '../sim/types';

interface FishingHUDProps {
  telemetry: TelemetrySnapshot;
  onStartCharge: () => void;
  onReleaseCast: () => void;
  onHookOrReel: () => void;
  onSelectRod: (rodId: string) => void;
  onSelectBait: (baitId: string) => void;
  onExitFishing: () => void;
}

const BAIT_OPTIONS = [
  { id: 'bait_shrimp', label: 'Camarão' },
  { id: 'bait_sardine', label: 'Sardinha' },
  { id: 'bait_lure', label: 'Artificial' },
];

export const FishingHUD: React.FC<FishingHUDProps> = ({
  telemetry,
  onStartCharge,
  onReleaseCast,
  onHookOrReel,
  onSelectRod,
  onSelectBait,
  onExitFishing,
}) => {
  if (telemetry.controlMode !== 'fishing') return null;

  const f = telemetry.fishing;
  const eco = telemetry.economy;
  const hasBasicRod = hasEquipment(eco, 'equip_rod_basic');
  const hasProRod = hasEquipment(eco, 'equip_rod_pro');
  const tensionColor =
    f.tensionPct >= 78 ? 'bg-rose-500' : f.tensionPct >= 52 ? 'bg-amber-400' : 'bg-emerald-400';

  const rodName = ITEM_CATALOG[f.equippedRodId]?.name ?? 'Vara Equipada';

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[min(94vw,520px)]">
      <div className="bg-[#071520]/94 border border-slate-700/85 rounded-xl p-4 shadow-2xl text-slate-100 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Fish className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-bold text-white leading-tight">
                Pesca Marítima · {rodName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tabular">
                Profundidade local: {f.zoneDepthM.toFixed(1)} m · Linha máx. {f.maxLineM} m (parâmetros fictícios de gameplay)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onExitFishing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Guardar (P)
          </button>
        </div>

        {/* Protected Sanctuary Notice */}
        {f.inProtectedZone && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-[11px] text-emerald-200">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Reserva Costeira Laje Norte:</strong> Garoupa-da-Pedra é protegida (soltura obrigatória · 0 CR).
            </span>
          </div>
        )}

        {/* Rod & Bait Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Vara:</span>
            {hasBasicRod && (
              <button
                type="button"
                onClick={() => onSelectRod('equip_rod_basic')}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  f.equippedRodId === 'equip_rod_basic'
                    ? 'bg-sky-600 border-sky-400 text-white font-semibold'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                Simples
              </button>
            )}
            {hasProRod && (
              <button
                type="button"
                onClick={() => onSelectRod('equip_rod_pro')}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  f.equippedRodId === 'equip_rod_pro'
                    ? 'bg-sky-600 border-sky-400 text-white font-semibold'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                Pro
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Isca:</span>
            {BAIT_OPTIONS.map((b) => {
              const qty = getItemQuantity(eco, b.id);
              const active = f.equippedBaitId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={qty <= 0 && !active}
                  onClick={() => onSelectBait(b.id)}
                  className={`px-2 py-1 rounded border font-mono-tabular cursor-pointer disabled:opacity-40 ${
                    active
                      ? 'bg-amber-500 border-amber-300 text-slate-950 font-semibold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {b.label} ({qty})
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Fishing Stage Display */}
        {f.stage === 'charging' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono-tabular">
              <span className="text-amber-300 font-semibold">Força do Arremesso</span>
              <span>{Math.round(f.castCharge * 100)}%</span>
            </div>
            <div className="w-full h-2.5 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${Math.round(f.castCharge * 100)}%` }} />
            </div>
          </div>
        )}

        {f.stage === 'bite' && (
          <div className="px-3.5 py-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-200 flex items-center justify-between text-xs font-bold">
            <span>FISGADA DETECTADA! Pressione Espaço ou Fisgar agora!</span>
            <span className="font-mono-tabular text-amber-300">{f.biteRemainingS.toFixed(1)}s</span>
          </div>
        )}

        {f.stage === 'reeling' && (
          <div className="space-y-2 bg-[#051018] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                {f.hookedSpeciesName ?? 'Peixe Fisgado'} ({f.hookedWeightKg.toFixed(1)} kg)
              </span>
              <span className="font-mono-tabular text-sky-300">
                Distância: {f.fishDistanceM.toFixed(1)} m · Fôlego {Math.round(f.fishStaminaPct)}%
              </span>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-mono-tabular mb-1">
                <span className="text-slate-400">Tensão da Linha</span>
                <span className={f.tensionPct >= 78 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {Math.round(f.tensionPct)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded bg-slate-800 overflow-hidden">
                <div className={`h-full ${tensionColor}`} style={{ width: `${Math.round(f.tensionPct)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Status Message & Action Button */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{f.statusMessage}</span>
          </div>

          {(f.stage === 'idle' || f.stage === 'caught' || f.stage === 'lost' || f.stage === 'charging') ? (
            <button
              type="button"
              onPointerDown={onStartCharge}
              onPointerUp={onReleaseCast}
              onPointerLeave={() => {
                if (f.stage === 'charging') onReleaseCast();
              }}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer select-none"
            >
              {f.stage === 'charging' ? 'Soltar para Lançar' : 'Segurar Arremesso (Espaço)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onHookOrReel}
              className="shrink-0 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              {f.stage === 'bite' ? 'Fisgar Agora!' : f.stage === 'reeling' ? 'Recolher (Segure Espaço)' : 'Recolher Linha'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
