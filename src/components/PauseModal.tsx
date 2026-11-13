import React, { useState } from 'react';
import { BookOpen, Play, RotateCcw, Save, Volume2, X } from 'lucide-react';
import { AudioVolumesConfig } from '../sim/types';

interface PauseModalProps {
  audioVolumes: AudioVolumesConfig;
  onChangeAudioVolumes: (next: AudioVolumesConfig) => void;
  onSaveCampaign: () => boolean;
  onResume: () => void;
  onResetVessel: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  audioVolumes,
  onChangeAudioVolumes,
  onSaveCampaign,
  onResume,
  onResetVessel,
  onReturnTitle,
}) => {
  const [savedOk, setSavedOk] = useState(false);

  const updateChannel = (key: keyof AudioVolumesConfig, val: number) => {
    onChangeAudioVolumes({ ...audioVolumes, [key]: val });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 pointer-events-auto">
      <div className="w-full max-w-lg bg-[#071520] border border-slate-700/80 rounded-xl p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Simulação Pausada</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Abyssal Frontier 0.5 · Living Ocean Update
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar pausa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 space-y-3.5 max-h-[65vh] overflow-y-auto naval-scroll">
          <div className="bg-[#051018] border border-slate-800 rounded-lg p-3.5 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <BookOpen className="w-3.5 h-3.5" />
              Controles (Terra, Água/Mergulho & Aster S-01)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300 font-mono-tabular text-[11px]">
              <span>Terra · WASD / Shift : Andar / Correr</span>
              <span>Terra · E / Espaço : Interagir / Pular</span>
              <span>Água · U (no barco) : Saltar na Água</span>
              <span>Água · C / Espaço : Descer / Subir</span>
              <span>Barco · W / S : Motor Auxiliar</span>
              <span>Barco · A / D / Espaço : Leme / Centro</span>
              <span>Barco · Q / E : Vela (E no píer sai)</span>
              <span>Barco · R / F : Área Vélica (Rizo)</span>
              <span>Menus · I / J / M : Inv. / Diário / Mapa</span>
              <span>Lab · Tab / F1 / F2 / F3 : Física / Clima</span>
            </div>
          </div>

          <div className="bg-[#051018] border border-slate-800 rounded-lg p-3.5 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sky-300">
              <Volume2 className="w-3.5 h-3.5" />
              Mixagem de Áudio Procedural
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['master', 'Geral'],
                  ['ocean', 'Oceano & Chuva'],
                  ['motor', 'Motor'],
                  ['effects', 'Efeitos & Casco'],
                  ['radio', 'Rádio VHF'],
                ] as Array<[keyof AudioVolumesConfig, string]>
              ).map(([k, lbl]) => (
                <label key={k} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">{lbl}</span>
                    <span className="font-mono-tabular text-amber-300">
                      {Math.round(audioVolumes[k] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioVolumes[k]}
                    onChange={(e) => updateChannel(k, parseFloat(e.target.value))}
                    className="naval-slider w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          {savedOk && (
            <div className="px-3 py-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs">
              Progresso da campanha salvo localmente com validação de versão.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setSavedOk(onSaveCampaign())}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-medium text-white cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Salvar Campanha
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            Tela Inicial
          </button>
          <button
            type="button"
            onClick={() => {
              onResetVessel();
              onResume();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Porto
          </button>
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
