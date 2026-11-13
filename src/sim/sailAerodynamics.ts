import { ControlInputs } from './types';
import { WindSample } from './windField';

const AIR_DENSITY = 1.225; // kg/m^3 at sea level
const MAINSAIL_AREA_M2 = 36.0; // Aster S-01 (~12m sloop) full mainsail area
const JIB_AREA_M2 = 24.0;      // Full headsail/jib area
const NO_GO_HALF_ANGLE_RAD = (32 * Math.PI) / 180; // ~32 deg dead zone directly into wind

export interface SailAeroResult {
  /** World-space aerodynamic force vector (Newtons) */
  forceWorldX: number;
  forceWorldY: number;
  forceWorldZ: number;
  /** Forward thrust component along vessel bow (-Z local) */
  forwardForceN: number;
  /** Lateral heeling component along vessel right (+X local) */
  lateralForceN: number;
  /** Total magnitude (Newtons) */
  totalForceN: number;
  /** Center of effort height above hull origin (meters) */
  centerOfEffortY: number;
  /** Center of effort longitudinal offset (meters, + = aft, - = forward) */
  centerOfEffortZ: number;
  /** Signed boom angle in radians (+ = boom swings to port, - = starboard) */
  boomAngleRad: number;
  /** Signed jib clew angle in radians */
  jibAngleRad: number;
  /** True when vessel bow points inside no-go zone */
  inNoGoZone: boolean;
  /** 0..1 sail luffing / fluttering intensity */
  luffingFactor: number;
  /** Pressure differential scalar for cloth solver (Pascals proxy) */
  clothPressure: number;
}

export function createSailAeroResult(): SailAeroResult {
  return {
    forceWorldX: 0,
    forceWorldY: 0,
    forceWorldZ: 0,
    forwardForceN: 0,
    lateralForceN: 0,
    totalForceN: 0,
    centerOfEffortY: 5.8,
    centerOfEffortZ: 0.4,
    boomAngleRad: 0,
    jibAngleRad: 0,
    inNoGoZone: false,
    luffingFactor: 0,
    clothPressure: 0,
  };
}

/**
 * Evaluates thin-airfoil + stalled-plate lift & drag coefficients for angle of attack alpha (rad).
 */
function sailPolars(alphaAbs: number): { cl: number; cd: number } {
  // Peak lift around 22-28 degrees (~1.38 CL), smooth stall above 35 degrees
  const sinA = Math.sin(alphaAbs);
  const cosA = Math.cos(alphaAbs);
  const cl = 1.48 * Math.sin(2 * alphaAbs) * Math.exp(-0.35 * alphaAbs);
  const cd = 0.06 + 1.25 * sinA * sinA + 0.12 * (1 - cosA);
  return { cl, cd };
}

/**
 * Computes aerodynamic propulsion, lateral heeling force, boom tacking angle,
 * and no-go zone behavior from apparent wind and sail controls.
 */
