import React, { useEffect, useRef, useState } from 'react';
import { Anchor, Check, Compass, Paintbrush, Shield, Ship, Wrench, X } from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCatalogVesselMesh, BuiltVesselMesh } from '../scene/vesselCatalogRenderer';
import {
  ExtendedVesselUpgrades,
  TelemetrySnapshot,
  VesselCategory,
} from '../sim/types';
import {
  computeEffectiveVesselCargoKg,
  getVesselSpecById,
  VESSEL_CATALOG,
  VESSEL_CATEGORY_LABELS,
  VESSEL_PAINT_PALETTE,
} from '../sim/vesselCatalog';

interface NavalMarketplaceModalProps {
  telemetry: TelemetrySnapshot;
  onBuyVessel: (specId: string) => { ok: boolean; message: string };
  onSellVessel: (instanceId: string) => { ok: boolean; message: string };
  onSwitchVessel: (instanceId: string) => { ok: boolean; message: string };
  onCustomizeVessel: (patch: {
    customName?: string;
    hullColorHex?: number;
    trimColorHex?: number;
  }) => void;
  onBuyUpgrade: (slot: keyof ExtendedVesselUpgrades) => { ok: boolean; message: string };
  onClose: () => void;
}

type MarketplaceTab = 'catalog' | 'garage' | 'customize';

const EXTENDED_UPGRADE_ROWS: Array<{
  slot: keyof ExtendedVesselUpgrades;
  label: string;
  desc: string;
  maxLvl: number;
  baseCost: number;
}> = [
  { slot: 'engineLevel', label: 'Motor / Propulsão', desc: '+22% empuxo efetivo por nível', maxLvl: 3, baseCost: 360 },
  { slot: 'propellerLevel', label: 'Hélice Hidrodinâmica', desc: '+14% tração e velocidade submersa', maxLvl: 3, baseCost: 300 },
  { slot: 'hullArmorLevel', label: 'Blindagem de Casco', desc: '-22% dano em colisões e combate', maxLvl: 3, baseCost: 320 },
  { slot: 'sailRigLevel', label: 'Velame & Estaiamento', desc: '+14% eficiência à vela (veleiros)', maxLvl: 3, baseCost: 340 },
  { slot: 'cargoHoldLevel', label: 'Porão Expandido', desc: '+100 kg capacidade por nível', maxLvl: 3, baseCost: 280 },
  { slot: 'sonarLevel', label: 'Sonar & Navegação', desc: '+90 m alcance sonar no NEREID S-1', maxLvl: 3, baseCost: 350 },
  { slot: 'lightingLevel', label: 'Iluminação Naval LED', desc: 'Maior alcance de holofotes noturnos', maxLvl: 3, baseCost: 220 },
  { slot: 'weaponLevel', label: 'Canhão Defensivo', desc: 'Defesa contra piratas em mar aberto (Espaço/G)', maxLvl: 2, baseCost: 540 },
];

