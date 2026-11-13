import { EconomyState, ItemDefinition, VesselUpgrades } from './types';

export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  equip_diver_mask: {
    id: 'equip_diver_mask',
    name: 'Máscara & Nadadeiras de Mergulho',
    kind: 'equipment',
    unitWeightKg: 2.5,
    basePriceCr: 180,
    sellPriceCr: 90,
    description: 'Melhora a visibilidade subaquática e aumenta a agilidade na natação.',
  },
  equip_scuba_tank: {
    id: 'equip_scuba_tank',
    name: 'Cilindro de Oxigênio Compacto',
    kind: 'equipment',
    unitWeightKg: 8.0,
    basePriceCr: 340,
    sellPriceCr: 170,
    description: 'Estende o tempo de mergulho autônomo de 45s para 150s.',
  },
  equip_repair_kit: {
    id: 'equip_repair_kit',
    name: 'Kit de Reparo Naval Rápido',
    kind: 'consumable',
    unitWeightKg: 6.0,
    basePriceCr: 120,
    sellPriceCr: 60,
    description: 'Restaura +25% de casco e +20% de motor em alto-mar pelo menu de inventário.',
  },
  equip_vhf_scanner: {
    id: 'equip_vhf_scanner',
    name: 'Decodificador VHF & Sonar Costeiro',
    kind: 'equipment',
    unitWeightKg: 3.0,
    basePriceCr: 420,
    sellPriceCr: 210,
    description: 'Amplia a detecção de cargas à deriva, destroços e transmissões Nereus.',
  },
  cargo_beacon_parts: {
    id: 'cargo_beacon_parts',
    name: 'Peças de Sinalizador Marítimo',
    kind: 'cargo',
    unitWeightKg: 18.0,
    basePriceCr: 0,
    sellPriceCr: 40,
    description: 'Componentes ópticos destinados à manutenção da Boia da Barra.',
  },
  cargo_med_supplies: {
    id: 'cargo_med_supplies',
    name: 'Suprimentos Médicos Costeiros',
    kind: 'cargo',
    unitWeightKg: 12.0,
    basePriceCr: 140,
    sellPriceCr: 195,
    description: 'Carga comercial leve com alta procura nos terminais do Guarujá e Santos.',
  },
  cargo_ocean_sensors: {
    id: 'cargo_ocean_sensors',
    name: 'Sensores Oceanográficos CTD',
    kind: 'cargo',
    unitWeightKg: 22.0,
    basePriceCr: 220,
    sellPriceCr: 310,
    description: 'Instrumentos científicos para pesquisa marítima na Baía de Santos.',
  },
  cargo_coffee_sacks: {
    id: 'cargo_coffee_sacks',
    name: 'Sacas de Café Especial (Santos)',
    kind: 'cargo',
    unitWeightKg: 25.0,
    basePriceCr: 110,
    sellPriceCr: 160,
    description: 'Carga tradicional portuária comercializável no Mercado do Cais.',
  },
  salvage_brass_valve: {
    id: 'salvage_brass_valve',
    name: 'Válvula Naval de Bronze',
    kind: 'cargo',
    unitWeightKg: 9.0,
    basePriceCr: 0,
    sellPriceCr: 165,
    description: 'Peça recuperada de destroços submersos com bom valor na oficina/mercado.',
  },
  salvage_drift_crate: {
    id: 'salvage_drift_crate',
    name: 'Caixa de Suprimentos à Deriva',
    kind: 'cargo',
    unitWeightKg: 14.0,
    basePriceCr: 0,
    sellPriceCr: 210,
    description: 'Carga marítima resgatada no canal de navegação.',
  },
  clue_nereus_blackbox: {
    id: 'clue_nereus_blackbox',
    name: 'Caixa-Preta Nereus-04',
    kind: 'clue',
    unitWeightKg: 4.5,
    basePriceCr: 0,
    sellPriceCr: 0,
    description: 'Registro criptografado da organização Nereus recuperado na barcaça abandonada.',
  },
  clue_nereus_capsule: {
    id: 'clue_nereus_capsule',
    name: 'Cápsula de Dados Submarina Nereus',
    kind: 'clue',
    unitWeightKg: 5.5,
    basePriceCr: 0,
    sellPriceCr: 0,
    description: 'Módulo submerso contendo coordenadas de rotas clandestinas no Atlântico Sul.',
  },
  relic_maritime_compass: {
    id: 'relic_maritime_compass',
    name: 'Sextante & Bússola Histórica (Fictícia)',
    kind: 'cargo',
    unitWeightKg: 3.5,
    basePriceCr: 0,
    sellPriceCr: 340,
    description: 'Instrumento náutico preservado recuperado em sítio submerso da Baía de Santos.',
  },
  // --- v0.7 Fishing Equipment & Baits ---
  equip_rod_basic: {
    id: 'equip_rod_basic',
    name: 'Vara Costeira Simples',
    kind: 'equipment',
    unitWeightKg: 1.5,
    basePriceCr: 90,
    sellPriceCr: 45,
    description: 'Vara de fibra leve para pesca costeira em píeres e barcos parados. Alcance 24 m.',
  },
  equip_rod_pro: {
    id: 'equip_rod_pro',
    name: 'Vara Oceânica Profissional',
    kind: 'equipment',
    unitWeightKg: 2.2,
    basePriceCr: 310,
    sellPriceCr: 155,
    description: 'Vara de carbono de alta sensibilidade. Alcance 42 m e +28% tolerância à tensão.',
  },
  equip_reel_pro: {
    id: 'equip_reel_pro',
    name: 'Molinete de Fricção Dupla',
    kind: 'equipment',
    unitWeightKg: 1.2,
    basePriceCr: 220,
    sellPriceCr: 110,
    description: 'Aumenta a velocidade de recolhimento em 35% e suaviza picos de tensão.',
  },
  equip_line_fluoro: {
    id: 'equip_line_fluoro',
    name: 'Linha Fluorcarbono Reforçada',
    kind: 'equipment',
    unitWeightKg: 0.6,
    basePriceCr: 160,
    sellPriceCr: 80,
    description: 'Reduz o desgaste por tração em 25% contra peixes pesados como Robalo e Garoupa.',
  },
  equip_hook_steel: {
    id: 'equip_hook_steel',
    name: 'Anzol Cirúrgico Inox',
    kind: 'equipment',
    unitWeightKg: 0.4,
    basePriceCr: 115,
    sellPriceCr: 55,
    description: 'Aumenta a janela de fisgada (+35%) e reduz a chance de escape durante a mordida.',
  },
  equip_tackle_box: {
    id: 'equip_tackle_box',
    name: 'Caixa de Equipamentos Náuticos',
    kind: 'equipment',
    unitWeightKg: 3.0,
    basePriceCr: 185,
    sellPriceCr: 90,
    description: 'Organizador térmico que conserva a qualidade do pescado (+20% valor de venda).',
  },
  equip_fishing_net: {
    id: 'equip_fishing_net',
    name: 'Rede Costeira Seletiva',
    kind: 'equipment',
    unitWeightKg: 7.5,
    basePriceCr: 480,
    sellPriceCr: 240,
    description: 'Evolução de pesca para barcos: amplia atratividade de cardumes costeiros (+30%).',
  },
  equip_dive_flashlight: {
    id: 'equip_dive_flashlight',
    name: 'Lanterna Subaquática LED',
    kind: 'equipment',
    unitWeightKg: 1.1,
    basePriceCr: 140,
    sellPriceCr: 70,
    description: 'Ilumina cavernas submarinas, destroços profundos e áreas de baixa visibilidade.',
  },
  equip_dive_computer: {
    id: 'equip_dive_computer',
    name: 'Profundímetro & Computador de Mergulho',
    kind: 'equipment',
    unitWeightKg: 0.8,
    basePriceCr: 290,
    sellPriceCr: 145,
    description: 'Estende o limite seguro de mergulho autônomo e reduz acúmulo de descompressão.',
  },
  bait_shrimp: {
    id: 'bait_shrimp',
    name: 'Isca de Camarão Costeiro',
    kind: 'bait',
    unitWeightKg: 0.2,
    basePriceCr: 18,
    sellPriceCr: 6,
    description: 'Isca natural versátil para Robalo, Corvina e Tainha em águas costeiras.',
  },
  bait_sardine: {
    id: 'bait_sardine',
    name: 'Isca de Sardinha Fresca',
    kind: 'bait',
    unitWeightKg: 0.3,
    basePriceCr: 28,
    sellPriceCr: 10,
    description: 'Atrai predadores maiores em média profundidade (Pescada, Garoupa e Robalo).',
  },
  bait_lure: {
    id: 'bait_lure',
    name: 'Isca Artificial Hidrodinâmica',
    kind: 'bait',
    unitWeightKg: 0.2,
    basePriceCr: 65,
    sellPriceCr: 25,
    description: 'Reutilizável em arremessos normais; eficaz para espécies troféu.',
  },
  // --- 6 Coastal Fish Species (Fictional Gameplay Profiles) ---
  fish_robalo: {
    id: 'fish_robalo',
    name: 'Robalo-Flecha',
    kind: 'fish',
    unitWeightKg: 4.2,
    basePriceCr: 0,
    sellPriceCr: 95,
    description: 'Pescado nobre costeiro de corrida intensa (parâmetros fictícios de gameplay).',
  },
  fish_corvina: {
    id: 'fish_corvina',
    name: 'Corvina Atlântica',
    kind: 'fish',
    unitWeightKg: 2.8,
    basePriceCr: 0,
    sellPriceCr: 62,
    description: 'Espécie comum de fundo arenoso e canais portuários.',
  },
  fish_pescada: {
    id: 'fish_pescada',
    name: 'Pescada-Branca',
    kind: 'fish',
    unitWeightKg: 3.1,
    basePriceCr: 0,
    sellPriceCr: 74,
    description: 'Pescado procurado no mercado do cais em águas de meia-profundidade.',
  },
  fish_tainha: {
    id: 'fish_tainha',
    name: 'Tainha Costeira',
    kind: 'fish',
    unitWeightKg: 2.2,
    basePriceCr: 0,
    sellPriceCr: 48,
    description: 'Espécie ágil próxima à superfície e costeira.',
  },
  fish_linguado: {
    id: 'fish_linguado',
    name: 'Linguado de Fundo',
    kind: 'fish',
    unitWeightKg: 2.6,
    basePriceCr: 0,
    sellPriceCr: 82,
    description: 'Habita fundos arenosos e áreas próximas a recifes.',
  },
  fish_garoupa: {
    id: 'fish_garoupa',
    name: 'Garoupa-da-Pedra',
    kind: 'fish',
    unitWeightKg: 6.5,
    basePriceCr: 0,
    sellPriceCr: 145,
    description: 'Espécie pesada de recifes rochosos; sujeita a áreas de proteção sustentável.',
  },
};

