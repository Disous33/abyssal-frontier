import { DynamicEventType, DynamicOceanEvent, WeatherPresetId } from './types';

const EVENT_COOLDOWN_S = 55;

/**
 * Generates and resolves contextual open-ocean dynamic events based on vessel position,
 * distance from port, weather conditions, and campaign progress.
 */
export class DynamicOceanEvents {
  public activeEvent: DynamicOceanEvent | null = null;
  private lastEventSimTime = -25; // Allow first open-water event after ~30s at sea
  private eventSeq = 0;

  public reset(): void {
    this.activeEvent = null;
    this.lastEventSimTime = -25;
  }

  public step(
    simTime: number,
    boatX: number,
    boatZ: number,
    boatHeadingDeg: number,
    weather: WeatherPresetId,
    engineIntegrityPct: number,
    completedMissionsCount: number,
    hasVhfScanner: boolean,
  ): {
    spawned: DynamicOceanEvent | null;
    resolved: DynamicOceanEvent | null;
    expired: DynamicOceanEvent | null;
    applyWeatherSquall: boolean;
    applyMechanicalFault: boolean;
  } {
    let spawned: DynamicOceanEvent | null = null;
    let resolved: DynamicOceanEvent | null = null;
    let expired: DynamicOceanEvent | null = null;
    let applyWeatherSquall = false;
    let applyMechanicalFault = false;

    if (this.activeEvent) {
      const dist = Math.hypot(this.activeEvent.x - boatX, this.activeEvent.z - boatZ);
      if (dist <= this.activeEvent.radiusM) {
        this.activeEvent = { ...this.activeEvent, active: false, resolved: true };
        resolved = this.activeEvent;
        this.activeEvent = null;
        this.lastEventSimTime = simTime;
        return { spawned, resolved, expired, applyWeatherSquall, applyMechanicalFault };
      }
      if (simTime >= this.activeEvent.expiresAtSimTime) {
        expired = this.activeEvent;
        this.activeEvent = null;
        this.lastEventSimTime = simTime;
      }
      return { spawned, resolved, expired, applyWeatherSquall, applyMechanicalFault };
    }

    // Require minimum sea distance from quay (> 140m) and cooldown elapsed
    const distFromPort = Math.hypot(boatX - 16.5, boatZ - 12.0);
    if (distFromPort < 140) {
      return { spawned, resolved, expired, applyWeatherSquall, applyMechanicalFault };
    }
    if (simTime - this.lastEventSimTime < EVENT_COOLDOWN_S) {
      return { spawned, resolved, expired, applyWeatherSquall, applyMechanicalFault };
    }

    // Select contextual event type
    const chosenType = this.pickEventType(
      simTime,
      weather,
      engineIntegrityPct,
      completedMissionsCount,
      distFromPort,
    );

    // Spawn 130..240m ahead along course (within radar/visual range)
    const aheadDist = hasVhfScanner ? 210 : 155;
    const hRad = (boatHeadingDeg * Math.PI) / 180;
    const lateral = Math.sin(simTime * 1.7) * 55;
    const ex = boatX + Math.sin(hRad) * aheadDist + Math.cos(hRad) * lateral;
    const ez = boatZ - Math.cos(hRad) * aheadDist + Math.sin(hRad) * lateral;

    this.eventSeq++;
    const ev = this.buildEvent(chosenType, this.eventSeq, simTime, ex, ez);
    this.activeEvent = ev;
    this.lastEventSimTime = simTime;
    spawned = ev;

    if (chosenType === 'squall_storm') applyWeatherSquall = true;
    if (chosenType === 'mechanical_fault') applyMechanicalFault = true;

    return { spawned, resolved, expired, applyWeatherSquall, applyMechanicalFault };
  }

  private pickEventType(
    simTime: number,
    weather: WeatherPresetId,
    enginePct: number,
    completedCount: number,
    distFromPort: number,
  ): DynamicEventType {
    if (enginePct < 55 && Math.sin(simTime) > 0.2) return 'mechanical_fault';
    if (weather === 'clear' && distFromPort > 420 && Math.cos(simTime * 0.37) > 0.65) {
      return 'squall_storm';
    }
    const pool: DynamicEventType[] = [
      'drifting_cargo',
      'marine_wildlife',
      'distress_call',
      'disabled_vessel',
      'wreck_discovery',
      'rare_school',
      'sonar_signal',
    ];
    if (completedCount >= 1 || distFromPort > 340) {
      pool.push('suspicious_vessel', 'pirates_spotted', 'missing_vessel', 'historic_artifact');
    }
    const idx = Math.floor(Math.abs(Math.sin(simTime * 12.9898) * 43758.5453)) % pool.length;
    return pool[idx];
  }