export const NavalMarketplaceModal: React.FC<NavalMarketplaceModalProps> = ({
  telemetry,
  onBuyVessel,
  onSellVessel,
  onSwitchVessel,
  onCustomizeVessel,
  onBuyUpgrade,
  onClose,
}) => {
  const [tab, setTab] = useState<MarketplaceTab>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<VesselCategory | 'all'>('all');
  const [selectedSpecId, setSelectedSpecId] = useState<string>(VESSEL_CATALOG[0].id);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const activeOwned =
    telemetry.garage.ownedVessels.find((v) => v.instanceId === telemetry.garage.activeVesselId) ??
    telemetry.garage.ownedVessels[0];
  const activeSpec = getVesselSpecById(activeOwned.specId);
  const [customNameInput, setCustomNameInput] = useState(activeOwned.customName);

  useEffect(() => {
    setCustomNameInput(activeOwned.customName);
  }, [activeOwned.instanceId, activeOwned.customName]);

  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const rotAngleRef = useRef<number>(0.65);
  const dragRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });

  const previewSpec = getVesselSpecById(selectedSpecId);
  const previewHullColor =
    tab === 'customize' ? activeOwned.hullColorHex : previewSpec.defaultHullColor;
  const previewTrimColor =
    tab === 'customize' ? activeOwned.trimColorHex : previewSpec.defaultTrimColor;
  const previewSpecId = tab === 'customize' ? activeOwned.specId : selectedSpecId;
  const previewWeapon = tab === 'customize' ? activeOwned.upgrades.weaponLevel : previewSpec.armedCapable ? 1 : 0;

  // Interactive Three.js 3D Preview with clean disposal and software WebGL guard
  useEffect(() => {
    const container = previewMountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(180, container.clientHeight);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererInfo);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.5));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 120);
    const camDist = previewSpecId === 'atlantis_y8' ? 20 : previewSpecId === 'atlas_t2' ? 16 : previewSpecId === 'nereid_s1' ? 9.5 : 13;
    camera.position.set(camDist * 0.72, camDist * 0.36, camDist * 0.72);
    camera.lookAt(0, 0.6, 0);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9));

    const waterDiscGeo = new THREE.CircleGeometry(14, 32);
    waterDiscGeo.rotateX(-Math.PI / 2);
    const waterDiscMat = new THREE.MeshStandardMaterial({
      color: 0x083344,
      roughness: 0.25,
      metalness: 0.1,
    });
    const waterDisc = new THREE.Mesh(waterDiscGeo, waterDiscMat);
    waterDisc.position.y = -0.15;
    scene.add(waterDisc);

    const built: BuiltVesselMesh = buildCatalogVesselMesh(
      previewSpecId,
      previewHullColor,
      previewTrimColor,
      previewWeapon,
      isSoftwareGl,
    );
    scene.add(built.group);

    let rafId = 0;
    const renderFrame = () => {
      if (!dragRef.current.active) {
        rotAngleRef.current += isSoftwareGl ? 0.01 : 0.008;
      }
      built.group.rotation.y = rotAngleRef.current;
      renderer.render(scene, camera);
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        rafId = window.setTimeout(renderFrame, 90);
      }
    };
    renderFrame();

    const handleResize = () => {
      const w = Math.max(240, container.clientWidth);
      const h = Math.max(180, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (isSoftwareGl) clearTimeout(rafId);
      else cancelAnimationFrame(rafId);
      built.dispose();
      waterDiscGeo.dispose();
      waterDiscMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [previewSpecId, previewHullColor, previewTrimColor, previewWeapon]);

  const filteredCatalog =
    categoryFilter === 'all'
      ? VESSEL_CATALOG
      : VESSEL_CATALOG.filter((v) => v.category === categoryFilter);

  const showRes = (res: { ok: boolean; message: string }) => {
    setNotice({ ok: res.ok, text: res.message });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-3 sm:p-5 pointer-events-auto">
      <div className="w-full max-w-5xl h-[88vh] bg-[#071520] border border-slate-700/85 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#051018]">
          <div className="flex items-center gap-2.5">
            <Ship className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white leading-tight">
                Concessionária Naval & Garagem Marítima · Santos
              </h2>
              <p className="text-[11px] text-slate-400">
                Embarcação ativa: <strong className="text-sky-300">{activeOwned.customName}</strong> · Saldo:{' '}
                <strong className="text-amber-300 font-mono-tabular">{telemetry.economy.credits} CR</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'catalog' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Catálogo ({VESSEL_CATALOG.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('garage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'garage' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Garagem ({telemetry.garage.ownedVessels.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('customize')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'customize' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Personalizar & Melhorias
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Fechar concessionária"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mx-5 mt-3 px-3 py-2 rounded-lg border text-xs ${
              notice.ok
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/85 border-rose-500/50 text-rose-200'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Content Split: Left Interactive 3D Preview + Comparison, Right Tab Content */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-5 overflow-hidden">
          {/* Left 5 cols: 3D Preview */}
          <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
            <div className="relative h-56 lg:h-64 rounded-xl border border-slate-800 bg-[#04141f] overflow-hidden">
              <div
                ref={previewMountRef}
                onPointerDown={(e) => {
                  dragRef.current = { active: true, lastX: e.clientX };
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.lastX;
                  dragRef.current.lastX = e.clientX;
                  rotAngleRef.current += dx * 0.012;
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                }}
                onPointerLeave={() => {
                  dragRef.current.active = false;
                }}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              />
              <div className="absolute top-2.5 left-3 pointer-events-none">
                <div className="text-xs font-bold text-white">
                  {tab === 'customize' ? activeOwned.customName : previewSpec.name}
                </div>
                <div className="text-[10px] text-amber-300">
                  {VESSEL_CATEGORY_LABELS[(tab === 'customize' ? activeSpec : previewSpec).category]} · Arraste para girar 3D
                </div>
              </div>
            </div>

            {/* Technical Spec & Comparison Box */}
            <div className="bg-[#051018] border border-slate-800 rounded-xl p-3.5 text-xs space-y-2 overflow-y-auto naval-scroll">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Ficha Técnica & Comparação vs. {activeSpec.name}
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono-tabular">
                <div className="bg-slate-950/70 rounded p-2">
                  <div className="text-[10px] text-slate-400">Vel. Máxima</div>
                  <div className="font-bold text-white">
                    {previewSpec.maxSpeedKnots.toFixed(1)} kts{' '}
                    <span
                      className={
                        previewSpec.maxSpeedKnots >= activeSpec.maxSpeedKnots
                          ? 'text-emerald-400 text-[10px]'
                          : 'text-rose-400 text-[10px]'
                      }
                    >
                      ({previewSpec.maxSpeedKnots - activeSpec.maxSpeedKnots >= 0 ? '+' : ''}
                      {(previewSpec.maxSpeedKnots - activeSpec.maxSpeedKnots).toFixed(1)})
                    </span>
                  </div>
                </div>
                <div className="bg-slate-950/70 rounded p-2">
                  <div className="text-[10px] text-slate-400">Capacidade de Carga</div>
                  <div className="font-bold text-white">
                    {previewSpec.maxCargoKg} kg{' '}
                    <span
                      className={
                        previewSpec.maxCargoKg >= activeSpec.maxCargoKg
                          ? 'text-emerald-400 text-[10px]'
                          : 'text-rose-400 text-[10px]'
                      }
                    >
                      ({previewSpec.maxCargoKg - activeSpec.maxCargoKg >= 0 ? '+' : ''}
                      {previewSpec.maxCargoKg - activeSpec.maxCargoKg})
                    </span>
                  </div>
                </div>
                <div className="bg-slate-950/70 rounded p-2">
                  <div className="text-[10px] text-slate-400">Resistência / Massa</div>
                  <div className="font-bold text-sky-300">
                    {(previewSpec.hullStrength * 100).toFixed(0)}% · {(previewSpec.massKg / 1000).toFixed(1)}t
                  </div>
                </div>
                <div className="bg-slate-950/70 rounded p-2">
                  <div className="text-[10px] text-slate-400">Profundidade / Defesa</div>
                  <div className="font-bold text-amber-300">
                    {previewSpec.maxDepthM > 0 ? `${previewSpec.maxDepthM}m Sub` : 'Superfície'}{' '}
                    {previewSpec.armedCapable ? '· Armável' : ''}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{previewSpec.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {previewSpec.equipmentSummary.map((eq) => (
                  <span key={eq} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-200">
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right 7 cols: Active Tab List */}
          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-y-auto naval-scroll pr-1 space-y-3 text-xs">
            {tab === 'catalog' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'fishing', 'speedboat', 'sailboat', 'workboat', 'yacht', 'submarine'] as const).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {cat === 'all' ? 'Todas' : VESSEL_CATEGORY_LABELS[cat]}
                      </button>
                    ),
                  )}
                </div>

                <div className="space-y-2.5">
                  {filteredCatalog.map((spec) => {
                    const ownedCount = telemetry.garage.ownedVessels.filter((v) => v.specId === spec.id).length;
                    const selected = selectedSpecId === spec.id;
                    return (
                      <div
                        key={spec.id}
                        onClick={() => setSelectedSpecId(spec.id)}
                        className={`rounded-xl border p-3.5 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[#0b1f2e] border-amber-400/80'
                            : 'bg-[#051018] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{spec.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                                {VESSEL_CATEGORY_LABELS[spec.category]}
                              </span>
                              {ownedCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                                  Na Garagem ({ownedCount})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono-tabular">
                              {spec.lengthM}m · {spec.maxSpeedKnots} kts · Carga {spec.maxCargoKg} kg · Tanque {spec.fuelCapacityL}L
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSpecId(spec.id);
                              showRes(onBuyVessel(spec.id));
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shrink-0"
                          >
                            Comprar · {spec.priceCr} CR
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {tab === 'garage' && (
              <div className="space-y-2.5">
                {telemetry.garage.ownedVessels.map((v) => {
                  const spec = getVesselSpecById(v.specId);
                  const isActive = v.instanceId === telemetry.garage.activeVesselId;
                  const sellValue = Math.round(spec.priceCr * 0.65);
                  return (
                    <div
                      key={v.instanceId}
                      className={`rounded-xl border p-3.5 space-y-2 ${
                        isActive ? 'bg-[#0b1f2e] border-sky-400/75' : 'bg-[#051018] border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded border border-white/40 shrink-0"
                            style={{ backgroundColor: `#${v.hullColorHex.toString(16).padStart(6, '0')}` }}
                          />
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              {v.customName}
                              {isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-bold">
                                  ATIVA
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-tabular">
                              {spec.name} · Casco {v.condition.subsystems.hullPct.toFixed(0)}% · Porão{' '}
                              {computeEffectiveVesselCargoKg(v)} kg · {v.parkedPort}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isActive}
                            onClick={() => showRes(onSwitchVessel(v.instanceId))}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            {v.specId === 'nereid_s1' ? 'Pilotar Sub' : isActive ? 'Em Uso' : 'Ativar no Píer'}
                          </button>
                          <button
                            type="button"
                            disabled={isActive || telemetry.garage.ownedVessels.length <= 1}
                            onClick={() => showRes(onSellVessel(v.instanceId))}
                            className="px-2.5 py-1.5 rounded bg-rose-900/75 hover:bg-rose-800 disabled:bg-slate-900 disabled:text-slate-600 text-rose-100 font-semibold cursor-pointer"
                          >
                            Vender +{sellValue}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'customize' && (
              <div className="space-y-4">
                {/* Custom Name & Paint */}
                <div className="bg-[#051018] border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Paintbrush className="w-4 h-4 text-amber-400" />
                    Identidade & Pintura · {activeOwned.customName}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={26}
                      value={customNameInput}
                      onChange={(e) => setCustomNameInput(e.target.value)}
                      placeholder="Nome da embarcação"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => onCustomizeVessel({ customName: customNameInput })}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Renomear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1.5">Cor do Casco</div>
                      <div className="flex flex-wrap gap-1.5">
                        {VESSEL_PAINT_PALETTE.map((c) => (
                          <button
                            key={`hull_${c.hex}`}
                            type="button"
                            onClick={() => onCustomizeVessel({ hullColorHex: c.hex })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${
                              activeOwned.hullColorHex === c.hex ? 'border-amber-400 scale-105' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 mb-1.5">Faixa & Acabamento</div>
                      <div className="flex flex-wrap gap-1.5">
                        {VESSEL_PAINT_PALETTE.map((c) => (
                          <button
                            key={`trim_${c.hex}`}
                            type="button"
                            onClick={() => onCustomizeVessel({ trimColorHex: c.hex })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${
                              activeOwned.trimColorHex === c.hex ? 'border-amber-400 scale-105' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8 Functional Upgrades */}
                <div className="bg-[#051018] border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
                    <Wrench className="w-4 h-4 text-sky-400" />
                    Melhorias Funcionais ({activeOwned.customName})
                  </div>
                  {EXTENDED_UPGRADE_ROWS.map((row) => {
                    const cur = activeOwned.upgrades[row.slot];
                    const disabledBySpec =
                      (row.slot === 'weaponLevel' && !activeSpec.armedCapable) ||
                      (row.slot === 'sailRigLevel' && !activeSpec.sailRigged);
                    const maxed = cur >= row.maxLvl;
                    const cost = row.baseCost * Math.max(1, cur + (row.slot === 'weaponLevel' ? 1 : 0));

                    return (
                      <div
                        key={row.slot}
                        className="flex items-center justify-between gap-2 bg-slate-950/75 border border-slate-800 rounded-lg px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {row.slot === 'weaponLevel' && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                            {row.label}{' '}
                            <span className="font-mono-tabular text-sky-300">
                              Nv.{cur}/{row.maxLvl}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{row.desc}</div>
                        </div>

                        <button
                          type="button"
                          disabled={maxed || disabledBySpec}
                          onClick={() => showRes(onBuyUpgrade(row.slot))}
                          className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer shrink-0"
                        >
                          {disabledBySpec ? 'N/A' : maxed ? 'Máximo' : `${cost} CR`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-[#051018] flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-amber-400" />
            Troque embarcações no cais sem perder seu inventário ou progresso.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
