import {
  CombatStateSnapshot,
  PirateAIState,
  PirateFactionId,
  PirateVesselSnapshot,
} from './types';

export interface ProjectileState {
  id: string;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  lifeS: number;
}

interface InternalPirateShip {
  id: string;
  name: string;
  faction: PirateFactionId;
  enemyType: string;
  waypoints: Array<{ x: number; z: number }>;
  wpIdx: number;
  x: number;
  z: number;
  headingDeg: number;
  speedKnots: number;
  maxSpeedKnots: number;
  hullPct: number;
  aiState: PirateAIState;
  detectionPct: number;
  lastKnownX: number;
  lastKnownZ: number;
  fireCooldownS: number;
  armed: boolean;
  onFire: boolean;
  bribedUntilSimTime: number;
  respawnTimerS: number;
}

const PORT_SAFE_RADIUS_M = 145;

/**
 * Pirate & Hostile Maritime Threat AI Manager:
 * Three fictitious maritime factions operating in outer open-water sectors (never real cities).
 * Implements realistic distance + fog + night perception (no omniscient wallhacks),
 * 8 AI states (patrol, investigate, approach, chase, intimidate, attack, retreat, flee),
 * projectile ballistics, and tactical alternatives (outrun, bribe, weather concealment, safe port).
 */
export class PirateAIManager {
  private readonly ships: InternalPirateShip[] = [];
  public readonly projectiles: ProjectileState[] = [];
  public playerCannonCooldownS = 0;
  public readonly playerCannonMaxCooldownS = 2.6;
  public activeFiresOnPlayer = 0;
  private projSeq = 0;

  constructor() {
    this.ships = [
      {
        id: 'pir_corsario_01',
        name: 'Escuna Lacraia',
        faction: 'corsarios_barra',
        enemyType: 'Corsário Oportunista',
        waypoints: [
          { x: 310, z: 540 },
          { x: 520, z: 760 },
          { x: 180, z: 860 },
        ],
        wpIdx: 0,
        x: 310,
        z: 540,
        headingDeg: 185,
        speedKnots: 6.0,
        maxSpeedKnots: 12.5,
        hullPct: 100,
        aiState: 'patrol',
        detectionPct: 0,
        lastKnownX: 310,
        lastKnownZ: 540,
        fireCooldownS: 2.0,
        armed: true,
        onFire: false,
        bribedUntilSimTime: -999,
        respawnTimerS: 0,
      },
      {
        id: 'pir_nereus_02',
        name: 'Interceptador Nereus-V',
        faction: 'contrabandistas_nereus',
        enemyType: 'Contrabandista Fictício',
        waypoints: [
          { x: -320, z: 680 },
          { x: -160, z: 980 },
          { x: -490, z: 900 },
        ],
        wpIdx: 0,
        x: -320,
        z: 680,
        headingDeg: 145,
        speedKnots: 7.2,
        maxSpeedKnots: 15.2,
        hullPct: 100,
        aiState: 'patrol',
        detectionPct: 0,
        lastKnownX: -320,
        lastKnownZ: 680,
        fireCooldownS: 1.5,
        armed: true,
        onFire: false,
        bribedUntilSimTime: -999,
        respawnTimerS: 0,
      },
      {
        id: 'pir_merc_03',
        name: 'Corveta Vento Negro',
        faction: 'mercenarios_sul',
        enemyType: 'Mercenário Marítimo',
        waypoints: [
          { x: 60, z: 1080 },
          { x: 460, z: 1240 },
          { x: -240, z: 1280 },
        ],
        wpIdx: 0,
        x: 60,
        z: 1080,
        headingDeg: 220,
        speedKnots: 8.0,
        maxSpeedKnots: 16.5,
        hullPct: 100,
        aiState: 'patrol',
        detectionPct: 0,
        lastKnownX: 60,
        lastKnownZ: 1080,
        fireCooldownS: 1.8,
        armed: true,
        onFire: false,
        bribedUntilSimTime: -999,
        respawnTimerS: 0,
      },
    ];
  }

  public shiftOrigin(dx: number, dz: number): void {
    for (const s of this.ships) {
      s.x -= dx;
      s.z -= dz;
      s.lastKnownX -= dx;
      s.lastKnownZ -= dz;
      for (const wp of s.waypoints) {
        wp.x -= dx;
        wp.z -= dz;
      }
    }
    for (const p of this.projectiles) {
      p.x -= dx;
      p.z -= dz;
    }
  }