  private buildEvent(
    type: DynamicEventType,
    seq: number,
    simTime: number,
    x: number,
    z: number,
  ): DynamicOceanEvent {
    const id = `evt_${seq}_${type}`;
    const expiresAtSimTime = simTime + 115;

    switch (type) {
      case 'distress_call':
        return {
          id,
          type,
          title: 'Pedido de Socorro VHF (Canal 16)',
          description: 'Embarcação costeira solicitando apoio próximo ao canal. Aproxime-se para prestar assistência.',
          x,
          z,
          radiusM: 28,
          active: true,
          resolved: false,
          rewardCredits: 160,
          expiresAtSimTime,
        };
      case 'squall_storm':
        return {
          id,
          type,
          title: 'Frente de Rajada Inesperada',
          description: 'Núcleo de chuva e rajadas avançando pelo canal. Reduza a área vélica ou navegue até águas abrigadas.',
          x,
          z,
          radiusM: 34,
          active: true,
          resolved: false,
          rewardCredits: 95,
          expiresAtSimTime: simTime + 75,
        };
      case 'disabled_vessel':
        return {
          id,
          type,
          title: 'Pesqueiro Avariado à Deriva',
          description: 'Um pequeno pesqueiro perdeu propulsão. Entregue auxílio de reboque/peças ao se aproximar.',
          x,
          z,
          radiusM: 28,
          active: true,
          resolved: false,
          rewardCredits: 185,
          expiresAtSimTime,
        };
      case 'drifting_cargo':
        return {
          id,
          type,
          title: 'Carga à Deriva Detectada',
          description: 'Contêiner leve flutuando no canal. Aproxime-se para içar a carga ao porão.',
          x,
          z,
          radiusM: 24,
          active: true,
          resolved: false,
          rewardCredits: 80,
          rewardItemId: 'salvage_drift_crate',
          expiresAtSimTime,
        };
      case 'suspicious_vessel':
        return {
          id,
          type,
          title: 'Embarcação Suspeita (Sinal Nereus)',
          description: 'Contato de radar sem transponder compatível com a Nereus. Aproxime-se para registrar o código.',
          x,
          z,
          radiusM: 36,
          active: true,
          resolved: false,
          rewardCredits: 210,
          expiresAtSimTime,
        };
      case 'mechanical_fault':
        return {
          id,
          type,
          title: 'Falha Mecânica no Motor Auxiliar',
          description: 'Aquecimento detectado na transmissão. Reduza o motor e mantenha o curso até estabilizar.',
          x,
          z,
          radiusM: 30,
          active: true,
          resolved: false,
          rewardCredits: 60,
          expiresAtSimTime: simTime + 60,
        };
      case 'marine_wildlife':
        return {
          id,
          type,
          title: 'Avistamento de Golfinhos Atlânticos',
          description: 'Cardume de golfinhos acompanhando a rota na Baía de Santos. Aproxime-se para observação.',
          x,
          z,
          radiusM: 32,
          active: true,
          resolved: false,
          rewardCredits: 75,
          expiresAtSimTime,
        };
      case 'wreck_discovery':
        return {
          id,
          type,
          title: 'Sinal de Sonar: Destroços Mapeados',
          description: 'Leitura batimétrica indica destroços metálicos próximos. Passe pelo ponto para catalogar e recuperar válvula.',
          x,
          z,
          radiusM: 26,
          active: true,
          resolved: false,
          rewardCredits: 110,
          rewardItemId: 'salvage_brass_valve',
          expiresAtSimTime,
        };
      case 'rare_school':
        return {
          id,
          type,
          title: 'Cardume Raro de Robalos Detectado',
          description: 'Concentração excepcional de peixes na superfície. Pare o barco e lance a linha de pesca!',
          x,
          z,
          radiusM: 42,
          active: true,
          resolved: false,
          rewardCredits: 115,
          expiresAtSimTime,
        };
      case 'sonar_signal':
        return {
          id,
          type,
          title: 'Sinal Acústico Submarino Anômalo',
          description: 'Eco metálico periódico emitido abaixo de 15 m. Ideal para inspeção com NEREID S-1 ou mergulho.',
          x,
          z,
          radiusM: 34,
          active: true,
          resolved: false,
          rewardCredits: 150,
          expiresAtSimTime,
        };
      case 'pirates_spotted':
        return {
          id,
          type,
          title: 'Alerta de Corsários no Setor Externo',
          description: 'Patrulha costeira reportou embarcação hostil na rota. Mantenha velocidade ou evite aproximação direta.',
          x,
          z,
          radiusM: 45,
          active: true,
          resolved: false,
          rewardCredits: 175,
          expiresAtSimTime,
        };
      case 'missing_vessel':
        return {
          id,
          type,
          title: 'Embarcação Desaparecida na Barra',
          description: 'Último sinal de baliza registrado neste setor. Verifique destroços ou caixa-preta na área.',
          x,
          z,
          radiusM: 32,
          active: true,
          resolved: false,
          rewardCredits: 220,
          rewardItemId: 'salvage_drift_crate',
          expiresAtSimTime,
        };
      case 'historic_artifact':
        return {
          id,
          type,
          title: 'Objeto Histórico Fictício Detectado',
          description: 'Instrumento náutico antigo localizado sobre banco arenoso. Aproxime-se para catalogar e resgatar.',
          x,
          z,
          radiusM: 28,
          active: true,
          resolved: false,
          rewardCredits: 140,
          rewardItemId: 'relic_maritime_compass',
          expiresAtSimTime,
        };
    }
  }
}
