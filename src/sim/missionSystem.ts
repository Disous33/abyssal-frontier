import { ControlMode, MissionState, MissionStepId } from './types';

export const PRIMEIRA_TRAVESSIA_CHECKPOINT = {
  x: 95,
  z: 340,
  radiusM: 32,
};

export function createInitialMissionState(alreadyCompleted = false): MissionState {
  if (alreadyCompleted) {
    return {
      id: 'primeira_travessia',
      title: 'Primeira Travessia',
      step: 'completed',
      stepIndex: 6,
      totalSteps: 6,
      objectiveText: 'Missão concluída — Exploração livre pela Baixada Santista.',
      hintText: 'Navegue entre Santos, Guarujá, São Vicente e Praia Grande ou retorne ao píer para desembarcar.',
      checkpointLocalX: PRIMEIRA_TRAVESSIA_CHECKPOINT.x,
      checkpointLocalZ: PRIMEIRA_TRAVESSIA_CHECKPOINT.z,
      distanceToTargetM: 0,
      completedAt: Date.now(),
    };
  }
  return {
    id: 'primeira_travessia',
    title: 'Primeira Travessia',
    step: 'walk_to_pier',
    stepIndex: 1,
    totalSteps: 6,
    objectiveText: 'Caminhe pelo Cais de Santos até o píer da embarcação ASTER S-01.',
    hintText: 'Use W/A/S/D para caminhar (Shift para correr). Fale com a Comandante Helena (E) ou siga o marcador.',
    checkpointLocalX: PRIMEIRA_TRAVESSIA_CHECKPOINT.x,
    checkpointLocalZ: PRIMEIRA_TRAVESSIA_CHECKPOINT.z,
    distanceToTargetM: 40,
    completedAt: null,
  };
}

/**
 * Evaluates verifiable spatial and physical milestones for Mission 01: PRIMEIRA TRAVESSIA.
 */
export function evaluatePrimeiraTravessia(
  current: MissionState,
  controlMode: ControlMode,
  charX: number,
  charZ: number,
  boatX: number,
  boatZ: number,
  initialMooringX: number,
  initialMooringZ: number,
  throttle: number,
  speedKnots: number,
): MissionState {
  if (current.step === 'completed') {
    return {
      ...current,
      distanceToTargetM: Math.round(
        Math.hypot(
          PRIMEIRA_TRAVESSIA_CHECKPOINT.x - boatX,
          PRIMEIRA_TRAVESSIA_CHECKPOINT.z - boatZ,
        ),
      ),
    };
  }

  let step: MissionStepId = current.step;
  let stepIndex = current.stepIndex;
  let objectiveText = current.objectiveText;
  let hintText = current.hintText;
  let distM = current.distanceToTargetM;
  let completedAt = current.completedAt;

  const distCharToBoat = Math.hypot(boatX - charX, boatZ - charZ);
  const distBoatFromMooring = Math.hypot(boatX - initialMooringX, boatZ - initialMooringZ);
  const distToCheckpoint = Math.hypot(
    PRIMEIRA_TRAVESSIA_CHECKPOINT.x - boatX,
    PRIMEIRA_TRAVESSIA_CHECKPOINT.z - boatZ,
  );

  // Step 1 -> 2: Reach the pier / approach Aster S-01
  if (step === 'walk_to_pier') {
    distM = Math.round(distCharToBoat);
    if (charX > -8.5 || distCharToBoat < 6.0) {
      step = 'board_vessel';
      stepIndex = 2;
    }
  }

  // Step 2 -> 3: Board Aster S-01
  if (step === 'board_vessel') {
    distM = Math.round(distCharToBoat);
    objectiveText = 'Aproxime-se da popa da ASTER S-01 no píer e pressione E para embarcar.';
    hintText = 'Posicione Kael próximo ao convés no fim do píer e aperte E.';
    if (controlMode === 'sailing') {
      step = 'start_motor';
      stepIndex = 3;
    }
  }

  // Step 3 -> 4: Engage auxiliary motor
  if (step === 'start_motor') {
    distM = Math.round(distToCheckpoint);
    objectiveText = 'Assuma o leme e ligue o motor auxiliar (pressione W).';
    hintText = 'Mantenha W pressionado para acelerar o motor auxiliar e desatracar do píer.';
    if (controlMode === 'sailing' && (throttle > 0.08 || speedKnots > 0.8)) {
      step = 'undock';
      stepIndex = 4;
    }
  }

  // Step 4 -> 5: Clear pier (> 24m from mooring)
  if (step === 'undock') {
    distM = Math.round(distToCheckpoint);
    objectiveText = 'Desatraque com segurança e avance pelo canal do Porto de Santos.';
    hintText = 'Use A/D para governar o leme e saia da área dos píeres rumo ao canal.';
    if (distBoatFromMooring > 24) {
      step = 'reach_checkpoint';
      stepIndex = 5;
    }
  }

  // Step 5 -> 6: Reach Atlantic Buoy Checkpoint
  if (step === 'reach_checkpoint') {
    distM = Math.round(distToCheckpoint);
    objectiveText = `Navegue até a Boia da Barra na saída para o Atlântico (${distM} m).`;
    hintText = 'Ajuste velas (Q/E) e leme (A/D) ou use o motor para atravessar o anel dourado da boia.';
    if (distToCheckpoint <= PRIMEIRA_TRAVESSIA_CHECKPOINT.radiusM) {
      step = 'completed';
      stepIndex = 6;
      distM = 0;
      completedAt = Date.now();
      objectiveText = 'Missão PRIMEIRA TRAVESSIA concluída!';
      hintText =
        'Você dominou o embarque, desatracagem e navegação inicial em Santos. Explore a Baixada Santista ou retorne ao píer para desembarcar.';
    }
  }

  return {
    ...current,
    step,
    stepIndex,
    objectiveText,
    hintText,
    distanceToTargetM: distM,
    completedAt,
  };
}