  public firePlayerCannon(
    boatX: number,
    boatY: number,
    boatZ: number,
    headingDeg: number,
    weaponLevel: number,
  ): boolean {
    if (weaponLevel <= 0 || this.playerCannonCooldownS > 0) return false;
    this.playerCannonCooldownS = this.playerCannonMaxCooldownS;

    // Aim toward nearest hostile within 260m in front/broadside, else straight ahead
    let aimX = Math.sin((headingDeg * Math.PI) / 180);
    let aimZ = -Math.cos((headingDeg * Math.PI) / 180);

    let nearest: InternalPirateShip | null = null;
    let bestDist = 260;
    for (const s of this.ships) {
      if (s.respawnTimerS > 0) continue;
      const d = Math.hypot(s.x - boatX, s.z - boatZ);
      if (d < bestDist) {
        bestDist = d;
        nearest = s;
      }
    }
    if (nearest) {
      const dx = nearest.x - boatX;
      const dz = nearest.z - boatZ;
      const d = Math.hypot(dx, dz) || 1;
      aimX = dx / d;
      aimZ = dz / d;
    }

    const speed = 78;
    this.projSeq++;
    this.projectiles.push({
      id: `proj_p_${this.projSeq}`,
      fromPlayer: true,
      x: boatX + aimX * 5.2,
      y: Math.max(1.2, boatY + 1.5),
      z: boatZ + aimZ * 5.2,
      vx: aimX * speed,
      vy: 4.5,
      vz: aimZ * speed,
      damage: 24 + (weaponLevel - 1) * 14,
      lifeS: 3.4,
    });
    return true;
  }

  public payIntimidationBribe(simTime: number): { paidCr: number; targetName: string | null } {
    let target: InternalPirateShip | null = null;
    for (const s of this.ships) {
      if (s.aiState === 'intimidate' || s.aiState === 'approach' || s.aiState === 'chase') {
        target = s;
        break;
      }
    }
    if (!target) return { paidCr: 0, targetName: null };
    target.bribedUntilSimTime = simTime + 90;
    target.aiState = 'retreat';
    target.detectionPct = 0;
    return { paidCr: 120, targetName: target.name };
  }

  public step(
    dt: number,
    simTime: number,
    boatX: number,
    boatZ: number,
    portX: number,
    portZ: number,
    isSubmergedOrAshore: boolean,
    fogDensity: number,
    nightFactor: number,
    rainIntensity: number,
    playerArmorLevel: number,
  ): {
    hullDamage: number;
    engineDamage: number;
    rudderDamage: number;
    sailDamage: number;
    sunkEnemyRewardCr: number;
    sunkEnemyName: string | null;
    alertTriggered: string | null;
  } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.playerCannonCooldownS = Math.max(0, this.playerCannonCooldownS - safeDt);

    let hullDamage = 0;
    let engineDamage = 0;
    let rudderDamage = 0;
    let sailDamage = 0;
    let sunkEnemyRewardCr = 0;
    let sunkEnemyName: string | null = null;
    let alertTriggered: string | null = null;

    // Visibility degrades in fog, rain, and night (so stealth/weather escape works!)
    const visFactor =
      Math.max(0.28, 1.0 - fogDensity * 52 - rainIntensity * 0.25 - nightFactor * 0.28);
    const maxSightRangeM = 285 * visFactor;
    const playerInPortSafeZone = Math.hypot(boatX - portX, boatZ - portZ) < PORT_SAFE_RADIUS_M;