export const STORE_EQUIPMENT_IDS = [
  'equip_rod_basic',
  'equip_rod_pro',
  'equip_reel_pro',
  'equip_line_fluoro',
  'equip_hook_steel',
  'equip_tackle_box',
  'equip_fishing_net',
  'bait_shrimp',
  'bait_sardine',
  'bait_lure',
  'equip_diver_mask',
  'equip_scuba_tank',
  'equip_dive_flashlight',
  'equip_dive_computer',
  'equip_repair_kit',
  'equip_vhf_scanner',
];

export const MARKET_TRADE_IDS = [
  'cargo_coffee_sacks',
  'cargo_med_supplies',
  'cargo_ocean_sensors',
  'salvage_brass_valve',
  'salvage_drift_crate',
  'relic_maritime_compass',
];

export function createInitialEconomyState(): EconomyState {
  return {
    credits: 450,
    maxCargoKg: 120,
    inventory: [
      { itemId: 'equip_repair_kit', quantity: 1 },
    ],
    equippedIds: [],
    upgrades: {
      engineLevel: 1,
      hullArmorLevel: 1,
      sailRigLevel: 1,
      cargoHoldLevel: 1,
    },
  };
}

export function computeCargoWeightKg(state: EconomyState): number {
  let total = 0;
  for (const entry of state.inventory) {
    const def = ITEM_CATALOG[entry.itemId];
    if (def) total += def.unitWeightKg * entry.quantity;
  }
  return Math.round(total * 10) / 10;
}

