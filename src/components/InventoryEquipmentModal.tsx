import React, { useState } from 'react';
import { Award, Backpack, CheckCircle2, Fish, Package, Shield, Wrench, X } from 'lucide-react';
import { computeCargoWeightKg, ITEM_CATALOG } from '../sim/economySystem';
import { SKILL_LABELS } from '../sim/progressionSystem';
import { PlayerSkillKey, TelemetrySnapshot } from '../sim/types';

interface InventoryEquipmentModalProps {
  telemetry: TelemetrySnapshot;
  onUseItem: (itemId: string) => void;
  onClose: () => void;
}

type InventoryTab = 'cargo' | 'fish' | 'skills';

const SKILL_KEYS: PlayerSkillKey[] = [
  'navigation',
  'fishing',
  'diving',
  'exploration',
  'mechanics',
  'submarine',
];

export const InventoryEquipmentModal: React.FC<InventoryEquipmentModalProps> = ({
  telemetry,
  onUseItem,
  onClose,
}) => {
  const [tab, setTab] = useState<InventoryTab>('cargo');
  const eco = telemetry.economy;
  const currentWeight = computeCargoWeightKg(eco);
  const weightPct = Math.min(100, (currentWeight / Math.max(1, eco.maxCargoKg)) * 100);
  const sub = telemetry.condition.subsystems;
  const activeVessel =
    telemetry.garage.ownedVessels.find((v) => v.instanceId === telemetry.garage.activeVesselId) ??
    telemetry.garage.ownedVessels[0];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4 pointer-events-auto">
      <div className="w-full max-w-2xl bg-[#071520] border border-slate-700/85 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#051018]">
          <div className="flex items-center gap-2.5">
            <Backpack className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white leading-tight">
                Inventário, Viveiro & Habilidades (I)
              </h2>
              <p className="text-[11px] text-slate-400">
                Kael Rivera · {activeVessel?.customName ?? 'Aster S-01'} · Saldo:{' '}
                <span className="text-amber-300 font-semibold">{eco.credits} CR</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar inventário"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-b border-slate-800 bg-[#06121b] text-xs">
          <button
            type="button"
            onClick={() => setTab('cargo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'cargo' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Inventário & Carga
          </button>
          <button
            type="button"
            onClick={() => setTab('fish')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'fish' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Fish className="w-3.5 h-3.5" />
            Viveiro de Pesca ({telemetry.fishingStats.catches.filter((c) => !c.sold).length})
          </button>
          <button
            type="button"
            onClick={() => setTab('skills')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'skills' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Habilidades do Capitão
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto naval-scroll text-xs">
          {tab === 'cargo' && (
            <>
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-sky-400" />
                    Capacidade do Porão
                  </span>
                  <span className="font-mono-tabular text-amber-300">
                    {currentWeight.toFixed(1)} / {eco.maxCargoKg} kg (Nível {eco.upgrades.cargoHoldLevel})
                  </span>
                </div>
                <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${weightPct > 85 ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${weightPct}%` }}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Itens, Equipamentos & Pistas
                </h3>
                {eco.inventory.length === 0 ? (
                  <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-center text-slate-400">
                    O porão e a mochila estão vazios. Visite a Loja de Equipamentos ou Mercado no cais.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eco.inventory.map((entry) => {
                      const def = ITEM_CATALOG[entry.itemId];
                      if (!def) return null;
                      const equipped = eco.equippedIds.includes(entry.itemId);
                      return (
                        <div
                          key={entry.itemId}
                          className="flex items-center justify-between gap-3 bg-[#051018] border border-slate-800 rounded-lg px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100">{def.name}</span>
                              <span className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                ×{entry.quantity} · {(def.unitWeightKg * entry.quantity).toFixed(1)} kg
                              </span>
                              {equipped && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Equipado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{def.description}</p>
                          </div>

                          {def.kind === 'consumable' && (
                            <button
                              type="button"
                              onClick={() => onUseItem(entry.itemId)}
                              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                            >
                              <Wrench className="w-3 h-3" />
                              Usar Agora
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="text-[11px] font-semibold text-sky-300 flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    Subsistemas de {activeVessel?.customName ?? 'Aster S-01'}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Casco</span>
                    <span className="font-mono-tabular text-slate-100">{sub.hullPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Motor Auxiliar</span>
                    <span className="font-mono-tabular text-slate-100">{sub.enginePct.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Leme</span>
                    <span className="font-mono-tabular text-slate-100">{sub.rudderPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mastro / Velas</span>
                    <span className="font-mono-tabular text-slate-100">
                      {sub.mastPct.toFixed(0)}% / {sub.sailsPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="text-[11px] font-semibold text-amber-300 mb-1">
                    Melhorias Instaladas
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Motor / Hélice</span>
                    <span className="font-mono-tabular text-slate-100">
                      Nv.{eco.upgrades.engineLevel}/3 · Nv.{activeVessel?.upgrades.propellerLevel ?? 1}/3
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Blindagem de Casco</span>
                    <span className="font-mono-tabular text-slate-100">Nv.{eco.upgrades.hullArmorLevel}/3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Velame / Sonar</span>
                    <span className="font-mono-tabular text-slate-100">
                      Nv.{eco.upgrades.sailRigLevel}/3 · Nv.{activeVessel?.upgrades.sonarLevel ?? 1}/3
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Canhão Defensivo</span>
                    <span className="font-mono-tabular text-slate-100">
                      Nv.{activeVessel?.upgrades.weaponLevel ?? 0}/2
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'fish' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 font-mono-tabular">
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Capturas Totais</div>
                  <div className="text-lg font-bold text-cyan-300">{telemetry.fishingStats.totalCaught}</div>
                </div>
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Receita Acumulada em Pesca</div>
                  <div className="text-lg font-bold text-amber-300">{telemetry.fishingStats.totalSoldCr} CR</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400">
                Nota: valores, pesos e comportamento das espécies seguem parâmetros fictícios de gameplay. Venda suas capturas no Mercado do Bento no cais.
              </div>

              {telemetry.fishingStats.catches.length === 0 ? (
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-center text-slate-400">
                  Nenhuma captura registrada ainda. Pressione <strong className="text-white">P</strong> no píer ou em um barco lento para pescar.
                </div>
              ) : (
                <div className="space-y-2">
                  {telemetry.fishingStats.catches.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 bg-[#051018] border border-slate-800 rounded-lg px-3.5 py-2.5"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {c.speciesName}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                            {c.quality}
                          </span>
                          {c.protectedSpecies && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                              Protegida (Reserva)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          Peso: {c.weightKg.toFixed(2)} kg · {c.sold ? 'Vendida / Solta' : 'No Viveiro'}
                        </div>
                      </div>
                      <span className="font-mono-tabular font-bold text-amber-300">
                        {c.protectedSpecies ? '0 CR' : `+${c.valueCr} CR`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-2.5">
              {SKILL_KEYS.map((key) => {
                const entry = telemetry.progression[key];
                const meta = SKILL_LABELS[key];
                const pct = Math.min(100, Math.round((entry.xp / Math.max(1, entry.nextLevelXp)) * 100));
                return (
                  <div
                    key={key}
                    className="bg-[#051018] border border-slate-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{meta.title}</span>
                      <span className="font-mono-tabular text-emerald-300 font-bold">
                        Nível {entry.level} · {entry.xp}/{entry.nextLevelXp} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{meta.perkDesc}</p>
                    <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