    for (const s of this.ships) {
      if (s.respawnTimerS > 0) {
        s.respawnTimerS -= safeDt;
        if (s.respawnTimerS <= 0) {
          s.hullPct = 100;
          s.onFire = false;
          s.aiState = 'patrol';
          s.detectionPct = 0;
          s.x = s.waypoints[0].x;
          s.z = s.waypoints[0].z;
        }
        continue;
      }

      const distToPlayer = Math.hypot(boatX - s.x, boatZ - s.z);
      const canSensePlayer =
        !isSubmergedOrAshore &&
        !playerInPortSafeZone &&
        simTime > s.bribedUntilSimTime &&
        distToPlayer <= maxSightRangeM;

      // Detection buildup & decay (non-omniscient AI)
      const prevState = s.aiState;
      if (canSensePlayer) {
        const gainRate = (1 - distToPlayer / Math.max(40, maxSightRangeM)) * 65 + 18;
        s.detectionPct = Math.min(100, s.detectionPct + gainRate * safeDt);
        s.lastKnownX = boatX;
        s.lastKnownZ = boatZ;
      } else {
        s.detectionPct = Math.max(0, s.detectionPct - 18 * safeDt);
      }

      // State transitions
      if (s.hullPct <= 22) {
        s.aiState = 'flee';
      } else if (simTime < s.bribedUntilSimTime || playerInPortSafeZone) {
        if (s.aiState === 'chase' || s.aiState === 'attack' || s.aiState === 'intimidate') {
          s.aiState = 'retreat';
        } else if (s.detectionPct <= 5) {
          s.aiState = 'patrol';
        }
      } else if (s.detectionPct >= 90) {
        if (distToPlayer <= 135) {
          s.aiState = s.faction === 'corsarios_barra' && distToPlayer > 85 ? 'intimidate' : 'attack';
        } else {
          s.aiState = 'chase';
        }
      } else if (s.detectionPct >= 50) {
        s.aiState = distToPlayer < 190 ? 'approach' : 'investigate';
      } else if (s.detectionPct <= 10) {
        s.aiState = 'patrol';
      }

      if (prevState === 'patrol' && (s.aiState === 'approach' || s.aiState === 'chase' || s.aiState === 'attack')) {
        alertTriggered = `${s.name} (${s.enemyType}) detectou sua embarcação!`;
      }

      // Navigation target & speed by AI state
      let targetX = s.waypoints[s.wpIdx].x;
      let targetZ = s.waypoints[s.wpIdx].z;
      let targetKnots = 6.2;

      if (s.aiState === 'investigate' || s.aiState === 'approach') {
        targetX = s.lastKnownX;
        targetZ = s.lastKnownZ;
        targetKnots = s.maxSpeedKnots * 0.72;
      } else if (s.aiState === 'chase') {
        targetX = boatX;
        targetZ = boatZ;
        targetKnots = s.maxSpeedKnots;
      } else if (s.aiState === 'intimidate' || s.aiState === 'attack') {
        // Orbit broadside around 70m
        const angleToBoat = Math.atan2(s.x - boatX, s.z - boatZ) + 0.65;
        targetX = boatX + Math.sin(angleToBoat) * 72;
        targetZ = boatZ + Math.cos(angleToBoat) * 72;
        targetKnots = s.maxSpeedKnots * 0.85;
      } else if (s.aiState === 'flee' || s.aiState === 'retreat') {
        const awayAng = Math.atan2(s.x - boatX, s.z - boatZ);
        targetX = s.x + Math.sin(awayAng) * 280;
        targetZ = s.z + Math.cos(awayAng) * 280;
        targetKnots = s.maxSpeedKnots * 0.95;
      } else {
        const wp = s.waypoints[s.wpIdx];
        if (Math.hypot(wp.x - s.x, wp.z - s.z) < 42) {
          s.wpIdx = (s.wpIdx + 1) % s.waypoints.length;
        }
      }

      const desiredHeading = ((Math.atan2(targetX - s.x, -(targetZ - s.z)) * 180) / Math.PI + 360) % 360;
      const diff = ((desiredHeading - s.headingDeg + 540) % 360) - 180;
      s.headingDeg = (s.headingDeg + Math.sign(diff) * Math.min(Math.abs(diff), 36 * safeDt) + 360) % 360;
      s.speedKnots += (targetKnots - s.speedKnots) * (1 - Math.exp(-1.8 * safeDt));

      const spdMs = s.speedKnots * 0.514444;
      const hRad = (s.headingDeg * Math.PI) / 180;
      s.x += Math.sin(hRad) * spdMs * safeDt;
      s.z -= Math.cos(hRad) * spdMs * safeDt;

      // Enemy cannon fire when in attack state & within 155m
      s.fireCooldownS = Math.max(0, s.fireCooldownS - safeDt);
      if (s.aiState === 'attack' && distToPlayer <= 155 && s.fireCooldownS <= 0) {
        s.fireCooldownS = 3.6;
        const dx = boatX - s.x;
        const dz = boatZ - s.z;
        const d = Math.hypot(dx, dz) || 1;
        const spread = (Math.random() - 0.5) * 0.14;
        const dirX = dx / d + spread;
        const dirZ = dz / d - spread;
        const projSpeed = 62;
        this.projSeq++;
        this.projectiles.push({
          id: `proj_e_${this.projSeq}`,
          fromPlayer: false,
          x: s.x + dirX * 5,
          y: 2.0,
          z: s.z + dirZ * 5,
          vx: dirX * projSpeed,
          vy: 4.0,
          vz: dirZ * projSpeed,
          damage: 9.5,
          lifeS: 3.0,
        });
      }
    }