export function getMaxCargoKgForUpgrades(upgrades: VesselUpgrades): number {
  if (upgrades.cargoHoldLevel >= 3) return 340;
  if (upgrades.cargoHoldLevel === 2) return 220;
  return 120;
}

export function getItemQuantity(state: EconomyState, itemId: string): number {
  return state.inventory.find((e) => e.itemId === itemId)?.quantity ?? 0;
}

export function hasEquipment(state: EconomyState, itemId: string): boolean {
  return state.equippedIds.includes(itemId) || getItemQuantity(state, itemId) > 0;
}

export function addItemToInventory(
  state: EconomyState,
  itemId: string,
  quantity = 1,
): { ok: boolean; next: EconomyState; reason?: string } {
  const def = ITEM_CATALOG[itemId];
  if (!def || quantity <= 0) {
    return { ok: false, next: state, reason: 'Item inválido.' };
  }
  const currentWeight = computeCargoWeightKg(state);
  const addedWeight = def.unitWeightKg * quantity;
  if (currentWeight + addedWeight > state.maxCargoKg) {
    return {
      ok: false,
      next: state,
      reason: `Capacidade do porão insuficiente (${currentWeight}/${state.maxCargoKg} kg).`,
    };
  }

  const nextInv = state.inventory.map((e) => ({ ...e }));
  const existing = nextInv.find((e) => e.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    nextInv.push({ itemId, quantity });
  }

  const nextEquipped = [...state.equippedIds];
  if (def.kind === 'equipment' && !nextEquipped.includes(itemId)) {
    nextEquipped.push(itemId);
  }

  return {
    ok: true,
    next: {
      ...state,
      inventory: nextInv,
      equippedIds: nextEquipped,
    },
  };
}

