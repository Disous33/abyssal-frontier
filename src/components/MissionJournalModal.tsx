import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Compass, FileSearch, Play, X, XCircle } from 'lucide-react';
import { ITEM_CATALOG } from '../sim/economySystem';
import { isMissionUnlocked } from '../sim/missionManager';
import { TelemetrySnapshot } from '../sim/types';

interface MissionJournalModalProps {
  telemetry: TelemetrySnapshot;
  onAcceptMission: (missionId: string) => void;
  onCancelMission: (missionId: string) => void;
  onClose: () => void;
}

type JournalTab = 'active' | 'available' | 'completed' | 'clues';

export const MissionJournalModal: React.FC<MissionJournalModalProps> = ({
  telemetry,
  onAcceptMission,
  onCancelMission,
  onClose,
}) => {
  const [tab, setTab] = useState<JournalTab>('available');
  const all = telemetry.allMissions;

  const activeMissions = all.filter((m) => m.status === 'in_progress' || m.status === 'accepted');
  const availableMissions = all.filter(
    (m) =>
      (m.status === 'available' || m.status === 'cancelled' || m.status === 'failed') &&
      isMissionUnlocked(m, all),
  );
  const completedMissions = all.filter((m) => m.status === 'completed');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4 pointer-events-auto">
      <div className="w-full max-w-2xl bg-[#071520] border border-slate-700/85 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#051018]">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white leading-tight">
                Diário de Bordo · O Sinal do Atlântico (J)
              </h2>
              <p className="text-[11px] text-slate-400">
                Capítulos 1 e 2 · Águas de Santos, Pesca, Submersível & Ameaças
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar diário"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-b border-slate-800 bg-[#06121b] text-xs">
          <button
            type="button"
            onClick={() => setTab('available')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'available' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Disponíveis ({availableMissions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'active' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Em Andamento ({activeMissions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('completed')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'completed' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Concluídas ({completedMissions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('clues')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${
              tab === 'clues' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Pistas Nereus ({telemetry.storyCluesFound.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto naval-scroll text-xs">
          {tab === 'available' && (
            availableMissions.length === 0 ? (
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-slate-400">
                Nenhuma nova missão desbloqueada no momento. Conclua a missão atual para avançar no Capítulo 1.
              </div>
            ) : (
              availableMissions.map((m) => (
                <div key={m.id} className="bg-[#051018] border border-slate-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">Cap. {m.chapter}</span>
                        <span>{m.category} · {m.giverNpc}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">{m.title}</h3>
                    </div>
                    <span className="font-mono-tabular text-amber-300 font-semibold shrink-0">
                      +{m.rewardCredits} CR
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{m.summary}</p>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => onAcceptMission(m.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Aceitar Missão
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {tab === 'active' && (
            activeMissions.length === 0 ? (
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-slate-400">
                Nenhuma missão ativa. Selecione uma na aba Disponíveis.
              </div>
            ) : (
              activeMissions.map((m) => (
                <div key={m.id} className="bg-[#051018] border border-amber-500/45 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">Cap. {m.chapter}</span>
                        <span>{m.status === 'in_progress' ? 'Rastreamento Ativo' : 'Em Pausa'} · +{m.rewardCredits} CR</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">{m.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCancelMission(m.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 cursor-pointer"
                    >
                      <XCircle className="w-3 h-3" />
                      Cancelar
                    </button>
                  </div>
                  <p className="text-sky-300 font-medium">{m.objectiveText}</p>
                  <div className="space-y-1 pt-1">
                    {m.waypoints.map((wp) => (
                      <div key={wp.id} className="flex items-center gap-2 text-[11px]">
                        <Compass className={`w-3.5 h-3.5 ${wp.completed ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span className={wp.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                          {wp.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          )}

          {tab === 'completed' && (
            completedMissions.length === 0 ? (
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-slate-400">
                Nenhuma missão concluída ainda neste registro.
              </div>
            ) : (
              completedMissions.map((m) => (
                <div key={m.id} className="bg-[#051018] border border-emerald-700/40 rounded-lg p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {m.title}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{m.summary}</p>
                  </div>
                  <span className="font-mono-tabular text-emerald-300 font-semibold shrink-0">
                    +{m.rewardCredits} CR
                  </span>
                </div>
              ))
            )
          )}

          {tab === 'clues' && (
            telemetry.storyCluesFound.length === 0 ? (
              <div className="bg-[#051018] border border-slate-800 rounded-lg p-4 text-slate-400">
                Nenhuma evidência da organização Nereus catalogada ainda. Investigue a Barcaça Nereus-04 e os destroços submersos.
              </div>
            ) : (
              telemetry.storyCluesFound.map((cid) => {
                const def = ITEM_CATALOG[cid];
                return (
                  <div key={cid} className="bg-[#051018] border border-sky-700/50 rounded-lg p-3.5 flex items-start gap-3">
                    <FileSearch className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white">{def?.name || cid}</h4>
                      <p className="text-slate-300 mt-0.5">{def?.description}</p>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};
