import React from 'react';
import { Compass, FolderOpen, MapPin, Play, ShieldCheck } from 'lucide-react';
import { AbyssalSaveFile } from '../services/saveSystem';
import { GeoSectorInfo } from '../sim/types';

interface TitleOverlayProps {
  ready: boolean;
  geoSector: GeoSectorInfo;
  savedCampaign: AbyssalSaveFile | null;
  onStart: () => void;
  onContinueSave: () => void;
  onRequestGeo: () => void;
  onSkipGeo: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  ready,
  geoSector,
  savedCampaign,
  onStart,
  onContinueSave,
  onRequestGeo,
  onSkipGeo,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full md:w-[560px]"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,19,28,0.9) 0%, rgba(6,19,28,0.65) 70%, rgba(6,19,28,0) 100%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" fill="#071520" stroke="#d99b26" strokeWidth="2.5" />
            <path d="M32 10 L32 42 L48 39 Z" fill="#f1f5f9" />
            <path d="M29 14 L29 41 L17 39 Z" fill="#94a3b8" />
            <path d="M14 45 L50 45 L45 52 L19 52 Z" fill="#0f3d52" stroke="#d99b26" strokeWidth="1.5" />
          </svg>
          <span className="font-display text-sm tracking-wider text-slate-200 font-semibold">
            ABYSSAL FRONTIER
          </span>
        </div>
        <span className="text-xs text-slate-300 font-mono-tabular">
          Aster S-01 · 12m Oceanic Sloop
        </span>
      </div>

      <div className="relative z-10 max-w-md my-auto pointer-events-auto">
        <p className="text-xs text-amber-400 font-medium tracking-wide mb-2">
          Edição 0.5 · Living Ocean Update · Porto de Santos (Brasil)
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.08] mb-4">
          Abyssal Frontier
        </h1>
        <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-6">
          Explore o cais vivo do Porto de Santos com Kael Rivera, negocie carga e equipamentos,
          navegue no <strong className="text-white">Aster S-01</strong> em meio ao tráfego marítimo
          e investigue os sinais da organização <strong className="text-amber-300">Nereus</strong> até
          os destroços submersos da Baía de Santos.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          {savedCampaign && (
            <button
              type="button"
              disabled={!ready}
              onClick={onContinueSave}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4" />
              Continuar ({savedCampaign.economy.credits} CR)
            </button>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={onStart}
            className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-lg font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
              savedCampaign
                ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {ready ? (savedCampaign ? 'Nova Expedição' : 'Iniciar em Porto de Santos') : 'Inicializando Física WASM...'}
          </button>
        </div>

        <div className="bg-[#081a26]/92 border border-slate-700/70 rounded-lg p-3.5 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-medium text-slate-100 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Cenário Oceânico Regional (Opcional)
            </span>
            <span className="text-[11px] text-slate-400">
              {geoSector.status === 'active'
                ? 'Setor Ativo'
                : geoSector.status === 'denied'
                  ? 'Modo Padrão'
                  : 'Offline'}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed mb-3">
            {geoSector.status === 'active'
              ? `${geoSector.sectorName} (${geoSector.climateZone}). Coordenadas mantidas apenas localmente.`
              : geoSector.errorMessage ||
                'Personalize vento e ondulação com base na sua faixa oceânica aproximada ou navegue em Santos sem localização.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestGeo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-900/70 hover:bg-sky-800/80 border border-sky-600/40 text-sky-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              Usar Localização Regional
            </button>
            <button
              type="button"
              onClick={onSkipGeo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/40 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Explorar sem Localização
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <span className="font-mono-tabular">
          Terra: WASD · E Interagir · I Inventário · J Diário · M Mapa · Água: U Mergulhar / C Descer · Barco: WS Motor · AD Leme · QE Vela
        </span>
        <span>Enter ou Espaço para começar</span>
      </div>
    </div>
  );
};
