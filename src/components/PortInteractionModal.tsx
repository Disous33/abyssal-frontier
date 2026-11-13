import React, { useState } from 'react';
import {
  Anchor,
  ClipboardList,
  Compass,
  Fuel,
  Navigation,
  Shield,
  ShoppingBag,
  Store,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { calculateFullRepairCost } from '../sim/damageSystem';
import {
  computeCargoWeightKg,
  getItemQuantity,
  getUpgradeCost,
  ITEM_CATALOG,
  MARKET_TRADE_IDS,
  STORE_EQUIPMENT_IDS,
} from '../sim/economySystem';
import { isMissionUnlocked } from '../sim/missionManager';
import { InteractableType, SimulationParams, TelemetrySnapshot, VesselUpgrades } from '../sim/types';

interface PortInteractionModalProps {
  type: InteractableType;
  telemetry: TelemetrySnapshot;
  params: SimulationParams;
  onRefuelPaid: () => { ok: boolean; message: string };
  onRepairPaid: () => { ok: boolean; message: string };
  onBuyShopItem: (itemId: string) => { ok: boolean; message: string };
  onSellMarketItem: (itemId: string) => { ok: boolean; message: string };
  onSellAllFish: () => { soldCount: number; earnedCr: number; releasedProtected: number };
  onBuyUpgrade: (slot: keyof VesselUpgrades) => { ok: boolean; message: string };
  onAcceptMission: (missionId: string) => { ok: boolean; message: string };
  onBoardVessel: () => void;
  onOpenMap: () => void;
  onOpenJournal: () => void;
  onOpenDealership: () => void;
  onClose: () => void;
}

const UPGRADE_SLOTS: Array<{ slot: keyof VesselUpgrades; label: string; desc: string }> = [
  { slot: 'engineLevel', label: 'Motor Auxiliar', desc: '+22% de empuxo diesel por nível' },
  { slot: 'hullArmorLevel', label: 'Reforço de Casco', desc: '-22% de dano em colisões e encalhe' },
  { slot: 'sailRigLevel', label: 'Velame & Estaiamento', desc: '+14% de eficiência aerodinâmica' },
  { slot: 'cargoHoldLevel', label: 'Porão Expandido', desc: 'Capacidade até 220 kg / 340 kg' },
];

export const PortInteractionModal: React.FC<PortInteractionModalProps> = ({
  type,
  telemetry,
  params,
  onRefuelPaid,
  onRepairPaid,
  onBuyShopItem,
  onSellMarketItem,
  onSellAllFish,
  onBuyUpgrade,
  onAcceptMission,
  onBoardVessel,
  onOpenMap,
  onOpenJournal,
  onOpenDealership,
  onClose,
}) => {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const eco = telemetry.economy;
  const sub = telemetry.condition.subsystems;
  const repairCost = calculateFullRepairCost(sub);
  const fuelMissing = Math.max(0, 100 - telemetry.condition.fuelPct);
  const fuelCost = Math.max(0, Math.round(fuelMissing * 0.8));
  const currentWeight = computeCargoWeightKg(eco);

  const unlockedAvailable = telemetry.allMissions.filter(
    (m) =>
      (m.status === 'available' || m.status === 'cancelled' || m.status === 'failed') &&
      isMissionUnlocked(m, telemetry.allMissions),
  );

  const showResult = (res: { ok: boolean; message: string }) => {
    setNotice({ ok: res.ok, text: res.message });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 pointer-events-auto">
      <div className="w-full max-w-lg bg-[#071520] border border-slate-700/85 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#051018]">
          <div className="flex items-center gap-2.5">
            {type === 'npc_helena' && <UserCheck className="w-5 h-5 text-amber-400" />}
            {type === 'mission_board' && <ClipboardList className="w-5 h-5 text-amber-400" />}
            {type === 'fuel_station' && <Fuel className="w-5 h-5 text-amber-400" />}
            {type === 'dock_service' && <Wrench className="w-5 h-5 text-amber-400" />}
            {type === 'equipment_shop' && <ShoppingBag className="w-5 h-5 text-sky-400" />}
            {type === 'port_market' && <Store className="w-5 h-5 text-emerald-400" />}
            {type === 'inspect_vessel' && <Anchor className="w-5 h-5 text-sky-400" />}
            <div>
              <h3 className="font-display text-base font-bold text-white leading-tight">
                {type === 'npc_helena' && 'Comandante Helena Vance'}
                {type === 'mission_board' && 'Quadro de Missões Portuário'}
                {type === 'fuel_station' && 'Posto de Abastecimento Naval'}
                {type === 'dock_service' && 'Oficina Naval · Mecânico Tomás Braga'}
                {type === 'equipment_shop' && 'Loja de Equipamentos · Clara'}
                {type === 'port_market' && 'Mercado Portuário · Bento'}
                {type === 'inspect_vessel' && 'Inspeção Técnica · Aster S-01'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Porto de Santos · Saldo: <span className="text-amber-300 font-semibold">{eco.credits} CR</span> · Porão: {currentWeight.toFixed(1)}/{eco.maxCargoKg} kg
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar painel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto naval-scroll">
          {notice && (
            <div
              className={`px-3 py-2 rounded-lg border ${
                notice.ok
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              }`}
            >
              {notice.text}
            </div>
          )}

          {/* 1. Capitania / Helena Vance */}
          {type === 'npc_helena' && (
            <>
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-3.5 leading-relaxed text-slate-300 space-y-2">
                <p>
                  “Bem-vindo ao Porto de Santos, Kael. Sinais anômalos ligados à organização{' '}
                  <strong className="text-amber-300">Nereus</strong> foram detectados fora da Barra.”
                </p>
                <p>
                  “Prepare o <strong className="text-white">Aster S-01</strong>, visite a loja da Clara se
                  precisar de equipamento de mergulho e aceite as missões do Capítulo 1 abaixo.”
                </p>
              </div>

              {unlockedAvailable.slice(0, 2).map((m) => (
                <div key={m.id} className="bg-[#051018] border border-amber-500/40 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{m.title}</span>
                    <span className="font-mono-tabular text-amber-300 font-semibold">+{m.rewardCredits} CR</span>
                  </div>
                  <p className="text-slate-400">{m.summary}</p>
                  <button
                    type="button"
                    onClick={() => showResult(onAcceptMission(m.id))}
                    className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                  >
                    Aceitar Contrato
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenJournal();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium cursor-pointer"
                >
                  Diário de Missões (J)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMap();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  Carta Náutica (M)
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </>
          )}

          {/* 2. Mission Board */}
          {type === 'mission_board' && (
            <>
              <p className="text-slate-300">
                Contratos disponíveis emitidos pela Capitania e pelos terminais de Santos:
              </p>
              {unlockedAvailable.length === 0 ? (
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3.5 text-slate-400">
                  Não há novos contratos aguardando assinatura. Consulte o Diário (J) para acompanhar a missão ativa.
                </div>
              ) : (
                unlockedAvailable.map((m) => (
                  <div key={m.id} className="bg-[#051018] border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{m.title}</span>
                      <span className="font-mono-tabular text-amber-300 font-semibold">+{m.rewardCredits} CR</span>
                    </div>
                    <p className="text-slate-400">{m.summary}</p>
                    <button
                      type="button"
                      onClick={() => showResult(onAcceptMission(m.id))}
                      className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                    >
                      Aceitar Missão
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* 3. Fuel Station */}
          {type === 'fuel_station' && (
            <>
              <div className="grid grid-cols-2 gap-3 font-mono-tabular">
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Diesel Auxiliar</div>
                  <div className="text-lg font-bold text-white mt-0.5">{telemetry.condition.fuelPct.toFixed(0)}%</div>
                </div>
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Banco de Baterias</div>
                  <div className="text-lg font-bold text-sky-300 mt-0.5">{telemetry.condition.batteryPct.toFixed(0)}%</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => showResult(onRefuelPaid())}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
              >
                Completar Tanque & Carga ({fuelCost} CR)
              </button>
            </>
          )}

          {/* 4. Dockyard Service & Upgrades (Tomás Braga) */}
          {type === 'dock_service' && (
            <>
              <p className="text-slate-300">
                “Posso restaurar cada sistema avariado do Aster S-01 ou instalar melhorias navais.”
              </p>
              <div className="grid grid-cols-5 gap-1.5 text-center font-mono-tabular">
                {[
                  ['Casco', sub.hullPct],
                  ['Motor', sub.enginePct],
                  ['Leme', sub.rudderPct],
                  ['Mastro', sub.mastPct],
                  ['Velas', sub.sailsPct],
                ].map(([lbl, val]) => (
                  <div key={String(lbl)} className="bg-[#051018] border border-slate-800 rounded p-2">
                    <div className="text-[10px] text-slate-400">{lbl}</div>
                    <div className="font-bold text-white mt-0.5">{Number(val).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => showResult(onRepairPaid())}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
              >
                Reparo Completo de Subsistemas ({repairCost} CR)
              </button>

              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Melhorias da Embarcação
                </div>
                {UPGRADE_SLOTS.map((u) => {
                  const lvl = eco.upgrades[u.slot];
                  const cost = getUpgradeCost(u.slot, lvl);
                  return (
                    <div
                      key={u.slot}
                      className="flex items-center justify-between gap-2 bg-[#051018] border border-slate-800 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          {u.label} <span className="text-sky-300 font-mono-tabular">Nv.{lvl}/3</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{u.desc}</div>
                      </div>
                      <button
                        type="button"
                        disabled={lvl >= 3}
                        onClick={() => showResult(onBuyUpgrade(u.slot))}
                        className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer shrink-0"
                      >
                        {lvl >= 3 ? 'Máximo' : `${cost} CR`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 5. Equipment Shop (Clara) */}
          {type === 'equipment_shop' && (
            <>
              <p className="text-slate-300">
                “Equipamento confiável faz a diferença quando você precisa pescar na barra ou mergulhar nos destroços.”
              </p>
              {(
                [
                  {
                    label: 'Pesca Marítima & Iscas',
                    ids: STORE_EQUIPMENT_IDS.filter((id) => id.includes('_rod_') || id.includes('_reel_') || id.includes('_line_') || id.includes('_hook_') || id.includes('_tackle_') || id.includes('_fishing_') || id.startsWith('bait_')),
                  },
                  {
                    label: 'Mergulho & Sobrevivência Subaquática',
                    ids: STORE_EQUIPMENT_IDS.filter((id) => id.includes('diver') || id.includes('scuba') || id.includes('dive_')),
                  },
                  {
                    label: 'Equipamentos Navais & Reparo',
                    ids: STORE_EQUIPMENT_IDS.filter((id) => id === 'equip_repair_kit' || id === 'equip_vhf_scanner'),
                  },
                ] as const
              ).map((cat) => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider pt-1">
                    {cat.label}
                  </div>
                  {cat.ids.map((id) => {
                    const def = ITEM_CATALOG[id];
                    if (!def) return null;
                    const ownedQty = getItemQuantity(eco, id);
                    const isSingleEquip = def.kind === 'equipment' && ownedQty > 0;
                    const isConsumablePack = id === 'bait_shrimp' || id === 'bait_sardine';
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-3 bg-[#051018] border border-slate-800 rounded-lg px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {def.name}{' '}
                            <span className="text-[10px] text-slate-400">
                              ({def.unitWeightKg} kg{ownedQty > 0 && def.kind !== 'equipment' ? ` · Possui: ${ownedQty}` : ''})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{def.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isSingleEquip}
                          onClick={() => showResult(onBuyShopItem(id))}
                          className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-emerald-400 text-slate-950 font-semibold cursor-pointer shrink-0"
                        >
                          {isSingleEquip ? 'Adquirido' : `${isConsumablePack ? '5x · ' : ''}${def.basePriceCr} CR`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* 6. Port Market (Bento) */}
          {type === 'port_market' && (
            <>
              <p className="text-slate-300">
                “Compro pescado fresco, peças recuperadas do mar e forneço cargas comerciais para o canal.”
              </p>

              {/* Fish Livewell Sell Box */}
              {(() => {
                const unsoldFish = telemetry.fishingStats.catches.filter((c) => !c.sold);
                const estTotal = unsoldFish.reduce((acc, c) => acc + c.valueCr, 0);
                return (
                  <div className="bg-[#051018] border border-cyan-700/60 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-cyan-300">Viveiro de Pesca — Vender Pescado</div>
                        <div className="text-[11px] text-slate-400">
                          {unsoldFish.length === 0
                            ? 'Nenhum peixe fresco no viveiro.'
                            : `${unsoldFish.length} captura(s) prontas para venda (estimativa +${estTotal} CR)`}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={unsoldFish.length === 0}
                        onClick={() => {
                          const r = onSellAllFish();
                          setNotice({
                            ok: r.earnedCr > 0 || r.releasedProtected > 0,
                            text:
                              r.soldCount > 0 || r.releasedProtected > 0
                                ? `Vendidos ${r.soldCount} peixe(s) por +${r.earnedCr} CR${r.releasedProtected > 0 ? ` · ${r.releasedProtected} protegido(s) solto(s)` : ''}`
                                : 'Nenhum peixe no viveiro.',
                          });
                        }}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer shrink-0"
                      >
                        Vender Tudo
                      </button>
                    </div>
                    {unsoldFish.length > 0 && (
                      <div className="max-h-28 overflow-y-auto naval-scroll space-y-1">
                        {unsoldFish.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between text-[11px] bg-slate-950/70 rounded px-2 py-1"
                          >
                            <span className="text-slate-200">
                              {c.speciesName} · {c.weightKg.toFixed(1)} kg ({c.quality})
                            </span>
                            <span className={`font-mono-tabular ${c.protectedSpecies ? 'text-emerald-400' : 'text-amber-300'}`}>
                              {c.protectedSpecies ? 'Protegido (0 CR)' : `+${c.valueCr} CR`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                {MARKET_TRADE_IDS.map((id) => {
                  const def = ITEM_CATALOG[id];
                  const qty = getItemQuantity(eco, id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 bg-[#051018] border border-slate-800 rounded-lg px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white">
                          {def.name}{' '}
                          <span className="font-mono-tabular text-[10px] text-sky-300">
                            (No porão: {qty} · {def.unitWeightKg} kg)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{def.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {def.basePriceCr > 0 && (
                          <button
                            type="button"
                            onClick={() => showResult(onBuyShopItem(id))}
                            className="px-2.5 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold cursor-pointer"
                          >
                            Comprar {def.basePriceCr}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => showResult(onSellMarketItem(id))}
                          className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer"
                        >
                          Vender +{def.sellPriceCr}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDealership();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold cursor-pointer"
                >
                  Abrir Concessionária & Garagem Naval →
                </button>
              </div>
            </>
          )}

          {/* 7. Vessel Technical Inspection */}
          {type === 'inspect_vessel' && (
            <>
              <div className="grid grid-cols-2 gap-2.5 font-mono-tabular">
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Casco / Motor / Leme
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    {sub.hullPct.toFixed(0)}% · {sub.enginePct.toFixed(0)}% · {sub.rudderPct.toFixed(0)}%
                  </div>
                </div>
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">Combustível / Bateria</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">
                    {telemetry.condition.fuelPct.toFixed(0)}% · {telemetry.condition.batteryPct.toFixed(0)}%
                  </div>
                </div>
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">Massa / Porão</div>
                  <div className="text-sm font-semibold text-slate-100 mt-0.5">
                    {params.vessel.massKg.toLocaleString()} kg · {currentWeight.toFixed(0)}/{eco.maxCargoKg} kg
                  </div>
                </div>
                <div className="bg-[#051018] border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">Mastro / Velas</div>
                  <div className="text-sm font-semibold text-sky-300 mt-0.5">
                    {sub.mastPct.toFixed(0)}% · {sub.sailsPct.toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {telemetry.controlMode !== 'sailing' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onBoardVessel();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Embarcar Agora
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
