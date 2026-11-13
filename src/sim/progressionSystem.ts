import { PlayerProgressionState, PlayerSkillKey } from './types';

export const SKILL_LABELS: Record<PlayerSkillKey, { title: string; perkDesc: string }> = {
  navigation: {
    title: 'Navegação',
    perkDesc: 'Aprimora eficiência de vela/manobra e percepção de correnteza.',
  },
  fishing: {
    title: 'Pesca Costeira',
    perkDesc: 'Aumenta tolerância de tensão na linha (+5%/nv) e atração de cardumes.',
  },
  diving: {
    title: 'Mergulho Autônomo',
    perkDesc: 'Melhora controle respiratório e resistência à pressão em profundidade.',
  },
  exploration: {
    title: 'Exploração & Cartografia',
    perkDesc: 'Amplia identificação de pontos históricos e destroços.',
  },
  mechanics: {
    title: 'Mecânica Naval',
    perkDesc: 'Reduz desgaste de motor/casco e melhora rendimento de reparos.',
  },
  submarine: {
    title: 'Operação de Submersíveis',
    perkDesc: 'Reduz consumo elétrico do NEREID S-1 e amplia leitura de sonar.',
  },
};

export function createInitialProgressionState(): PlayerProgressionState {
  return {
    navigation: { level: 1, xp: 0, nextLevelXp: 100 },
    fishing: { level: 1, xp: 0, nextLevelXp: 100 },
    diving: { level: 1, xp: 0, nextLevelXp: 100 },
    exploration: { level: 1, xp: 0, nextLevelXp: 100 },
    mechanics: { level: 1, xp: 0, nextLevelXp: 100 },
    submarine: { level: 1, xp: 0, nextLevelXp: 100 },
  };
}

export function awardSkillXp(
  state: PlayerProgressionState,
  skill: PlayerSkillKey,
  xpGain: number,
): { next: PlayerProgressionState; leveledUpTo: number | null } {
  if (xpGain <= 0) return { next: state, leveledUpTo: null };
  const cur = { ...state[skill] };
  cur.xp += Math.round(xpGain);
  let leveledUpTo: number | null = null;
  while (cur.level < 10 && cur.xp >= cur.nextLevelXp) {
    cur.xp -= cur.nextLevelXp;
    cur.level += 1;
    cur.nextLevelXp = Math.round(100 * Math.pow(1.35, cur.level - 1));
    leveledUpTo = cur.level;
  }
  if (cur.level >= 10) {
    cur.xp = Math.min(cur.xp, cur.nextLevelXp);
  }
  return {
    next: { ...state, [skill]: cur },
    leveledUpTo,
  };
}