export function removeItemFromInventory(
  state: EconomyState,
  itemId: string,
  quantity = 1,
): EconomyState {
  const nextInv = state.inventory
    .map((e) => (e.itemId === itemId ? { ...e, quantity: e.quantity - quantity } : { ...e }))
    .filter((e) => e.quantity > 0);
  const stillOwned = nextInv.some((e) => e.itemId === itemId);
  return {
    ...state,
    inventory: nextInv,
    equippedIds: stillOwned
      ? state.equippedIds
      : state.equippedIds.filter((id) => id !== itemId),
  };
}

export function buyItem(
  state: EconomyState,
  itemId: string,
): { ok: boolean; next: EconomyState; message: string } {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.basePriceCr <= 0) {
    return { ok: false, next: state, message: 'Item indisponível para compra.' };
  }
  if (def.kind === 'equipment' && getItemQuantity(state, itemId) > 0) {
    return { ok: false, next: state, message: 'Equipamento já adquirido.' };
  }
  const qtyToBuy = def.kind === 'bait' && idIsConsumablePack(itemId) ? 5 : 1;
  const totalCost = def.basePriceCr;
  if (state.credits < totalCost) {
    return {
      ok: false,
      next: state,
      message: `Créditos insuficientes (${state.credits} / ${totalCost} CR).`,
    };
  }

  const added = addItemToInventory(state, itemId, qtyToBuy);
  if (!added.ok) {
    return { ok: false, next: state, message: added.reason || 'Sem espaço no porão.' };
  }

  return {
    ok: true,
    next: {
      ...added.next,
      credits: state.credits - totalCost,
    },
    message: `${qtyToBuy > 1 ? `${qtyToBuy}x ` : ''}${def.name} adquirido por ${totalCost} CR.`,
  };
}

function idIsConsumablePack(itemId: string): boolean {
  return itemId === 'bait_shrimp' || itemId === 'bait_sardine';
}

export function sellItem(
  state: EconomyState,
  itemId: string,
): { ok: boolean; next: EconomyState; message: string } {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.sellPriceCr <= 0) {
    return { ok: false, next: state, message: 'Este item não pode ser vendido.' };
  }
  if (getItemQuantity(state, itemId) <= 0) {
    return { ok: false, next: state, message: 'Você não possui este item no inventário.' };
  }

  const next = removeItemFromInventory(state, itemId, 1);
  return {
    ok: true,
    next: {
      ...next,
      credits: next.credits + def.sellPriceCr,
    },
    message: `Vendido 1x ${def.name} por +${def.sellPriceCr} CR.`,
  };
}

export function getUpgradeCost(slot: keyof VesselUpgrades, currentLevel: number): number {
  if (currentLevel >= 3) return 0;
  const base =
    slot === 'engineLevel'
      ? 360
      : slot === 'hullArmorLevel'
        ? 320
        : slot === 'sailRigLevel'
          ? 340
          : 280;
  return base * currentLevel;
}

export function purchaseVesselUpgrade(
  state: EconomyState,
  slot: keyof VesselUpgrades,
): { ok: boolean; next: EconomyState; message: string } {
  const lvl = state.upgrades[slot];
  if (lvl >= 3) {
    return { ok: false, next: state, message: 'Melhoria já está no nível máximo (Nível 3).' };
  }
  const cost = getUpgradeCost(slot, lvl);
  if (state.credits < cost) {
    return { ok: false, next: state, message: `Créditos insuficientes (${state.credits}/${cost} CR).` };
  }
  const nextUpgrades: VesselUpgrades = {
    ...state.upgrades,
    [slot]: lvl + 1,
  };
  return {
    ok: true,
    next: {
      ...state,
      credits: state.credits - cost,
      upgrades: nextUpgrades,
      maxCargoKg: getMaxCargoKgForUpgrades(nextUpgrades),
    },
    message: `Melhoria instalada (Nível ${lvl + 1}) por ${cost} CR.`,
  };
}
