import { CampaignMission } from './types';

export const PORT_HANDIN_ZONE = { x: -8.0, z: 10.0, radiusM: 38 };

export function createCampaignMissions(): CampaignMission[] {
  return [
    {
      id: 'm01_entrega_boia',
      chapter: 1,
      order: 1,
      title: 'Cap. 1.1 · Suprimentos da Barra',
      category: 'entrega',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'A Boia de Sinalização da Barra sofreu perda de telemetria. Leve as peças de reposição da Capitania até a saída do canal do Porto de Santos e retorne ao cais.',
      objectiveText: 'Aceite a missão na Capitania ou no Quadro de Missões do cais.',
      rewardCredits: 320,
      unlocksMissionIds: ['m02_socorro_canal'],
      requiredMissionIds: [],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_boia_barra',
          label: 'Boia da Barra (Saída do Canal)',
          x: 95,
          z: 340,
          radiusM: 32,
          requiresCargoId: 'cargo_beacon_parts',
          completed: false,
        },
      ],
    },
    {
      id: 'm02_socorro_canal',
      chapter: 1,
      order: 2,
      title: 'Cap. 1.2 · O Sinal do Atlântico (Barcaça Nereus-04)',
      category: 'resgate',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'O rádio VHF captou um pedido de socorro vindo de uma embarcação à deriva na saída sul do canal. Investigue o casco abandonado e recupere qualquer registro sobre a organização Nereus.',
      objectiveText: 'Navegue até a Barcaça Abandonada Nereus-04 para investigar.',
      rewardCredits: 480,
      unlocksMissionIds: ['m03_mergulho_destrocos', 'm04_patrulha_guaruja'],
      requiredMissionIds: ['m01_entrega_boia'],
      returnToPortRequired: true,
      narrativeClue: 'clue_nereus_blackbox',
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_nereus_barge',
          label: 'Barcaça Abandonada Nereus-04',
          x: 215,
          z: 610,
          radiusM: 36,
          grantsItemId: 'clue_nereus_blackbox',
          completed: false,
        },
      ],
    },
    {
      id: 'm03_mergulho_destrocos',
      chapter: 1,
      order: 3,
      title: 'Cap. 1.3 · Segredos Sob a Laje Norte',
      category: 'recuperacao',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'A Caixa-Preta aponta uma carga ejetada pela Nereus junto aos destroços da Laje Norte. Use equipamento de mergulho para descer ao fundo do mar, recuperar a Cápsula de Dados e trazê-la ao porto.',
      objectiveText: 'Navegue até os Destroços da Laje Norte (-210, 520) e mergulhe para coletar a cápsula.',
      rewardCredits: 650,
      unlocksMissionIds: ['m05_pesquisa_palmas'],
      requiredMissionIds: ['m02_socorro_canal'],
      returnToPortRequired: true,
      narrativeClue: 'clue_nereus_capsule',
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_laje_norte',
          label: 'Destroços Submersos da Laje Norte',
          x: -210,
          z: 520,
          y: -7.5,
          radiusM: 30,
          requiresDive: true,
          grantsItemId: 'clue_nereus_capsule',
          completed: false,
        },
      ],
    },
    {
      id: 'm04_patrulha_guaruja',
      chapter: 1,
      order: 4,
      title: 'Patrulha do Canal de Santos & Guarujá',
      category: 'patrulha',
      giverNpc: 'Quadro de Missões Portuário',
      status: 'available',
      summary:
        'Verifique o tráfego costeiro entre a travessia das balsas no Guarujá, a ponta do canal e o fundeadouro de Santos.',
      objectiveText: 'Percorra os 3 pontos de patrulhamento na Baía de Santos.',
      rewardCredits: 450,
      unlocksMissionIds: [],
      requiredMissionIds: ['m01_entrega_boia'],
      returnToPortRequired: false,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_p1',
          label: 'Balsa Guarujá (Margem Leste)',
          x: 260,
          z: 40,
          radiusM: 42,
          completed: false,
        },
        {
          id: 'wp_p2',
          label: 'Entrada da Barra Sul',
          x: 160,
          z: 420,
          radiusM: 42,
          completed: false,
        },
        {
          id: 'wp_p3',
          label: 'Fundeadouro Ponta da Praia',
          x: -60,
          z: 240,
          radiusM: 42,
          completed: false,
        },
      ],
    },
    {
      id: 'm05_pesquisa_palmas',
      chapter: 1,
      order: 5,
      title: 'Pesquisa Marítima · Correntes da Ilha das Palmas',
      category: 'pesquisa',
      giverNpc: 'Quadro de Missões Portuário',
      status: 'available',
      summary:
        'Realize medições hidrográficas próximo ao setor sul rumo à Ilha das Palmas e retorne com os dados coletados ao cais.',
      objectiveText: 'Navegue até a Estação de Pesquisa Marítima Sul e retorne ao Porto de Santos.',
      rewardCredits: 540,
      unlocksMissionIds: [],
      requiredMissionIds: ['m02_socorro_canal'],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_palmas_station',
          label: 'Estação Oceanográfica Baía Sul',
          x: -360,
          z: 860,
          radiusM: 48,
          completed: false,
        },
      ],
    },
    // --- v0.7 Playable Ocean Life, Deep Exploration & Pirates Missions ---
    {
      id: 'm06_primeira_pescaria',
      chapter: 2,
      order: 6,
      title: 'Missão 1 · Primeira Pescaria Costeira',
      category: 'exploracao',
      giverNpc: 'Mercador Bento & Clara',
      status: 'available',
      summary:
        'Adquira uma vara de pesca na loja da Clara, saia para as águas do canal ou píer, capture pelo menos um peixe e venda sua captura no Mercado do Bento.',
      objectiveText: 'Compre uma vara, pesque um peixe (tecla P ou botão Pescar) e venda no Mercado.',
      rewardCredits: 260,
      unlocksMissionIds: ['m07_ecos_do_fundo'],
      requiredMissionIds: [],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_pesca_zona',
          label: 'Área de Pesca do Canal (Capture 1 peixe)',
          x: 68,
          z: 145,
          radiusM: 65,
          completed: false,
        },
      ],
    },
    {
      id: 'm07_ecos_do_fundo',
      chapter: 2,
      order: 7,
      title: 'Missão 2 · Ecos do Fundo',
      category: 'investigacao',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'Um eco acústico foi registrado próximo à Caverna Submarina da Ponta Grossa. Mergulhe ou aproxime-se do setor costeiro e recupere o instrumento histórico submerso.',
      objectiveText: 'Navegue até a Caverna Submarina (-145, 290) e recupere a pista submersa.',
      rewardCredits: 520,
      unlocksMissionIds: ['m08_nereid_s1'],
      requiredMissionIds: ['m06_primeira_pescaria'],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_caverna_ecos',
          label: 'Caverna Submarina Ponta Grossa',
          x: -145,
          z: 290,
          y: -11.5,
          radiusM: 32,
          requiresDive: true,
          grantsItemId: 'relic_maritime_compass',
          completed: false,
        },
      ],
    },
    {
      id: 'm08_nereid_s1',
      chapter: 2,
      order: 8,
      title: 'Missão 3 · O Submersível NEREID S-1',
      category: 'pesquisa',
      giverNpc: 'Eng. Tomás Braga',
      status: 'available',
      summary:
        'Adquira ou ative o submersível NEREID S-1 na Concessionária Naval e realize uma inspeção profunda na Fossa Externa usando o sonar ativo e os faróis.',
      objectiveText: 'Desça com o NEREID S-1 até a Estação Abissal (120, 720, prof. > 16 m).',
      rewardCredits: 780,
      unlocksMissionIds: ['m09_aguas_perigosas', 'm10_navio_desaparecido'],
      requiredMissionIds: ['m07_ecos_do_fundo'],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_fossa_nereid',
          label: 'Fossa Submarina Nereus (Prof. 18 m)',
          x: 120,
          z: 720,
          y: -18,
          radiusM: 42,
          requiresDive: true,
          completed: false,
        },
      ],
    },
    {
      id: 'm09_aguas_perigosas',
      chapter: 2,
      order: 9,
      title: 'Missão 4 · Águas Perigosas (Escolta)',
      category: 'patrulha',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'Escolte a rota do comboio costeiro pela zona de atuação dos Corsários da Barra. Use velocidade, neblina ou armamento defensivo para cruzar os dois pontos de risco.',
      objectiveText: 'Atravesse o Corredor Sul sob risco pirata e retorne ao Porto de Santos.',
      rewardCredits: 840,
      unlocksMissionIds: [],
      requiredMissionIds: ['m07_ecos_do_fundo'],
      returnToPortRequired: true,
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_escort_1',
          label: 'Comboio · Canal Externo Leste',
          x: 340,
          z: 620,
          radiusM: 52,
          completed: false,
        },
        {
          id: 'wp_escort_2',
          label: 'Comboio · Saída Parcel das Palmas',
          x: 420,
          z: 860,
          radiusM: 52,
          completed: false,
        },
      ],
    },
    {
      id: 'm10_navio_desaparecido',
      chapter: 2,
      order: 10,
      title: 'Missão 5 · O Navio Desaparecido (Nereus)',
      category: 'recuperacao',
      giverNpc: 'Comandante Helena Vance',
      status: 'available',
      summary:
        'Sinais de sonar indicam os destroços profundos de uma embarcação desaparecida ligada ao projeto Nereus em -280, 880 (24 m de profundidade). Investigue com o NEREID S-1.',
      objectiveText: 'Localize o Naufrágio Profundo Nereus-Alpha (-280, 880) abaixo de 18 m.',
      rewardCredits: 1150,
      unlocksMissionIds: [],
      requiredMissionIds: ['m08_nereid_s1'],
      returnToPortRequired: true,
      narrativeClue: 'clue_nereus_blackbox',
      currentWaypointIndex: 0,
      waypoints: [
        {
          id: 'wp_naufragio_alpha',
          label: 'Naufrágio Profundo Nereus-Alpha (-24 m)',
          x: -280,
          z: 880,
          y: -22,
          radiusM: 46,
          requiresDive: true,
          grantsItemId: 'clue_nereus_blackbox',
          completed: false,
        },
      ],
    },
  ];
}