    // Step ballistic projectiles & collision checks
    const armorMitigation = Math.max(0.55, 1 - (playerArmorLevel - 1) * 0.18);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;
      p.vy -= 9.81 * safeDt;
      p.lifeS -= safeDt;

      let remove = p.lifeS <= 0 || p.y <= 0;

      if (p.fromPlayer) {
        for (const s of this.ships) {
          if (s.respawnTimerS > 0) continue;
          if (Math.hypot(p.x - s.x, p.z - s.z) <= 10.5) {
            s.hullPct = Math.max(0, s.hullPct - p.damage);
            s.detectionPct = 100;
            if (s.hullPct <= 45) s.onFire = true;
            if (s.hullPct <= 0) {
              s.respawnTimerS = 75;
              sunkEnemyRewardCr += 320;
              sunkEnemyName = s.name;
            }
            remove = true;
            break;
          }
        }
      } else if (!isSubmergedOrAshore) {
        if (Math.hypot(p.x - boatX, p.z - boatZ) <= 7.5) {
          const hitDmg = p.damage * armorMitigation;
          hullDamage += hitDmg;
          engineDamage += hitDmg * 0.45;
          rudderDamage += hitDmg * 0.4;
          sailDamage += hitDmg * 0.55;
          if (Math.random() < 0.35) {
            this.activeFiresOnPlayer = Math.min(2, this.activeFiresOnPlayer + 1);
          }
          remove = true;
        }
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }

    // Ongoing deck fire slowly wears hull until extinguished or repaired
    if (this.activeFiresOnPlayer > 0) {
      hullDamage += this.activeFiresOnPlayer * 0.45 * safeDt;
    }

    return {
      hullDamage,
      engineDamage,
      rudderDamage,
      sailDamage,
      sunkEnemyRewardCr,
      sunkEnemyName,
      alertTriggered,
    };
  }

  public extinguishFires(): void {
    this.activeFiresOnPlayer = 0;
  }

  public getPirateSnapshots(boatX: number, boatZ: number): PirateVesselSnapshot[] {
    return this.ships
      .filter((s) => s.respawnTimerS <= 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        faction: s.faction,
        enemyType: s.enemyType,
        x: s.x,
        z: s.z,
        headingDeg: Math.round(s.headingDeg),
        speedKnots: Math.round(s.speedKnots * 10) / 10,
        hullPct: Math.round(s.hullPct),
        aiState: s.aiState,
        detectionPct: Math.round(s.detectionPct),
        armed: s.armed,
        onFire: s.onFire,
        distToPlayerM: Math.round(Math.hypot(s.x - boatX, s.z - boatZ)),
      }));
  }

  public getCombatSnapshot(
    boatX: number,
    boatZ: number,
    weaponLevel: number,
  ): CombatStateSnapshot {
    let threatLevel: CombatStateSnapshot['threatLevel'] = 'none';
    let nearestThreatDistM: number | null = null;
    let intimidatePromptActive = false;

    for (const s of this.ships) {
      if (s.respawnTimerS > 0) continue;
      const d = Math.hypot(s.x - boatX, s.z - boatZ);
      if (s.aiState === 'attack' || s.aiState === 'chase') {
        threatLevel = 'combat';
        nearestThreatDistM = nearestThreatDistM === null ? Math.round(d) : Math.min(nearestThreatDistM, Math.round(d));
      } else if (s.aiState === 'intimidate') {
        intimidatePromptActive = true;
        if (threatLevel !== 'combat') threatLevel = 'alert';
        nearestThreatDistM = nearestThreatDistM === null ? Math.round(d) : Math.min(nearestThreatDistM, Math.round(d));
      } else if (s.aiState === 'approach' || s.aiState === 'investigate') {
        if (threatLevel === 'none') threatLevel = 'alert';
        nearestThreatDistM = nearestThreatDistM === null ? Math.round(d) : Math.min(nearestThreatDistM, Math.round(d));
      }
    }

    return {
      playerArmed: weaponLevel > 0,
      cannonCooldownS: Math.round(this.playerCannonCooldownS * 10) / 10,
      cannonMaxCooldownS: this.playerCannonMaxCooldownS,
      threatLevel,
      nearestThreatDistM,
      activeFires: this.activeFiresOnPlayer,
      projectilesCount: this.projectiles.length,
      intimidatePromptActive,
      bribeCostCr: 120,
    };
  }
}
