import { WindConfig } from './types';

export const KNOTS_TO_MS = 0.514444;
export const MS_TO_KNOTS = 1.943844;

export interface WindSample {
  trueX: number;
  trueY: number;
  trueZ: number;
  trueSpeedMs: number;
  apparentX: number;
  apparentY: number;
  apparentZ: number;
  apparentSpeedMs: number;
  /** Relative angle in radians (-PI..PI). 0 = headwind, + = from starboard, - = from port */
  apparentRelAngleRad: number;
}

export function createWindSample(): WindSample {
  return {
    trueX: 0,
    trueY: 0,
    trueZ: 0,
    trueSpeedMs: 0,
    apparentX: 0,
    apparentY: 0,
    apparentZ: 0,
    apparentSpeedMs: 0,
    apparentRelAngleRad: 0,
  };
}

/**
 * Computes spatially and temporally coherent true wind + gusts + turbulence,
 * and derives apparent wind at a given world point & vessel velocity.
 */
export function sampleWindField(
  worldX: number,
  worldY: number,
  worldZ: number,
  time: number,
  vesselVelX: number,
  vesselVelY: number,
  vesselVelZ: number,
  vesselForwardX: number,
  vesselForwardZ: number,
  vesselRightX: number,
  vesselRightZ: number,
  config: WindConfig,
  out: WindSample,
): WindSample {
  const baseMs = config.speedKnots * KNOTS_TO_MS;

  // Coherent multi-frequency gust wave propagating across ocean
  const dirRad = (config.directionDeg * Math.PI) / 180;
  // Wind comes FROM dirRad -> blows TOWARD (-sin(dirRad), 0, cos(dirRad))
  const blowX = -Math.sin(dirRad);
  const blowZ = Math.cos(dirRad);

  const gustPhase1 = (worldX * blowX + worldZ * blowZ) * 0.025 - time * 0.42;
  const gustPhase2 = (worldX * 0.017 - worldZ * 0.021) - time * 0.27;
  const gustWave =
    0.6 * Math.sin(gustPhase1) +
    0.4 * Math.sin(gustPhase2 + 1.3);

  const turbPhase = time * 2.3 + worldX * 0.19 + worldZ * 0.13;
  const dirJitterRad =
    config.turbulence *
    0.09 *
    (Math.sin(turbPhase) * 0.65 + Math.cos(turbPhase * 1.7) * 0.35);

  const gustMultiplier = 1.0 + config.gustIntensity * 0.32 * gustWave;
  // Logarithmic atmospheric boundary layer wind shear (stronger higher on mast)
  const heightFactor = 0.88 + 0.16 * Math.min(1.8, Math.max(0.2, worldY / 10.0));
  const trueSpeedMs = Math.max(0, baseMs * gustMultiplier * heightFactor);

  const effDir = dirRad + dirJitterRad;
  const trueX = -Math.sin(effDir) * trueSpeedMs;
  const trueY = config.turbulence * 0.25 * Math.sin(time * 1.9 + worldX * 0.1);
  const trueZ = Math.cos(effDir) * trueSpeedMs;

  // Apparent wind = True wind - Vessel velocity
  const appX = trueX - vesselVelX;
  const appY = trueY - vesselVelY;
  const appZ = trueZ - vesselVelZ;
  const apparentSpeedMs = Math.hypot(appX, appY, appZ);

  // Relative angle of apparent wind coming ONTO the vessel bow
  // Wind comes FROM (-appX, -appZ). Project onto vessel forward & starboard axes.
  const fromX = -appX;
  const fromZ = -appZ;
  const onForward = fromX * vesselForwardX + fromZ * vesselForwardZ;
  const onStarboard = fromX * vesselRightX + fromZ * vesselRightZ;
  const apparentRelAngleRad = Math.atan2(onStarboard, onForward);

  out.trueX = trueX;
  out.trueY = trueY;
  out.trueZ = trueZ;
  out.trueSpeedMs = trueSpeedMs;
  out.apparentX = appX;
  out.apparentY = appY;
  out.apparentZ = appZ;
  out.apparentSpeedMs = apparentSpeedMs;
  out.apparentRelAngleRad = apparentRelAngleRad;

  return out;
}