export function isMissionUnlocked(m: CampaignMission, all: CampaignMission[]): boolean {
  if (m.requiredMissionIds.length === 0) return true;
  return m.requiredMissionIds.every((reqId) =>
    all.some((other) => other.id === reqId && other.status === 'completed'),
  );
}

export function acceptMissionById(
  missions: CampaignMission[],
  missionId: string,
): { next: CampaignMission[]; accepted: CampaignMission | null; error?: string } {
  const target = missions.find((m) => m.id === missionId);
  if (!target) return { next: missions, accepted: null, error: 'Missão não encontrada.' };
  if (!isMissionUnlocked(target, missions)) {
    return { next: missions, accepted: null, error: 'Missão anterior necessária ainda não concluída.' };
  }
  if (target.status !== 'available' && target.status !== 'cancelled' && target.status !== 'failed') {
    return { next: missions, accepted: null, error: 'Missão já aceita ou concluída.' };
  }

  const next = missions.map((m) => {
    if (m.id === missionId) {
      return {
        ...m,
        status: 'in_progress' as const,
        currentWaypointIndex: 0,
        failureReason: undefined,
        waypoints: m.waypoints.map((wp) => ({ ...wp, completed: false })),
        objectiveText: m.waypoints[0]
          ? `Siga para: ${m.waypoints[0].label}`
          : m.summary,
      };
    }
    if (m.status === 'in_progress') {
      return { ...m, status: 'accepted' as const };
    }
    return m;
  });

  return {
    next,
    accepted: next.find((m) => m.id === missionId) ?? null,
  };
}