export function computeSailAerodynamics(
  wind: WindSample,
  controls: ControlInputs,
  vesselForwardX: number,
  vesselForwardZ: number,
  vesselRightX: number,
  vesselRightZ: number,
  vesselUpX: number,
  vesselUpY: number,
  vesselUpZ: number,
  currentBoomAngleRad: number,
  dt: number,
  out: SailAeroResult,
): SailAeroResult {
  const sailAreaFactor = Math.max(0, Math.min(1, controls.sailArea));
  if (sailAreaFactor < 0.02 || wind.apparentSpeedMs < 0.05) {
    out.forceWorldX = 0;
    out.forceWorldY = 0;
    out.forceWorldZ = 0;
    out.forwardForceN = 0;
    out.lateralForceN = 0;
    out.totalForceN = 0;
    out.luffingFactor = 0;
    out.clothPressure = 0;
    out.inNoGoZone = false;
    out.boomAngleRad = currentBoomAngleRad * Math.exp(-3 * dt);
    out.jibAngleRad = out.boomAngleRad * 0.9;
    return out;
  }

  // Apparent wind relative angle: 0 = headwind, + = wind from starboard, - = wind from port
  const relAngle = wind.apparentRelAngleRad;
  const absRel = Math.abs(relAngle);

  // Side wind comes from: if relAngle > 0 (starboard), sail blows to PORT (-X).
  // Boom rotation around +Y: positive angle rotates aft boom (+Z) toward starboard (+X)?
  // Wait: local boom vector when angle=0 is (0, 0, +L).
  // Rotating (0, 0, +1) by angle theta around +Y gives (sin(theta), 0, cos(theta)).
  // So if wind comes from starboard (+X, relAngle > 0), boom swings to PORT (-X) -> negative theta!
  const leewardSign = relAngle >= 0 ? -1 : 1;

  // Max boom angle allowed by mainsheet trim (8 deg hauled tight .. 82 deg eased out)
  const maxSheetRad = (8 + controls.sailTrim * 74) * (Math.PI / 180);

  // Ideal aerodynamic boom angle tries to stay slightly angled to wind, clamped by mainsheet
  // When running downwind (absRel ~ 180 deg), boom swings all the way to maxSheetRad
  const desiredBoomAbs = Math.min(maxSheetRad, Math.max(0.08, absRel * 0.62));
  const targetBoomRad = leewardSign * desiredBoomAbs;

  // Smooth boom swing during tacks (cambada)
  const boomAlpha = 1 - Math.exp(-5.5 * dt);
  const boomAngleRad = currentBoomAngleRad + (targetBoomRad - currentBoomAngleRad) * boomAlpha;

  // No-go zone (irons): pointing directly into apparent wind (< ~32 deg)
  const inNoGoZone = absRel < NO_GO_HALF_ANGLE_RAD;

  // Compute true angle of attack between apparent wind flow and sail chord
  // Wind flow vector in vessel local XZ: wind flows TOWARD (-cos(rel), -sin(rel)) in (fwd, right)
  // Sail chord points from mast toward clew: (+sin(boomAngle), +cos(boomAngle)) in (right, fwd) -> (cos(boomAngle) aft, sin(boomAngle) right)
  const boomChordFwd = -Math.cos(boomAngleRad); // mast->clew goes aft (+Z = -fwd)
  const boomChordRight = Math.sin(boomAngleRad);
  const flowFwd = -Math.cos(relAngle);
  const flowRight = -Math.sin(relAngle);

  // Angle between flow and chord
  const dotFlowChord = Math.max(-1, Math.min(1, flowFwd * boomChordFwd + flowRight * boomChordRight));
  const alphaRaw = Math.acos(dotFlowChord);
  // Effective AoA is deviation from alignment; if wind hits back of sail or nose-on, luffing occurs
  let effectiveAoA = Math.min(alphaRaw, Math.PI - alphaRaw);

  let luffingFactor = 0;
  let efficiency = 1.0;

  if (inNoGoZone) {
    const ratio = absRel / NO_GO_HALF_ANGLE_RAD; // 0 dead headwind, 1 edge of no-go
    luffingFactor = 1.0 - ratio * 0.65;
    efficiency = Math.pow(ratio, 2.2) * 0.25;
    effectiveAoA *= ratio;
  } else {
    // Check if sail is oversheeted or undersheeted relative to apparent wind
    const idealAoA = 0.36; // ~21 deg optimal camber AoA
    const aoaDiff = Math.abs(effectiveAoA - idealAoA);
    if (effectiveAoA < 0.14) {
      // Too close to wind / sheeted too loosely -> partial luffing on luff edge
      luffingFactor = Math.min(0.85, (0.14 - effectiveAoA) * 6.0);
      efficiency = 0.45 + 0.55 * (effectiveAoA / 0.14);
    } else if (aoaDiff > 0.7) {
      // Stalled / running deep
      efficiency = 0.85;
    }
  }

  // Heel cosine projection reduces effective wind area slightly when heeled strongly
  const uprightFactor = Math.max(0.45, vesselUpY);

  const effectiveArea = (MAINSAIL_AREA_M2 + JIB_AREA_M2) * sailAreaFactor * uprightFactor;
  const vApp = wind.apparentSpeedMs;
  const qDyn = 0.5 * AIR_DENSITY * vApp * vApp * effectiveArea;

  const { cl, cd } = sailPolars(effectiveAoA);

  // Drag acts along apparent wind flow direction; Lift acts perpendicular to flow toward leeward!
  const appNormX = wind.apparentX / vApp;
  const appNormZ = wind.apparentZ / vApp;

  // Perpendicular to apparent flow in XZ, pointing toward leeward side of sail
  // Vessel leeward in world XZ:
  const leeWorldX = leewardSign * vesselRightX;
  const leeWorldZ = leewardSign * vesselRightZ;
  // Two candidates perpendicular to (appNormX, appNormZ): (-appNormZ, appNormX) and (appNormZ, -appNormX)
  let liftDirX = -appNormZ;
  let liftDirZ = appNormX;
  if (liftDirX * leeWorldX + liftDirZ * leeWorldZ < 0) {
    liftDirX = -liftDirX;
    liftDirZ = -liftDirZ;
  }

  const liftMag = qDyn * cl * efficiency;
  const dragMag = qDyn * cd * (inNoGoZone ? 0.55 : 1.0);

  // Total world horizontal aerodynamic force
  const totalWorldX = liftDirX * liftMag + appNormX * dragMag;
  const totalWorldZ = liftDirZ * liftMag + appNormZ * dragMag;
  // Slight downward/upward component due to mast heel
  const totalWorldY = -Math.abs(totalWorldX * vesselUpX + totalWorldZ * vesselUpZ) * 0.12;

  const forwardForceN = totalWorldX * vesselForwardX + totalWorldZ * vesselForwardZ;
  const lateralForceN = totalWorldX * vesselRightX + totalWorldZ * vesselRightZ;

  // Reefing lowers the Center of Effort vertically (realistic reefing stability benefit!)
  const centerOfEffortY = 2.6 + 3.6 * sailAreaFactor;
  const centerOfEffortZ = -0.35 + 0.55 * (1 - controls.sailTrim);

  out.forceWorldX = totalWorldX;
  out.forceWorldY = totalWorldY;
  out.forceWorldZ = totalWorldZ;
  out.forwardForceN = forwardForceN;
  out.lateralForceN = lateralForceN;
  out.totalForceN = Math.hypot(totalWorldX, totalWorldY, totalWorldZ);
  out.centerOfEffortY = centerOfEffortY;
  out.centerOfEffortZ = centerOfEffortZ;
  out.boomAngleRad = boomAngleRad;
  out.jibAngleRad = boomAngleRad * 0.92;
  out.inNoGoZone = inNoGoZone;
  out.luffingFactor = luffingFactor;
  out.clothPressure =
    leewardSign * -1 * (0.5 * AIR_DENSITY * vApp * vApp) * (0.35 + 0.65 * efficiency);

  return out;
}
