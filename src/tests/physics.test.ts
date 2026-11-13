import { BAIXADA_SANTISTA_LANDMARKS, SANTOS_ORIGIN } from '../geo/baixadaSantistaData';
import { GeoWorldManager } from '../geo/geoWorldManager';
import { validateAndMigrateSave } from '../services/saveSystem';
import { KaelCharacterController } from '../sim/characterController';
import {
  applyCollisionDamage,
  calculateFullRepairCost,
  computeVesselModifiers,
  createInitialSubsystems,
  repairAllSubsystems,
} from '../sim/damageSystem';
import { DynamicOceanEvents } from '../sim/dynamicEvents';
import {
  addItemToInventory,
  buyItem,
  computeCargoWeightKg,
  createInitialEconomyState,
  purchaseVesselUpgrade,
  sellItem,
} from '../sim/economySystem';
import { FishingSystem, isPointInProtectedFishingZone } from '../sim/fishingSystem';
import { MaritimeTrafficManager } from '../sim/maritimeTraffic';
import {
  acceptMissionById,
  cancelMissionById,
  createCampaignMissions,
  evaluateCampaignMissions,
} from '../sim/missionManager';
import {
  createInitialMissionState,
  evaluatePrimeiraTravessia,
  PRIMEIRA_TRAVESSIA_CHECKPOINT,
} from '../sim/missionSystem';
import { ensureRapierInitialized, NavalPhysicsWorld } from '../sim/navalPhysics';
import { BASE_WAVE_COMPONENTS, createWaveSample, sampleOcean } from '../sim/oceanSolver';
import { PirateAIManager } from '../sim/pirateAI';
import { awardSkillXp, createInitialProgressionState } from '../sim/progressionSystem';
import { computeSailAerodynamics, createSailAeroResult } from '../sim/sailAerodynamics';
import { createDefaultSimulationParams, createGraphicsSettingsForProfile } from '../sim/scenarios';
import { SubmarineController } from '../sim/submarineController';
import { TelemetrySnapshot } from '../sim/types';
import {
  computeEffectiveThrustN,
  computeEffectiveVesselCargoKg,
  createOwnedVesselFromSpec,
  createStarterOwnedVessel,
  VESSEL_CATALOG,
} from '../sim/vesselCatalog';
import { createInitialAtmosphere, LIGHTING_PRESETS, stepAtmosphere } from '../sim/weatherSystem';
import { createWindSample, KNOTS_TO_MS, sampleWindField } from '../sim/windField';

export interface TestCaseResult {
  name: string;
  passed: boolean;
  detail: string;
}

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

/**
 * Automated verification suite for Abyssal Frontier 0.5:
 * Gerstner waves, apparent wind, sail aerodynamics, Rapier 6-DOF stability,
 * WGS84 ENU & floating origin, Kael terrestrial & underwater diving controllers,
 * Primeira Travessia & Chapter 1 MissionManager, Economy/Upgrades, DamageSystem,
 * MaritimeTraffic AI, DynamicOceanEvents, and Versioned Save Migration.
 */