export function cancelMissionById(
  missions: CampaignMission[],
  missionId: string,
): CampaignMission[] {
  return missions.map((m) =>
    m.id === missionId && (m.status === 'in_progress' || m.status === 'accepted')
      ? {
          ...m,
          status: 'cancelled',
          objectiveText: 'Missão cancelada pelo capitão.',
        }
      : m,
  );
}

export interface MissionStepResult {
  next: CampaignMission[];
  completedMission: CampaignMission | null;
  grantedItemIds: string[];
  waypointJustCompleted: string | null;
}

export interface MissionExtraEvalContext {
  subX?: number;
  subY?: number;
  subZ?: number;
  subActive?: boolean;
  caughtFishCount?: number;
  soldFishCr?: number;
}

/**
 * Evaluates spatial, diving, fishing, submarine, and port return milestones for the active CampaignMission.
 */
export function evaluateCampaignMissions(
  missions: CampaignMission[],
  boatX: number,
  boatZ: number,
  charX: number,
  charY: number,
  charZ: number,
  isDiving: boolean,
  ownedItemIds: Set<string>,
  hullCriticalFailure: boolean,
  extra?: MissionExtraEvalContext,
): MissionStepResult {
  const activeIdx = missions.findIndex((m) => m.status === 'in_progress');
  if (activeIdx === -1) {
    return { next: missions, completedMission: null, grantedItemIds: [], waypointJustCompleted: null };
  }

  const m = missions[activeIdx];
  const grantedItemIds: string[] = [];
  let waypointJustCompleted: string | null = null;
  let completedMission: CampaignMission | null = null;

  if (hullCriticalFailure) {
    const failed: CampaignMission = {
      ...m,
      status: 'failed',
      failureReason: 'Avaria crítica no casco durante a operação.',
      objectiveText: 'Missão falhou: casco em estado crítico.',
    };
    const next = missions.map((item, idx) => (idx === activeIdx ? failed : item));
    return { next, completedMission: null, grantedItemIds, waypointJustCompleted };
  }

  const updatedWaypoints = m.waypoints.map((wp) => ({ ...wp }));
  let wpIdx = m.currentWaypointIndex;
  let objText = m.objectiveText;

  const activeSubX = extra?.subActive ? (extra.subX ?? boatX) : charX;
  const activeSubY = extra?.subActive ? (extra.subY ?? charY) : charY;
  const activeSubZ = extra?.subActive ? (extra.subZ ?? boatZ) : charZ;
  const effectiveDive = isDiving || Boolean(extra?.subActive && activeSubY < -4.0);

  if (wpIdx < updatedWaypoints.length) {
    const wp = updatedWaypoints[wpIdx];

    if (m.id === 'm06_primeira_pescaria') {
      const caught = (extra?.caughtFishCount ?? 0) > 0;
      const distXZ = Math.hypot(wp.x - boatX, wp.z - boatZ);
      if (caught) {
        wp.completed = true;
        waypointJustCompleted = 'Captura Realizada!';
        wpIdx++;
        objText = 'Retorne ao Porto de Santos e venda sua captura no Mercado do Bento.';
      } else {
        objText = `Vá para águas abertas (${Math.round(distXZ)} m), pare a embarcação e capture 1 peixe.`;
      }
    } else {
      const refX = wp.requiresDive ? activeSubX : extra?.subActive ? activeSubX : boatX;
      const refZ = wp.requiresDive ? activeSubZ : extra?.subActive ? activeSubZ : boatZ;
      const distXZ = Math.hypot(wp.x - refX, wp.z - refZ);

      let reached = distXZ <= wp.radiusM;
      if (wp.requiresDive) {
        const hasGranted = wp.grantsItemId ? ownedItemIds.has(wp.grantsItemId) : false;
        const depthTarget = wp.y ?? -4.5;
        reached =
          hasGranted ||
          (effectiveDive && distXZ <= wp.radiusM && activeSubY <= depthTarget + 3.0);
      }

      if (reached) {
        wp.completed = true;
        waypointJustCompleted = wp.label;
        if (wp.grantsItemId && !ownedItemIds.has(wp.grantsItemId)) {
          grantedItemIds.push(wp.grantsItemId);
        }
        wpIdx++;
        if (wpIdx < updatedWaypoints.length) {
          objText = `Siga para: ${updatedWaypoints[wpIdx].label}`;
        } else if (m.returnToPortRequired) {
          objText = 'Retorne ao Porto de Santos (Píer/Capitania) para entregar o relatório.';
        }
      } else {
        const distM = Math.round(distXZ);
        objText = wp.requiresDive
          ? `${wp.label} (${distM} m) — Desça até ${Math.abs(Math.round(wp.y ?? -6))} m de profundidade.`
          : `${wp.label} (${distM} m)`;
      }
    }
  } else if (m.returnToPortRequired) {
    const distPort = Math.hypot(PORT_HANDIN_ZONE.x - boatX, PORT_HANDIN_ZONE.z - boatZ);
    const distCharPort = Math.hypot(PORT_HANDIN_ZONE.x - charX, PORT_HANDIN_ZONE.z - charZ);
    const fishSaleOk = m.id !== 'm06_primeira_pescaria' || (extra?.soldFishCr ?? 0) > 0;
    const atPort = distPort <= PORT_HANDIN_ZONE.radiusM || distCharPort <= PORT_HANDIN_ZONE.radiusM;

    if (atPort && fishSaleOk) {
      const done: CampaignMission = {
        ...m,
        status: 'completed',
        waypoints: updatedWaypoints,
        currentWaypointIndex: wpIdx,
        objectiveText: `Missão concluída! (+${m.rewardCredits} CR)`,
        completedAt: Date.now(),
      };
      completedMission = done;
      const next = missions.map((item, idx) => (idx === activeIdx ? done : item));
      return { next, completedMission, grantedItemIds, waypointJustCompleted };
    } else if (!fishSaleOk) {
      objText = 'No Porto de Santos, fale com Bento (Mercado Portuário) para vender o pescado.';
    } else {
      objText = `Retorne ao Porto de Santos (${Math.round(distPort)} m) para concluir.`;
    }
  }

  if (wpIdx >= updatedWaypoints.length && !m.returnToPortRequired) {
    const done: CampaignMission = {
      ...m,
      status: 'completed',
      waypoints: updatedWaypoints,
      currentWaypointIndex: wpIdx,
      objectiveText: `Missão concluída! (+${m.rewardCredits} CR)`,
      completedAt: Date.now(),
    };
    completedMission = done;
    const next = missions.map((item, idx) => (idx === activeIdx ? done : item));
    return { next, completedMission, grantedItemIds, waypointJustCompleted };
  }

  const updated: CampaignMission = {
    ...m,
    waypoints: updatedWaypoints,
    currentWaypointIndex: wpIdx,
    objectiveText: objText,
  };
  const next = missions.map((item, idx) => (idx === activeIdx ? updated : item));
  return { next, completedMission, grantedItemIds, waypointJustCompleted };
}
