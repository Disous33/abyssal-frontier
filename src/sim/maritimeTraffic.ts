import { NpcVesselSnapshot } from './types';

interface NpcRouteShip {
  id: string;
  name: string;
  vesselType: NpcVesselSnapshot['vesselType'];
  waypoints: Array<{ x: number; z: number; anchorPauseS?: number }>;
  wpIndex: number;
  x: number;
  z: number;
  headingRad: number;
  cruiseSpeedMs: number;
  currentSpeedMs: number;
  state: NpcVesselSnapshot['state'];
  anchorTimer: number;
}

const PORT_EXCLUSION_MIN_X = -110;
const PORT_EXCLUSION_MAX_X = 32;
const PORT_EXCLUSION_MIN_Z = -75;
const PORT_EXCLUSION_MAX_Z = 58;

/**
 * Manages AI maritime traffic across the Port of Santos estuary, Guarujá ferry crossing,
 * and coastal Atlantic approach using simplified COLREGs-inspired avoidance and port anchoring.
 */
export class MaritimeTrafficManager {
  private readonly ships: NpcRouteShip[] = [];

  constructor() {
    this.ships = [
      {
        id: 'npc_balsa_guaruja',
        name: 'Balsa Guarujá III',
        vesselType: 'ferry',
        waypoints: [
          { x: 48, z: -130, anchorPauseS: 8 },
          { x: 315, z: -90, anchorPauseS: 8 },
        ],
        wpIndex: 1,
        x: 115,
        z: -115,
        headingRad: 1.4,
        cruiseSpeedMs: 4.2,
        currentSpeedMs: 3.5,
        state: 'cruising',
        anchorTimer: 0,
      },
      {
        id: 'npc_rebocador_atlantico',
        name: 'Rebocador Atlântico',
        vesselType: 'tug',
        waypoints: [
          { x: 65, z: -55, anchorPauseS: 5 },
          { x: 110, z: 260 },
          { x: 155, z: 470 },
          { x: 65, z: 240 },
        ],
        wpIndex: 1,
        x: 78,
        z: 65,
        headingRad: 3.0,
        cruiseSpeedMs: 4.8,
        currentSpeedMs: 4.0,
        state: 'cruising',
        anchorTimer: 0,
      },
      {
        id: 'npc_pesqueiro_caicara',
        name: 'Pesqueiro Caiçara',
        vesselType: 'fishing',
        waypoints: [
          { x: -160, z: 360 },
          { x: -290, z: 620, anchorPauseS: 10 },
          { x: -80, z: 760 },
          { x: 55, z: 510 },
        ],
        wpIndex: 1,
        x: -160,
        z: 360,
        headingRad: 2.6,
        cruiseSpeedMs: 3.6,
        currentSpeedMs: 3.2,
        state: 'cruising',
        anchorTimer: 0,
      },
      {
        id: 'npc_patrulha_sp07',
        name: 'Patrulha Costeira SP-07',
        vesselType: 'patrol',
        waypoints: [
          { x: 145, z: 120 },
          { x: 210, z: 540 },
          { x: -120, z: 620 },
          { x: 40, z: 190 },
        ],
        wpIndex: 1,
        x: 145,
        z: 120,
        headingRad: 2.9,
        cruiseSpeedMs: 6.4,
        currentSpeedMs: 5.5,
        state: 'cruising',
        anchorTimer: 0,
      },
      {
        id: 'npc_carga_nereus',
        name: 'Barcaça Nereus-V',
        vesselType: 'nereus',
        waypoints: [
          { x: 295, z: 480 },
          { x: 380, z: 890, anchorPauseS: 12 },
          { x: 170, z: 980 },
        ],
        wpIndex: 1,
        x: 295,
        z: 480,
        headingRad: 2.9,
        cruiseSpeedMs: 4.4,
        currentSpeedMs: 3.8,
        state: 'cruising',
        anchorTimer: 0,
      },
    ];
  }

  public shiftOrigin(dx: number, dz: number): void {
    for (const s of this.ships) {
      s.x -= dx;
      s.z -= dz;
      for (const wp of s.waypoints) {
        wp.x -= dx;
        wp.z -= dz;
      }
    }
  }

  public step(dt: number, playerX: number, playerZ: number): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));

    for (let i = 0; i < this.ships.length; i++) {
      const s = this.ships[i];
      if (s.anchorTimer > 0) {
        s.anchorTimer -= safeDt;
        s.currentSpeedMs *= Math.exp(-3 * safeDt);
        s.state = 'anchored';
        continue;
      }

      const wp = s.waypoints[s.wpIndex];
      const dx = wp.x - s.x;
      const dz = wp.z - s.z;
      const distWp = Math.hypot(dx, dz);

      if (distWp < 22) {
        if (wp.anchorPauseS && wp.anchorPauseS > 0) {
          s.anchorTimer = wp.anchorPauseS;
        }
        s.wpIndex = (s.wpIndex + 1) % s.waypoints.length;
      }

      // Desired course toward waypoint
      let desiredYaw = Math.atan2(dx, -dz);
      let targetSpeed = distWp < 55 ? s.cruiseSpeedMs * 0.55 : s.cruiseSpeedMs;
      let nextState: NpcVesselSnapshot['state'] = distWp < 55 ? 'approaching_port' : 'cruising';

      // Simplified COLREGs-inspired avoidance: check player boat & other NPC ships
      const distPlayer = Math.hypot(playerX - s.x, playerZ - s.z);
      if (distPlayer < 62) {
        // Steer to starboard away from player
        const toPlayerYaw = Math.atan2(playerX - s.x, -(playerZ - s.z));
        const rel = ((toPlayerYaw - desiredYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(rel) < 1.1) {
          desiredYaw += rel >= 0 ? -0.85 : 0.85;
          targetSpeed *= 0.55;
          nextState = 'avoiding';
        }
      }

      for (let j = 0; j < this.ships.length; j++) {
        if (i === j) continue;
        const other = this.ships[j];
        const distOther = Math.hypot(other.x - s.x, other.z - s.z);
        if (distOther < 54) {
          desiredYaw += 0.65;
          targetSpeed *= 0.65;
          nextState = 'avoiding';
        }
      }

      // Keep clear of Porto de Santos pier apron
      if (
        s.x > PORT_EXCLUSION_MIN_X - 24 &&
        s.x < PORT_EXCLUSION_MAX_X + 24 &&
        s.z > PORT_EXCLUSION_MIN_Z - 24 &&
        s.z < PORT_EXCLUSION_MAX_Z + 24
      ) {
        desiredYaw = Math.atan2(1, 0); // Push East into open channel
        nextState = 'avoiding';
      }

      const yawDiff = ((desiredYaw - s.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      s.headingRad += Math.max(-0.45 * safeDt, Math.min(0.45 * safeDt, yawDiff * 1.4 * safeDt));
      s.currentSpeedMs += (targetSpeed - s.currentSpeedMs) * (1 - Math.exp(-2.2 * safeDt));

      s.x += Math.sin(s.headingRad) * s.currentSpeedMs * safeDt;
      s.z -= Math.cos(s.headingRad) * s.currentSpeedMs * safeDt;
      s.state = nextState;
    }
  }

  public getSnapshots(): NpcVesselSnapshot[] {
    return this.ships.map((s) => ({
      id: s.id,
      name: s.name,
      vesselType: s.vesselType,
      x: s.x,
      z: s.z,
      headingDeg: (((s.headingRad * 180) / Math.PI) % 360 + 360) % 360,
      speedKnots: s.currentSpeedMs * 1.94384,
      state: s.state,
    }));
  }
}
