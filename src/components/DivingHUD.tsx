import React from 'react';
import { AlertTriangle, Compass, Flashlight, Waves } from 'lucide-react';
import { TelemetrySnapshot } from '../sim/types';

interface DivingHUDProps {
  telemetry: TelemetrySnapshot;
  onToggleFlashlight: () => void;
}

export const DivingHUD: React.FC<DivingHUDProps> = ({ telemetry, onToggleFlashlight }) => {
  if (telemetry.controlMode !== 'diving' && telemetry.controlMode !== 'swimming') {
    return null;
  }

  const u = telemetry.underwater;
  const isDiving = telemetry.controlMode === 'diving';

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[min(94vw,480px)]">
      <div className="bg-[#071520]/94 border border-cyan-700/70 rounded-xl p-3.5 shadow-2xl text-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-bold text-white leading-tight">{u.environmentName}</div>
              <div className="text-[10px] text-slate-400">
                {isDiving ? 'Submerso · C descer · Espaço subir · E recolher' : 'Natação na superfície · Pressione C para mergulhar'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleFlashlight}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
              u.flashlightOn
                ? 'bg-amber-400 border-amber-300 text-slate-950'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400'
            }`}
            title="Lanterna Subaquática (F)"
          >
            <Flashlight className="w-3.5 h-3.5" />
            Lanterna (F)
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-[11px]">
          <div className="bg-[#051018] border border-slate-800 rounded p-2">
            <div className="text-[10px] text-slate-400">Profundidade</div>
            <div className={`font-bold mt-0.5 ${u.depthM > u.maxSafeDepthM ? 'text-rose-400' : 'text-cyan-300'}`}>
              {u.depthM.toFixed(1)} / {u.maxSafeDepthM.toFixed(0)}m
            </div>
          </div>
          <div className="bg-[#051018] border border-slate-800 rounded p-2">
            <div className="text-[10px] text-slate-400">Pressão</div>
            <div className="font-bold text-slate-100 mt-0.5">{u.pressureAtm.toFixed(2)} atm</div>
          </div>
          <div className="bg-[#051018] border border-slate-800 rounded p-2">
            <div className="text-[10px] text-slate-400">Temp. / Visib.</div>
            <div className="font-bold text-slate-100 mt-0.5">
              {u.waterTempC.toFixed(0)}°C · {u.visibilityM.toFixed(0)}m
            </div>
          </div>
          <div className="bg-[#051018] border border-slate-800 rounded p-2">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Compass className="w-3 h-3 text-sky-400" />
              Corrente
            </div>
            <div className="font-bold text-sky-300 mt-0.5">{u.currentSpeedMs.toFixed(2)} m/s</div>
          </div>
        </div>

        {isDiving && (
          <div className="bg-[#051018] border border-slate-800 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-[10px] font-mono-tabular">
              <span className="text-slate-300">Descompressão (Mecânica simplificada de gameplay)</span>
              <span className={u.decompressionRiskPct >= 75 ? 'text-rose-400 font-bold' : 'text-amber-300'}>
                {Math.round(u.decompressionRiskPct)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${u.decompressionRiskPct >= 75 ? 'bg-rose-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.round(u.decompressionRiskPct)}%` }}
              />
            </div>
          </div>
        )}

        {u.depthWarning && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/60 text-[11px] text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{u.depthWarning}</span>
          </div>
        )}
      </div>
    </div>
  );
};