export async function runNavalPhysicsTestSuite(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const params = createDefaultSimulationParams();

  // 1. Gerstner Wave Mathematics
  try {
    const sample = createWaveSample();
    let maxH = -Infinity;
    let minH = Infinity;
    for (let t = 0; t < 12; t += 0.25) {
      sampleOcean(12.5, -8.3, t, params.ocean, sample);
      assert(Number.isFinite(sample.height), 'Wave height must be finite');
      const normLen = Math.hypot(sample.normalX, sample.normalY, sample.normalZ);
      assert(Math.abs(normLen - 1.0) < 1e-3, `Wave normal not unit length: ${normLen}`);
      assert(sample.normalY > 0.2, `Wave normal inverted: ${sample.normalY}`);
      maxH = Math.max(maxH, sample.height);
      minH = Math.min(minH, sample.height);
    }
    assert(maxH > 0.1 && minH < -0.1, 'Waves must oscillate above and below mean sea level');
    results.push({
      name: 'Ondas de Gerstner (Altura, Normais Unitárias & Velocidade Orbital)',
      passed: true,
      detail: `Amplitude validada [${minH.toFixed(2)}m, +${maxH.toFixed(2)}m], normais unitárias.`,
    });
  } catch (err) {
    results.push({
      name: 'Ondas de Gerstner',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Apparent Wind Calculation
  try {
    const ws = createWindSample();
    sampleWindField(
      0, 5, 0, 1.0,
      0, 0, -5.0,
      0, -1, 1, 0,
      { speedKnots: 15, directionDeg: 0, gustIntensity: 0, turbulence: 0 },
      ws,
    );
    const expectedMin = 15 * KNOTS_TO_MS * 0.9 + 4.5;
    assert(ws.apparentSpeedMs > expectedMin, `Apparent wind too low: ${ws.apparentSpeedMs}`);
    assert(Math.abs(ws.apparentRelAngleRad) < 0.05, `Expected headwind ~0 rad, got ${ws.apparentRelAngleRad}`);
    results.push({
      name: 'Vento Aparente & Cisalhamento Vertical',
      passed: true,
      detail: `Vento verdadeiro 15 kts + avanço 5 m/s => aparente ${(ws.apparentSpeedMs / KNOTS_TO_MS).toFixed(1)} kts.`,
    });
  } catch (err) {
    results.push({
      name: 'Vento Aparente',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Sail Aerodynamics: No-Go Zone vs Beam Reach
  try {
    const wsHead = createWindSample();
    sampleWindField(
      0, 5.8, 0, 0,
      0, 0, 0,
      0, -1, 1, 0,
      { speedKnots: 18, directionDeg: 0, gustIntensity: 0, turbulence: 0 },
      wsHead,
    );
    const aeroHead = createSailAeroResult();
    computeSailAerodynamics(
      wsHead,
      { throttle: 0, rudderTarget: 0, sailTrim: 0.25, sailArea: 1.0 },
      0, -1, 1, 0, 0, 1, 0,
      0.1, 1 / 60, aeroHead,
    );
    assert(aeroHead.inNoGoZone, 'Heading directly into wind must trigger No-Go Zone');
    assert(aeroHead.luffingFactor > 0.7, 'No-Go Zone must produce strong sail luffing');
    assert(aeroHead.forwardForceN <= 50, `Headwind should not propel forward: ${aeroHead.forwardForceN}`);

    const wsBeam = createWindSample();
    sampleWindField(
      0, 5.8, 0, 0,
      0, 0, 0,
      0, -1, 1, 0,
      { speedKnots: 18, directionDeg: 90, gustIntensity: 0, turbulence: 0 },
      wsBeam,
    );
    const aeroBeam = createSailAeroResult();
    computeSailAerodynamics(
      wsBeam,
      { throttle: 0, rudderTarget: 0, sailTrim: 0.45, sailArea: 1.0 },
      0, -1, 1, 0, 0, 1, 0,
      -0.3, 1 / 60, aeroBeam,
    );
    assert(!aeroBeam.inNoGoZone, 'Beam wind (90 deg) must be navigable');
    assert(aeroBeam.forwardForceN > 800, `Beam reach must generate strong forward thrust: ${aeroBeam.forwardForceN}`);
    results.push({
      name: 'Aerodinâmica (Zona de Não Navegação vs Vento de Través)',
      passed: true,
      detail: `Proa ao vento: luff ${(aeroHead.luffingFactor * 100).toFixed(0)}%; Través: empuxo +${aeroBeam.forwardForceN.toFixed(0)} N.`,
    });
  } catch (err) {
    results.push({
      name: 'Aerodinâmica das Velas',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Hydrostatic Buoyancy Equilibrium & 60s Numerical Stability in Rapier 3D
  try {
    await ensureRapierInitialized();
    const physics = new NavalPhysicsWorld(params.vessel);
    const controls = { throttle: 0, rudderTarget: 0.05, sailTrim: 0.48, sailArea: 0.85 };
    const roughOcean = { ...params.ocean, waveScale: 1.4, chopScale: 1.2 };
    const roughWind = { ...params.wind, speedKnots: 20, directionDeg: 95 };

    for (let i = 0; i < 3600; i++) {
      physics.step(1 / 60, roughOcean, roughWind, params.vessel, controls);
    }

    const eco = createInitialEconomyState();
    const missions = createCampaignMissions();
    const snap: TelemetrySnapshot = {
      timestamp: 0, fps: 60, simTime: 0, controlMode: 'sailing',
      posX: 0, posZ: 0, posY: 0, geoLat: SANTOS_ORIGIN.lat, geoLon: SANTOS_ORIGIN.lon,
      charX: 0, charY: 0, charZ: 0, charLat: SANTOS_ORIGIN.lat, charLon: SANTOS_ORIGIN.lon,
      charHeadingDeg: 0, charGrounded: true, charAnim: 'steer',
      oxygenPct: 100, maxOxygenSeconds: 45, waterDepthM: 0, distanceNm: 0,
      speedKnots: 0, speedMs: 0, headingDeg: 0, courseOverGroundDeg: 0, leewayDeg: 0,
      rollDeg: 0, pitchDeg: 0, yawRateDegS: 0, trueWindKnots: 0, trueWindDirDeg: 0,
      apparentWindKnots: 0, apparentWindRelDeg: 0, boomAngleDeg: 0, sailAreaPct: 0,
      sailTrimPct: 0, inNoGoZone: false, luffingFactor: 0, aeroForceN: 0, aeroForwardN: 0,
      aeroLateralN: 0, buoyancyForceN: 0, hydroDragN: 0, keelLiftN: 0, auxThrustN: 0,
      submergedElements: 0, totalElements: 24, throttle: 0, rudderDeg: 0,
      waveHeightAtBoat: 0, weatherPreset: 'clear',
      condition: {
        hullIntegrityPct: 100,
        subsystems: createInitialSubsystems(),
        fuelPct: 100,
        batteryPct: 100,
        moored: false,
      },
      activePrompt: null,
      loadedSectorsCount: 0,
      geoDataSource: 'test',
      mission: createInitialMissionState(false),
      activeMission: null,
      allMissions: missions,
      economy: eco,
      npcVessels: [],
      activeEvent: null,
      underwaterNodes: [],
      storyCluesFound: [],
      fishing: new FishingSystem().getSnapshot(),
      fishingStats: { totalCaught: 0, totalSoldCr: 0, catches: [] },
      underwater: {
        depthM: 0,
        maxSafeDepthM: 7,
        waterTempC: 23,
        visibilityM: 22,
        pressureAtm: 1,
        decompressionRiskPct: 0,
        flashlightOn: false,
        currentSpeedMs: 0.2,
        environmentName: 'Superfície',
        depthWarning: null,
      },
      submarine: new SubmarineController().getSnapshot(false, false, 0, params.ocean),
      garage: {
        activeVesselId: 'vessel_aster_starter',
        ownedVessels: [createStarterOwnedVessel()],
      },
      pirates: [],
      combat: {
        playerArmed: false,
        cannonCooldownS: 0,
        cannonMaxCooldownS: 2.2,
        threatLevel: 'none',
        nearestThreatDistM: null,
        activeFires: 0,
        projectilesCount: 0,
        intimidatePromptActive: false,
        bribeCostCr: 120,
      },
      progression: createInitialProgressionState(),
    };
    physics.fillTelemetry(60, roughWind, controls, 'rough', snap);

    assert(Number.isFinite(snap.posX) && Number.isFinite(snap.posY) && Number.isFinite(snap.posZ), 'Vessel position became NaN');
    assert(snap.posY > -2.5 && snap.posY < 4.5, `Vessel height out of hydrostatic bounds: ${snap.posY}`);
    assert(Math.abs(snap.rollDeg) < 60, `Excessive roll instability: ${snap.rollDeg}`);
    assert(snap.speedKnots > 1.5, `Expected sail propulsion velocity > 1.5 kts, got ${snap.speedKnots}`);
    physics.dispose();

    results.push({
      name: 'Flutuação Rapier 3D & Estabilidade Prolongada (3.600 steps / 60s)',
      passed: true,
      detail: `Velocidade ${snap.speedKnots.toFixed(1)} kts, Roll ${snap.rollDeg.toFixed(1)}°, Empuxo ${(snap.buoyancyForceN / 1000).toFixed(1)} kN.`,
    });
  } catch (err) {
    results.push({
      name: 'Flutuação & Estabilidade Rapier 3D',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. GeoWorldManager WGS84 ENU Projection & Floating Origin
  try {
    const geo = new GeoWorldManager(SANTOS_ORIGIN);
    const guaruja = BAIXADA_SANTISTA_LANDMARKS.find((l) => l.id === 'guaruja_balsa')!;
    const palmas = BAIXADA_SANTISTA_LANDMARKS.find((l) => l.id === 'ilha_das_palmas')!;

    const localG = geo.geoToLocal(guaruja.coord.lat, guaruja.coord.lon);
    const roundTrip = geo.localToGeo(localG.x, localG.z);
    const errM = geo.distanceBetweenGeoM(guaruja.coord, roundTrip);
    assert(errM < 0.01, `WGS84 round-trip error too high: ${errM}m`);
    assert(localG.x > 400 && localG.x < 1800, `Guarujá expected East (+X) across channel, got ${localG.x}`);

    const distPalmas = geo.distanceBetweenGeoM(SANTOS_ORIGIN, palmas.coord);
    assert(distPalmas > 1400 && distPalmas < 3500, `Ilha das Palmas distance unexpected: ${distPalmas}m`);

    const shift = geo.checkFloatingOriginShift(3500, -1500, 3000);
    assert(shift.shifted && shift.dx === 3500 && shift.dz === -1500, 'Floating origin should shift at 3.5km');
    const shiftedBack = geo.localToGeo(0, 0);
    const expectedAfterShift = new GeoWorldManager(SANTOS_ORIGIN).localToGeo(3500, -1500);
    assert(
      geo.distanceBetweenGeoM(shiftedBack, expectedAfterShift) < 0.01,
      'Floating origin broke global WGS84 coordinates',
    );

    results.push({
      name: 'Projeção Geográfica WGS84 ENU & Origem Flutuante (Baixada Santista)',
      passed: true,
      detail: `Guarujá X=+${localG.x.toFixed(0)}m, Ilha das Palmas ${distPalmas.toFixed(0)}m, erro ida-volta ${errM.toFixed(5)}m.`,
    });
  } catch (err) {
    results.push({
      name: 'Projeção WGS84 & Origem Flutuante',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 6. Kael Rivera Rapier KinematicCharacterController (Walk + Swimming + Diving Oxygen)
  try {
    await ensureRapierInitialized();
    const physics = new NavalPhysicsWorld(params.vessel, 16.5, 12.0, 172);
    const RAPIER = (await import('@dimforge/rapier3d-compat')).default;
    const world = physics.getWorld();
    const quayRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-24, -1.275, 9.5));
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 2.725, 20), quayRb);
    world.step();

    const kael = new KaelCharacterController(world, -24, 1.48, 9.5);
    for (let i = 0; i < 60; i++) {
      kael.stepOnFoot(1 / 60, {
        forward: 1,
        right: 0,
        sprint: true,
        jumpPressed: i === 10,
        cameraYaw: -Math.PI * 0.5,
      });
      world.step();
    }
    assert(kael.position.x > -20, `Expected Kael to run East along quay, got x=${kael.position.x}`);
    assert(kael.position.y >= 1.4 && kael.position.y < 3.5, `Kael ground height invalid: ${kael.position.y}`);

    // Now test water entry & underwater diving oxygen depletion
    kael.enterWaterAt(45, 55, 0, params.ocean);
    assert(kael.inWater, 'Kael must be inWater after enterWaterAt');
    for (let i = 0; i < 120; i++) {
      kael.stepInWater(
        1 / 60,
        i / 60,
        params.ocean,
        { forward: 0, right: 0, sprint: false, jumpPressed: false, descendHeld: true, cameraYaw: 0 },
        true,
        false,
      );
      world.step();
    }
    assert(kael.underwater && kael.waterDepthM > 0.65, `Expected Kael submerged underwater, depth=${kael.waterDepthM}`);
    assert(kael.oxygenSeconds < 45, `Expected oxygen consumption while diving, got ${kael.oxygenSeconds}`);

    kael.dispose();
    physics.dispose();

    results.push({
      name: 'Controlador Kael Rivera (Terra, Natação & Mergulho com Oxigênio)',
      passed: true,
      detail: `Caminhada +4m em 1s; Mergulho a ${kael.waterDepthM.toFixed(1)}m com consumo de O2 (${kael.oxygenSeconds.toFixed(1)}s/45s).`,
    });
  } catch (err) {
    results.push({
      name: 'Controlador Kael Rivera (Terra & Mergulho)',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 7. Mission State Machines (Primeira Travessia + v0.5 Campaign MissionManager)
  try {
    let m = createInitialMissionState(false);
    m = evaluatePrimeiraTravessia(m, 'on_foot', -2.0, 9.0, 16.5, 12.0, 16.5, 12.0, 0, 0);
    m = evaluatePrimeiraTravessia(m, 'sailing', 16.5, 12.0, 16.5, 12.0, 16.5, 12.0, 0, 0);
    m = evaluatePrimeiraTravessia(m, 'sailing', 16.5, 12.0, 17.0, 13.0, 16.5, 12.0, 0.35, 1.4);
    m = evaluatePrimeiraTravessia(m, 'sailing', 30.0, 45.0, 30.0, 45.0, 16.5, 12.0, 0.5, 4.2);
    m = evaluatePrimeiraTravessia(
      m, 'sailing', PRIMEIRA_TRAVESSIA_CHECKPOINT.x, PRIMEIRA_TRAVESSIA_CHECKPOINT.z,
      PRIMEIRA_TRAVESSIA_CHECKPOINT.x, PRIMEIRA_TRAVESSIA_CHECKPOINT.z, 16.5, 12.0, 0.5, 5.1,
    );
    assert(m.step === 'completed', 'Legacy mission must complete');

    let camp = createCampaignMissions();
    const acc = acceptMissionById(camp, 'm01_entrega_boia');
    assert(acc.accepted !== null && acc.accepted.status === 'in_progress', 'm01 must become in_progress');
    camp = acc.next;

    // Reach waypoint (95, 340) then return to port (-8, 10)
    const stepWp = evaluateCampaignMissions(camp, 95, 340, 95, 1, 340, false, new Set(['cargo_beacon_parts']), false);
    assert(stepWp.waypointJustCompleted !== null, 'Waypoint Boia da Barra must complete');
    const stepDone = evaluateCampaignMissions(stepWp.next, -8, 10, -8, 1.48, 10, false, new Set(['cargo_beacon_parts']), false);
    assert(stepDone.completedMission?.id === 'm01_entrega_boia', 'm01 must complete upon return to port');

    // Test cancellation lifecycle
    const acc2 = acceptMissionById(stepDone.next, 'm02_socorro_canal');
    assert(acc2.accepted !== null, 'm02 should unlock after m01');
    const cancelled = cancelMissionById(acc2.next, 'm02_socorro_canal');
    assert(cancelled.find((item) => item.id === 'm02_socorro_canal')?.status === 'cancelled', 'm02 cancellation failed');

    results.push({
      name: 'MissionManager (Capítulo 1: Aceitar, Waypoints, Retorno & Cancelamento)',
      passed: true,
      detail: 'Fluxo completo validado: m01 entregue/retornada, m02 desbloqueada e cancelamento testado.',
    });
  } catch (err) {
    results.push({
      name: 'MissionManager & Primeira Travessia',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 8. Economy, Cargo Capacity, Vessel Upgrades & DamageSystem
  try {
    let eco = createInitialEconomyState();
    const boughtMask = buyItem(eco, 'equip_diver_mask');
    assert(boughtMask.ok && boughtMask.next.credits === 450 - 180, 'Buying dive mask failed');
    eco = boughtMask.next;

    const addHeavy = addItemToInventory(eco, 'cargo_coffee_sacks', 10);
    assert(!addHeavy.ok, 'Cargo capacity limit (120kg) must block 250kg overload');

    const upg = purchaseVesselUpgrade(eco, 'cargoHoldLevel');
    assert(!upg.ok, 'Insufficient credits (270 < 280) should block cargoHold upgrade');
    eco = { ...eco, credits: 600 };
    const upgOk = purchaseVesselUpgrade(eco, 'cargoHoldLevel');
    assert(upgOk.ok && upgOk.next.maxCargoKg === 220, 'Level 2 cargoHold must expand capacity to 220kg');

    const addedSalvage = addItemToInventory(upgOk.next, 'salvage_brass_valve', 1);
    assert(addedSalvage.ok && computeCargoWeightKg(addedSalvage.next) > 0, 'Adding salvage failed');
    const sold = sellItem(addedSalvage.next, 'salvage_brass_valve');
    assert(sold.ok && sold.next.credits > addedSalvage.next.credits, 'Selling salvage must grant credits');

    const sub0 = createInitialSubsystems();
    const dmg = applyCollisionDamage(sub0, 4.5, 1);
    assert(dmg.next.hullPct < 100 && dmg.next.rudderPct < 100, 'Collision must degrade hull and rudder');
    const mods = computeVesselModifiers(dmg.next, upgOk.next.upgrades);
    assert(mods.dragPenaltyScale > 1.0 && mods.rudderAuthorityScale < 1.0, 'Damage modifiers must degrade performance');
    const repairCost = calculateFullRepairCost(dmg.next);
    assert(repairCost > 0 && repairAllSubsystems().hullPct === 100, 'Repair cost & restoration invalid');

    results.push({
      name: 'Economia, Limite de Carga, Upgrades & Sistema de Avarias',
      passed: true,
      detail: `Equipamento, bloqueio de sobrecarga (>120kg), upgrade Porão 220kg, dano por colisão (-${dmg.hullDelta.toFixed(1)}% casco) validados.`,
    });
  } catch (err) {
    results.push({
      name: 'Economia & Sistema de Avarias',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 9. Maritime Traffic AI, Dynamic Ocean Events & Save Validation
  try {
    const traffic = new MaritimeTrafficManager();
    const before = traffic.getSnapshots();
    for (let i = 0; i < 120; i++) {
      traffic.step(1 / 60, 0, 0);
    }
    const after = traffic.getSnapshots();
    assert(after.length === 5, 'Expected 5 named NPC vessels');
    const moved = Math.hypot(after[0].x - before[0].x, after[0].z - before[0].z);
    assert(moved > 1.0, 'NPC ferry did not advance along route');

    const events = new DynamicOceanEvents();
    const evStep = events.step(60, 200, 350, 150, 'clear', 100, 1, true);
    assert(evStep.spawned !== null && events.activeEvent !== null, 'Expected dynamic ocean event to spawn beyond 140m');
    const evResolved = events.step(65, evStep.spawned!.x, evStep.spawned!.z, 150, 'clear', 100, 1, true);
    assert(evResolved.resolved !== null && events.activeEvent === null, 'Dynamic event must resolve on arrival');

    const badSave = validateAndMigrateSave({ version: 0 });
    assert(badSave === null, 'Version 0 save must be rejected');
    const validSave = validateAndMigrateSave({
      version: 1,
      economy: { credits: 999, upgrades: { engineLevel: 99, cargoHoldLevel: 2 } },
      subsystems: { hullPct: -20, enginePct: 80 },
    });
    assert(validSave !== null && validSave.economy.upgrades.engineLevel === 3, 'Save migration must clamp corrupted values safely');
    assert(validSave!.subsystems.hullPct === 10 && validSave!.economy.maxCargoKg === 220, 'Sanitized save metrics invalid');

    results.push({
      name: 'Tráfego Marítimo IA, Eventos Dinâmicos & Save Versionado',
      passed: true,
      detail: `5 navios NPC ativos, evento "${evStep.spawned!.title}" gerado/resolvido, migração/sanitização de save validada.`,
    });
  } catch (err) {
    results.push({
      name: 'Tráfego IA, Eventos & Save',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 10. v0.6 Ultra Graphics Systems: 8-Wave Spectrum, Lighting Presets & Quality Profiles
  try {
    assert(
      BASE_WAVE_COMPONENTS.length === 8,
      `Expected 8 multi-scale Gerstner wave components, got ${BASE_WAVE_COMPONENTS.length}`,
    );

    const atm = createInitialAtmosphere('clear', 'noon');
    assert(atm.nightFactor === 0 && atm.sunElevationDeg > 45, 'Noon preset must have high sun and zero nightFactor');

    for (let i = 0; i < 300; i++) {
      stepAtmosphere(atm, 'clear', 1 / 60, 'clear_night');
    }
    assert(atm.nightFactor > 0.95, `Expected smooth transition to clear_night, got nightFactor=${atm.nightFactor}`);
    assert(
      atm.ambientFactor >= 0.45 && atm.exposure >= 1.15,
      `Night lighting must remain navigable (ambient=${atm.ambientFactor}, exposure=${atm.exposure})`,
    );
    assert(Object.keys(LIGHTING_PRESETS).length === 6, 'Expected all 6 named lighting presets');

    const low = createGraphicsSettingsForProfile('low');
    const med = createGraphicsSettingsForProfile('medium');
    const high = createGraphicsSettingsForProfile('high');
    const ultra = createGraphicsSettingsForProfile('ultra');
    assert(
      low.renderScale < med.renderScale &&
        med.renderScale <= high.renderScale &&
        low.viewDistanceM < med.viewDistanceM &&
        med.viewDistanceM < high.viewDistanceM &&
        high.viewDistanceM < ultra.viewDistanceM &&
        low.particleDensity < ultra.particleDensity &&
        low.vegetationDensity < ultra.vegetationDensity,
      'Graphics presets must scale cleanly across low -> medium -> high -> ultra',
    );

    results.push({
      name: 'v0.6 Gráficos, Espectro 8 Ondas, Presets de Iluminação & Perfis',
      passed: true,
      detail: `8 ondas Gerstner, 6 presets de iluminação (noite visível ambient=${atm.ambientFactor.toFixed(2)}), 4 perfis escaláveis validados.`,
    });
  } catch (err) {
    results.push({
      name: 'v0.6 Gráficos, Iluminação & Perfis',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 11. v0.7 FishingSystem: Charge -> Cast -> Bite -> Reeling -> Catch & Protected Laje Norte Zone
  try {
    let eco = createInitialEconomyState();
    eco = { ...eco, credits: 1200 };
    eco = buyItem(eco, 'equip_rod_pro').next;
    eco = buyItem(eco, 'equip_reel_pro').next;
    eco = buyItem(eco, 'bait_sardine').next;

    const fishSys = new FishingSystem();
    fishSys.syncEquipmentSelection(eco);
    assert(fishSys.equippedRodId === 'equip_rod_pro', 'Pro rod must auto-select');
    assert(isPointInProtectedFishingZone(-210, 520), 'Laje Norte must be flagged as protected sanctuary');

    fishSys.startCharge();
    fishSys.step(0.9, 10, 60, 1.2, 320, params.ocean, 'clear', 0, eco, 2, true, true, false);
    const castRes = fishSys.releaseCast(60, 1.2, 320, 0, 1, 10, params.ocean, eco, 2, true, false);
    assert(castRes.consumedBaitId === 'bait_sardine', 'Cast must consume 1 sardine bait');
    assert(fishSys.stage === 'casting' || fishSys.stage === 'waiting', `Expected casting/waiting after release, got ${fishSys.stage}`);

    // Step through cast flight & wait until bite triggers
    let simT = 10.1;
    for (let i = 0; i < 600 && (fishSys.stage === 'casting' || fishSys.stage === 'waiting'); i++) {
      simT += 1 / 30;
      fishSys.step(1 / 30, simT, 60, 1.2, 320, params.ocean, 'clear', 0, eco, 2, true, false, false);
    }
    assert(fishSys.stage === 'bite', `Expected bite stage after waiting, got ${fishSys.stage}`);

    // Hook fish & reel in pulsed bursts until caught
    fishSys.hookOrActionPressed(eco, 2, true);
    assert(fishSys.stage === 'reeling', 'Hook action must enter reeling stage');
    for (let i = 0; i < 1200 && fishSys.stage === 'reeling'; i++) {
      simT += 1 / 30;
      const pullHold = fishSys.tensionPct < 65;
      fishSys.step(1 / 30, simT, 60, 1.2, 320, params.ocean, 'clear', 0, eco, 4, true, false, pullHold);
    }
    assert(fishSys.stage === 'caught' && fishSys.catches.length === 1, `Expected 1 caught fish, got stage=${fishSys.stage}`);

    // Verify protected zone catch yields 0 CR sale value
    fishSys.catches.push({
      id: 'test_prot',
      speciesId: 'fish_garoupa',
      speciesName: 'Garoupa-da-Pedra',
      weightKg: 8.5,
      quality: 'Troféu',
      valueCr: 0,
      protectedSpecies: true,
      caughtAt: simT,
      sold: false,
    });
    const soldRes = fishSys.sellAllCatches();
    assert(soldRes.soldCount === 1 && soldRes.releasedProtected === 1 && soldRes.earnedCr > 0, 'Protected fish must release at 0 CR while normal catch sells');

    results.push({
      name: 'v0.7 FishingSystem (Arremesso, Fisgada, Tensão & Reserva Laje Norte)',
      passed: true,
      detail: `Captura "${fishSys.catches[0].speciesName}" (${fishSys.catches[0].weightKg.toFixed(1)}kg), venda +${soldRes.earnedCr} CR e soltura protegida validados.`,
    });
  } catch (err) {
    results.push({
      name: 'v0.7 FishingSystem',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 12. v0.7 SubmarineController (NEREID S-1 Dive, Pressure, Battery & Active Sonar)
  try {
    const sub = new SubmarineController();
    sub.resetAt(100, -2, 700, 180);
    const targets = [
      { id: 't_wreck', label: 'Naufrágio Profundo', kind: 'wreck' as const, x: 120, y: -24, z: 720 },
      { id: 't_far', label: 'Longe Demais', kind: 'reef' as const, x: 1500, y: -15, z: 1500 },
    ];
    for (let i = 0; i < 180; i++) {
      sub.step(
        1 / 30,
        i / 30,
        params.ocean,
        { throttle: 0.7, steer: 0.1, ascend: false, descend: true },
        2,
        2,
        2,
        targets,
        -40,
      );
    }
    const snap = sub.getSnapshot(true, true, 6, params.ocean);
    assert(snap.depthM > 4.0, `Expected NEREID S-1 to dive deeper than 4m, got ${snap.depthM}`);
    assert(snap.pressureAtm > 1.35, 'Submarine hydrostatic pressure must increase with depth');
    assert(snap.batteryPct < 100 && snap.batteryPct > 80, 'Battery consumption out of expected band');
    assert(
      snap.sonarContacts.some((c) => c.id === 't_wreck') && !snap.sonarContacts.some((c) => c.id === 't_far'),
      'Active sonar must detect nearby wreck and filter out-of-range targets',
    );

    results.push({
      name: 'v0.7 Submersível NEREID S-1 (Lastro, Pressão & Sonar Ativo)',
      passed: true,
      detail: `Profundidade ${snap.depthM.toFixed(1)}m (${snap.pressureAtm.toFixed(2)} atm), bateria ${snap.batteryPct.toFixed(1)}%, contato sonar real detectado.`,
    });
  } catch (err) {
    results.push({
      name: 'v0.7 Submersível NEREID S-1',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 13. v0.7 VesselCatalog (6 Ships), Fleet Calculations & Skill Progression
  try {
    assert(VESSEL_CATALOG.length === 6, `Expected 6 vessels in catalog, got ${VESSEL_CATALOG.length}`);
    const atlasSpec = VESSEL_CATALOG.find((v) => v.id === 'atlas_t2')!;
    const ownedAtlas = createOwnedVesselFromSpec(atlasSpec, 2);
    ownedAtlas.upgrades.cargoHoldLevel = 2;
    ownedAtlas.upgrades.engineLevel = 2;
    assert(computeEffectiveVesselCargoKg(ownedAtlas) === 520, 'Atlas cargoHold Nv2 should be 520kg');
    assert(computeEffectiveThrustN(ownedAtlas) > 10000, 'Atlas upgraded thrust must exceed 10 kN');

    let prog = createInitialProgressionState();
    const xpRes = awardSkillXp(prog, 'fishing', 240);
    prog = xpRes.next;
    assert(prog.fishing.level >= 2 && xpRes.leveledUpTo !== null, 'Awarding 240 XP must level up fishing skill');

    results.push({
      name: 'v0.7 Frota Naval (6 Embarcações), Upgrades & Progressão de Habilidades',
      passed: true,
      detail: `6 classes catalogadas, Atlas T-2 porão ${computeEffectiveVesselCargoKg(ownedAtlas)}kg, Pesca Nv.${prog.fishing.level} validados.`,
    });
  } catch (err) {
    results.push({
      name: 'v0.7 Frota Naval & Progressão',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 14. v0.7 PirateAIManager (Perception, Attack, Bribe Retreat) & Save v1->v2 Migration
  try {
    const pirateMgr = new PirateAIManager();
    const pirInit = pirateMgr.getPirateSnapshots(0, 0)[0];
    let simT = 5;
    for (let i = 0; i < 120; i++) {
      simT += 1 / 20;
      const curPir = pirateMgr.getPirateSnapshots(0, 0).find((p) => p.id === pirInit.id)!;
      pirateMgr.step(1 / 20, simT, curPir.x + 110, curPir.z, 0, 0, false, 0.001, 0, 0, 1);
    }
    const afterClose = pirateMgr.getPirateSnapshots(0, 0).find((p) => p.id === pirInit.id)!;
    assert(afterClose.aiState !== 'patrol', `Pirate should react when player approaches in clear daylight, got ${afterClose.aiState}`);

    // Pay bribe when pirate is in approach/chase/intimidate
    const bribeRes = pirateMgr.payIntimidationBribe(simT);
    assert(bribeRes.paidCr === 120, `Bribe must cost 120 CR, got ${bribeRes.paidCr}`);
    const afterBribe = pirateMgr.getPirateSnapshots(0, 0).find((p) => p.id === pirInit.id)!;
    assert(afterBribe.aiState === 'retreat', `Bribed pirate must enter retreat state, got ${afterBribe.aiState}`);

    // Save v1 -> v2 migration
    const migrated = validateAndMigrateSave({
      version: 1,
      economy: { credits: 800, upgrades: { engineLevel: 2, hullArmorLevel: 1, sailRigLevel: 1, cargoHoldLevel: 2 } },
      subsystems: { hullPct: 92 },
    });
    assert(migrated !== null && migrated.version === 2, 'v1 save must migrate cleanly to version 2');
    assert(
      (migrated?.ownedVessels?.length ?? 0) >= 1 && migrated?.progression?.navigation.level === 1,
      'Migrated v2 save must include fleet & progression',
    );

    results.push({
      name: 'v0.7 Piratas (IA, Pedágio 120 CR, Evasão) & Migração Save v1→v2',
      passed: true,
      detail: `IA pirata "${pirInit.name}" reagiu (${afterClose.aiState}), recuo por pedágio (${afterBribe.aiState}) e migração Save v1→v2 validados.`,
    });
  } catch (err) {
    results.push({
      name: 'v0.7 Piratas & Save v2',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes('physics.test');

if (isDirectCli) {
  runNavalPhysicsTestSuite().then((res) => {
    let failed = 0;
    for (const r of res) {
      console.log(`${r.passed ? '[PASS]' : '[FAIL]'} ${r.name} — ${r.detail}`);
      if (!r.passed) failed++;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
