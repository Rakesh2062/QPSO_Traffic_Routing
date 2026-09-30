/**
 * Synthetic Graph QPSO Engine - Hybrid Quantum Swarm with VRPTW Constraints and Multi-Vehicle Dispatch.
 *
 * Implements Quantum-Behaved Particle Swarm Optimization (Sun et al.)
 * tailored for multi-vehicle Vehicle Routing with Time Windows (VRPTW):
 *   - Continuous-to-discrete Random-Key permutation mapping with bound clamping [0, 1]
 *   - Quantum Delta-Potential well wave function attractor updates
 *   - Adaptive contraction coefficient β decay with stochastic Cauchy tunneling
 *   - In-generation 2-Opt local search & swap operator integration
 *   - Sequential multi-vehicle depot dispatch simulation
 */

export interface SyntheticNode {
  id: string;
  x: number;               // 0..100 normalized canvas coordinate
  y: number;
  label: string;
  demand: number;          // Parcel weight (kg)
  maxWaitMinutes?: number; // Max time (minutes) customer can wait
  priority?: "high" | "medium" | "low";
  isDepot?: boolean;
}

export interface SyntheticEdge {
  id: string;
  src: string;
  dst: string;
  distance: number;    // Distance in km
  weight?: number;      // Deprecated alias for distance
  congestion: number;  // 1.0..2.5 traffic multiplier
}

export interface SwarmParticleState {
  id: number;
  currentStopId: string;
  targetStopId: string;
  progress: number;    // 0..1
  color: string;
}

export interface AlgorithmStepSnapshot {
  stepIndex: number;
  totalSteps: number;
  phase: 'initialization' | 'quantum_exploration' | '2opt_refinement' | 'converged' | 'dispatch_simulation';
  phaseTitle: string;
  explanation: string;
  visibleNodes: SyntheticNode[];
  visibleEdges: SyntheticEdge[];
  highlightedEdgeIds: string[];
  activeParticles: SwarmParticleState[];
  currentRoutes: string[][];
  bestFitness: number;
  betaContraction: number;
  activeVehicleCount: number;
  vehicleLoads: number[];        // Load (kg) per vehicle at this step (strictly <= capacity)
  vehicleTimeElapsed: number[];  // Time elapsed (minutes) per vehicle
  constraintViolations: number;  // Total time-window violations
  unservedNodes?: SyntheticNode[];
  unservedDemand?: number;
  recommendedAdditionalVehicles?: number;
  stats: {
    distanceKm: number;
    timeMin: number;
    iteration: number;
    capacityUtil: number;        // % average capacity utilization
    twViolations: number;        // Time window violation count
  };
  activeVehicleIndex?: number;
  activeSegment?: { fromId: string; toId: string; vehicleIndex: number };
  visitedNodeIds?: string[];
}

export interface QPSOOptions {
  nodes: SyntheticNode[];
  edges: SyntheticEdge[];
  numVehicles: number;
  vehicleCapacity: number;
  maxWaitMinutesDefault?: number;
  swarmSize?: number;
  iterations?: number;
  trafficMultiplier?: number;
}

export interface DecodedRoutesResult {
  routes: string[][];
  unservedNodes: SyntheticNode[];
  unservedDemand: number;
  recommendedAdditionalVehicles: number;
}

export interface QPSOResult {
  routes: string[][];
  bestFitness: number;
  totalDistanceKm: number;
  totalTimeMin: number;
  capacityUtil: number;
  twViolations: number;
  unservedNodes: SyntheticNode[];
  unservedDemand: number;
  recommendedAdditionalVehicles: number;
  convergenceHistory: { iteration: number; best_fitness: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Exact Bin-Packing (First-Fit-Decreasing) to calculate minimal vehicle count for demands */
export function calculateRequiredVehicles(demands: number[], capacity: number): number {
  if (demands.length === 0 || capacity <= 0) return 0;
  // Break down any oversized demand > capacity into chunks <= capacity
  const chunks: number[] = [];
  for (const d of demands) {
    let rem = d;
    while (rem > 0) {
      const take = Math.min(rem, capacity);
      chunks.push(take);
      rem -= take;
    }
  }
  chunks.sort((a, b) => b - a);
  const bins: number[] = [];
  for (const c of chunks) {
    let placed = false;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] + c <= capacity) {
        bins[i] += c;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push(c);
    }
  }
  return bins.length;
}

/** Computes edge travel distance (km), travel time (min), and congestion. */
export function edgeTravelCost(
  src: string,
  dst: string,
  edges: SyntheticEdge[],
  nodes: SyntheticNode[],
  trafficMult = 1.0
): { dist: number; timeMin: number; congestion: number } {
  if (src === dst) return { dist: 0, timeMin: 0, congestion: 1.0 };
  const edge = edges.find((e) => (e.src === src && e.dst === dst) || (e.src === dst && e.dst === src));
  if (edge) {
    const d = edge.distance ?? edge.weight ?? 1.0;
    const cong = Math.min(edge.congestion * trafficMult, 2.5);
    return { dist: d, timeMin: d * cong * 0.5, congestion: cong };
  }
  const a = nodes.find((n) => n.id === src);
  const b = nodes.find((n) => n.id === dst);
  if (a && b) {
    const d = +(Math.hypot(a.x - b.x, a.y - b.y) * 0.08).toFixed(1);
    return { dist: Math.max(0.5, d), timeMin: Math.max(0.5, d) * trafficMult * 0.5, congestion: trafficMult };
  }
  return { dist: 99, timeMin: 99, congestion: trafficMult };
}

function routeTime(route: string[], nodes: SyntheticNode[], edges: SyntheticEdge[], trafficMult = 1.0): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += edgeTravelCost(route[i], route[i + 1], edges, nodes, trafficMult).timeMin;
  }
  return total;
}

/** 2-Opt Local Search to reverse edge crossings within a vehicle tour. */
export function twoOptRoute(route: string[], nodes: SyntheticNode[], edges: SyntheticEdge[], trafficMult = 1.0): string[] {
  if (route.length <= 3) return [...route];
  let best = [...route];
  let improved = true;
  let iters = 0;
  while (improved && iters < 25) {
    improved = false;
    iters++;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        if (routeTime(candidate, nodes, edges, trafficMult) < routeTime(best, nodes, edges, trafficMult) - 0.001) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Decode continuous position vector to feasible multi-vehicle VRPTW routes strictly respecting vehicle capacity */
export function decodePositionToRoutes(
  position: number[],
  customers: SyntheticNode[],
  depot: SyntheticNode,
  numVehicles: number,
  vehicleCapacity: number,
  edges: SyntheticEdge[],
  nodes: SyntheticNode[],
  trafficMult: number,
  maxWaitDefault: number
): DecodedRoutesResult {
  const ordered = position
    .map((val, idx) => ({ val, cust: customers[idx] }))
    .sort((a, b) => a.val - b.val)
    .map((item) => item.cust);

  const vehicleRoutes: string[][] = Array.from({ length: numVehicles }, () => [depot.id]);
  const vehicleLoads = new Array(numVehicles).fill(0);
  const vehicleTime = new Array(numVehicles).fill(0);
  const unservedNodes: SyntheticNode[] = [];
  let currVeh = 0;

  for (const cust of ordered) {
    const demand = cust.demand || 10;

    // Find a vehicle that can take this entire customer demand without exceeding vehicleCapacity
    let assignedVeh = -1;
    for (let v = currVeh; v < numVehicles; v++) {
      if (vehicleLoads[v] + demand <= vehicleCapacity) {
        assignedVeh = v;
        break;
      }
    }
    if (assignedVeh === -1) {
      for (let v = 0; v < currVeh; v++) {
        if (vehicleLoads[v] + demand <= vehicleCapacity) {
          assignedVeh = v;
          break;
        }
      }
    }

    if (assignedVeh !== -1) {
      // Fits strictly within vehicle `assignedVeh`
      currVeh = assignedVeh;
      const lastStop = vehicleRoutes[currVeh][vehicleRoutes[currVeh].length - 1];
      const cost = edgeTravelCost(lastStop, cust.id, edges, nodes, trafficMult);
      vehicleTime[currVeh] += cost.timeMin + 5;
      vehicleLoads[currVeh] += demand;
      vehicleRoutes[currVeh].push(cust.id);
    } else {
      // STRICT CAPACITY CONSTRAINT: No vehicle has enough remaining capacity.
      // Node is left unvisited/unserved as requested.
      unservedNodes.push(cust);
    }
  }

  // Close all active vehicle sub-tours back to depot
  for (let v = 0; v < numVehicles; v++) {
    if (vehicleRoutes[v].length > 1 && vehicleRoutes[v][vehicleRoutes[v].length - 1] !== depot.id) {
      vehicleRoutes[v].push(depot.id);
    }
  }

  const unservedDemand = unservedNodes.reduce((s, n) => s + (n.demand || 10), 0);
  const unservedDemandsList = unservedNodes.map((n) => n.demand || 10);
  const recommendedAdditionalVehicles = calculateRequiredVehicles(unservedDemandsList, vehicleCapacity);

  return {
    routes: vehicleRoutes,
    unservedNodes,
    unservedDemand,
    recommendedAdditionalVehicles,
  };
}

/** Multi-objective VRPTW Fitness Evaluation. */
export function evaluateRoutes(
  decoded: DecodedRoutesResult,
  nodes: SyntheticNode[],
  edges: SyntheticEdge[],
  depot: SyntheticNode,
  vehicleCapacity: number,
  trafficMult: number,
  maxWaitDefault: number
): {
  fitness: number;
  vehicleLoads: number[];
  vehicleTime: number[];
  twViolations: number;
  totalDist: number;
  totalTime: number;
  unservedNodes: SyntheticNode[];
  unservedDemand: number;
  recommendedAdditionalVehicles: number;
} {
  const { routes, unservedNodes, unservedDemand, recommendedAdditionalVehicles } = decoded;
  let totalDist = 0, totalTime = 0, maxCong = 1.0, penalty = 0, twViolations = 0;
  const vehicleLoads: number[] = [];
  const vehicleTime: number[] = [];

  for (const r of routes) {
    if (r.length <= 1) { vehicleLoads.push(0); vehicleTime.push(0); continue; }
    let load = 0, clockMin = 0;

    for (let i = 0; i < r.length - 1; i++) {
      const { dist, timeMin, congestion } = edgeTravelCost(r[i], r[i + 1], edges, nodes, trafficMult);
      totalDist += dist;
      totalTime += timeMin;
      clockMin += timeMin;
      maxCong = Math.max(maxCong, congestion);

      if (r[i + 1] !== depot.id) {
        const pt = nodes.find((n) => n.id === r[i + 1]);
        load += pt?.demand || 10;
        const maxWait = pt?.maxWaitMinutes ?? maxWaitDefault;
        if (clockMin > maxWait) {
          twViolations++;
          penalty += (clockMin - maxWait) * 30;
        }
        clockMin += 5;
      }
    }

    if (load > vehicleCapacity) {
      penalty += (load - vehicleCapacity) * 500;
    }
    vehicleLoads.push(load);
    vehicleTime.push(clockMin);
  }

  // Strong penalty for unserved demand to encourage maximal valid delivery packing
  penalty += unservedDemand * 50 + unservedNodes.length * 150;

  const fitness = 0.4 * totalDist + 0.4 * totalTime + 0.2 * maxCong * 10 + penalty;
  return {
    fitness,
    vehicleLoads,
    vehicleTime,
    twViolations,
    totalDist,
    totalTime,
    unservedNodes,
    unservedDemand,
    recommendedAdditionalVehicles,
  };
}

// ── Core Hybrid QPSO Optimization Algorithm ──────────────────────────────────

export function runQPSOOptimization(options: QPSOOptions): QPSOResult {
  const {
    nodes, edges, numVehicles, vehicleCapacity,
    maxWaitMinutesDefault = 120,
    iterations = 25,
    swarmSize = 25,
    trafficMultiplier = 1.0,
  } = options;

  const depot = nodes.find((n) => n.isDepot) || nodes[0];
  const customers = nodes.filter((n) => !n.isDepot);
  const D = customers.length;

  if (!depot || D === 0) {
    return {
      routes: [],
      bestFitness: 0,
      totalDistanceKm: 0,
      totalTimeMin: 0,
      capacityUtil: 0,
      twViolations: 0,
      unservedNodes: [],
      unservedDemand: 0,
      recommendedAdditionalVehicles: 0,
      convergenceHistory: [],
    };
  }

  const convergenceHistory: { iteration: number; best_fitness: number }[] = [];

  // 1. Initial Swarm Population
  const actualSwarmSize = Math.max(15, Math.min(swarmSize, D * 5));
  let gBestPos = Array.from({ length: D }, () => Math.random());
  let gBestFitness = Infinity;
  let gBestDecoded: DecodedRoutesResult = {
    routes: [],
    unservedNodes: [],
    unservedDemand: 0,
    recommendedAdditionalVehicles: 0,
  };

  const particles = Array.from({ length: actualSwarmSize }, () => {
    const pos = Array.from({ length: D }, () => Math.random());
    const decoded = decodePositionToRoutes(pos, customers, depot, numVehicles, vehicleCapacity, edges, nodes, trafficMultiplier, maxWaitMinutesDefault);
    const ev = evaluateRoutes(decoded, nodes, edges, depot, vehicleCapacity, trafficMultiplier, maxWaitMinutesDefault);
    return {
      pos,
      pBestPos: [...pos],
      pBestFitness: ev.fitness,
      pBestDecoded: decoded,
    };
  });

  for (const p of particles) {
    if (p.pBestFitness < gBestFitness) {
      gBestFitness = p.pBestFitness;
      gBestPos = [...p.pBestPos];
      gBestDecoded = p.pBestDecoded;
    }
  }

  // 2. Hybrid Quantum Swarm Optimization Loop
  for (let iter = 1; iter <= iterations; iter++) {
    // Linear contraction coefficient decay from 1.5 -> 0.4
    const beta = Math.max(0.4, 1.5 - (iter / iterations) * 1.1);

    // Compute mean best position (mBest) across personal bests
    const mBest = new Array(D).fill(0);
    for (let d = 0; d < D; d++) {
      for (const p of particles) mBest[d] += p.pBestPos[d] / actualSwarmSize;
    }

    // Update each quantum particle
    for (const p of particles) {
      for (let d = 0; d < D; d++) {
        const phi = Math.random();
        // Local attractor p = φ*pBest + (1-φ)*gBest
        const pAttractor = phi * p.pBestPos[d] + (1 - phi) * gBestPos[d];
        const u = Math.random();
        const sign = Math.random() < 0.5 ? 1 : -1;

        // Quantum Delta-Potential Well Equation
        let newX = pAttractor + sign * beta * Math.abs(mBest[d] - p.pos[d]) * Math.log(1 / (u + 1e-9));

        // Stochastic Cauchy quantum tunneling jump (prevents premature coordinate collapse)
        if (Math.random() < 0.12) {
          newX += Math.tan(Math.PI * (Math.random() - 0.5)) * 0.08;
        }

        // Clamping to unit interval
        p.pos[d] = Math.max(0, Math.min(1, newX));
      }

      // Discrete permutation swap
      if (Math.random() < 0.3 && D > 1) {
        const i1 = Math.floor(Math.random() * D);
        const i2 = Math.floor(Math.random() * D);
        const tmp = p.pos[i1];
        p.pos[i1] = p.pos[i2];
        p.pos[i2] = tmp;
      }

      let decoded = decodePositionToRoutes(p.pos, customers, depot, numVehicles, vehicleCapacity, edges, nodes, trafficMultiplier, maxWaitMinutesDefault);

      // In-generation 2-opt refinement on promising particles
      if (iter % 2 === 0 || iter > iterations * 0.7) {
        decoded.routes = decoded.routes.map((tour) => twoOptRoute(tour, nodes, edges, trafficMultiplier));
      }

      const ev = evaluateRoutes(decoded, nodes, edges, depot, vehicleCapacity, trafficMultiplier, maxWaitMinutesDefault);

      if (ev.fitness < p.pBestFitness) {
        p.pBestFitness = ev.fitness;
        p.pBestPos = [...p.pos];
        p.pBestDecoded = decoded;
      }

      if (ev.fitness < gBestFitness) {
        gBestFitness = ev.fitness;
        gBestPos = [...p.pos];
        gBestDecoded = decoded;
      }
    }

    // Apply 2-opt on global best during each iteration to drive fast, smooth convergence
    if (gBestDecoded.routes.length > 0) {
      const refinedRoutes = gBestDecoded.routes.map((tour) => twoOptRoute(tour, nodes, edges, trafficMultiplier));
      const ev = evaluateRoutes({ ...gBestDecoded, routes: refinedRoutes }, nodes, edges, depot, vehicleCapacity, trafficMultiplier, maxWaitMinutesDefault);
      if (ev.fitness < gBestFitness) {
        gBestFitness = ev.fitness;
        gBestDecoded.routes = refinedRoutes;
      }
    }

    convergenceHistory.push({
      iteration: iter,
      best_fitness: +gBestFitness.toFixed(2),
    });
  }

  // Final evaluation of converged global optimum
  if (gBestDecoded.routes.length === 0) {
    gBestDecoded = decodePositionToRoutes(gBestPos, customers, depot, numVehicles, vehicleCapacity, edges, nodes, trafficMultiplier, maxWaitMinutesDefault);
  }
  gBestDecoded.routes = gBestDecoded.routes.map((tour) => twoOptRoute(tour, nodes, edges, trafficMultiplier));
  const finalEv = evaluateRoutes(gBestDecoded, nodes, edges, depot, vehicleCapacity, trafficMultiplier, maxWaitMinutesDefault);
  const activeRoutes = gBestDecoded.routes.filter((r) => r.length > 2);
  const capUtil = finalEv.vehicleLoads.length > 0
    ? Math.round((finalEv.vehicleLoads.reduce((s, l) => s + l, 0) / (Math.max(1, activeRoutes.length) * vehicleCapacity)) * 100)
    : 0;

  return {
    routes: gBestDecoded.routes,
    bestFitness: +finalEv.fitness.toFixed(2),
    totalDistanceKm: +finalEv.totalDist.toFixed(1),
    totalTimeMin: +finalEv.totalTime.toFixed(1),
    capacityUtil: capUtil,
    twViolations: finalEv.twViolations,
    unservedNodes: gBestDecoded.unservedNodes,
    unservedDemand: gBestDecoded.unservedDemand,
    recommendedAdditionalVehicles: gBestDecoded.recommendedAdditionalVehicles,
    convergenceHistory,
  };
}

// ── Step Sequence Generator for Canvas & Visual Simulation ────────────────────

export function generateQPSOStepSequence(options: QPSOOptions): AlgorithmStepSnapshot[] {
  const {
    nodes, edges, numVehicles, vehicleCapacity,
  } = options;

  const depot = nodes.find((n) => n.isDepot) || nodes[0];
  const customers = nodes.filter((n) => !n.isDepot);
  if (!depot || customers.length === 0) return [];

  // Run Hybrid QPSO
  const qpsoResult = runQPSOOptimization(options);
  const finalRoutes = qpsoResult.routes;
  const bestFit = qpsoResult.bestFitness;
  const totalDemand = customers.reduce((s, c) => s + (c.demand || 10), 0);
  const snapshots: AlgorithmStepSnapshot[] = [];
  const unservedNodes = qpsoResult.unservedNodes ?? [];
  const unservedDemand = qpsoResult.unservedDemand ?? 0;
  const recommendedVehicles = qpsoResult.recommendedAdditionalVehicles ?? 0;

  // ── Build Ordered Multi-Vehicle Dispatch Simulation Steps ─────────────────
  interface DispatchLeg {
    vehicleIndex: number;
    fromId: string;
    toId: string;
    fromName: string;
    toName: string;
    legDemand: number;
    cumulativeLoad: number;
    isReturnToDepot: boolean;
    isDepotDeparture: boolean;
  }

  const dispatchLegs: DispatchLeg[] = [];
  const activeRoutes = finalRoutes.filter((r) => r.length > 2);

  activeRoutes.forEach((route, vIdx) => {
    let currentLoad = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const fromId = route[i];
      const toId = route[i + 1];
      const fromNode = nodes.find((n) => n.id === fromId);
      const toNode = nodes.find((n) => n.id === toId);
      const legDemand = toNode && !toNode.isDepot ? (toNode.demand || 10) : 0;
      currentLoad += legDemand;

      dispatchLegs.push({
        vehicleIndex: vIdx,
        fromId,
        toId,
        fromName: fromNode?.label || (fromId === depot.id ? "Depot (D)" : fromId),
        toName: toNode?.label || (toId === depot.id ? "Depot (D)" : toId),
        legDemand,
        cumulativeLoad: currentLoad,
        isReturnToDepot: toId === depot.id,
        isDepotDeparture: fromId === depot.id,
      });
    }
  });

  const totalSimulationSteps = dispatchLegs.length + 1;

  // Step 0: Ready at Central Depot
  const initialExpl = unservedNodes.length > 0
    ? `Fleet stationed at Depot "${depot.label}". Capacity strictly capped at ${vehicleCapacity}kg/veh. Notice: ${unservedNodes.length} node(s) (${unservedDemand}kg) exceed available fleet capacity. Need +${recommendedVehicles} more vehicle(s). Press ▶ Play to begin dispatch.`
    : `All ${activeRoutes.length} vehicle(s) stationed at Central Depot "${depot.label}". Total demand: ${totalDemand}kg. Capacity per vehicle: ${vehicleCapacity}kg. Press ▶ Play to dispatch Vehicle #1.`;

  snapshots.push({
    stepIndex: 0,
    totalSteps: totalSimulationSteps,
    phase: 'dispatch_simulation',
    phaseTitle: `🏢 Central Depot (D) Ready - ${activeRoutes.length} Fleet Vehicle${activeRoutes.length > 1 ? 's' : ''} Stationed`,
    explanation: initialExpl,
    visibleNodes: nodes,
    visibleEdges: edges,
    highlightedEdgeIds: [],
    activeParticles: [],
    currentRoutes: finalRoutes,
    bestFitness: bestFit,
    betaContraction: 0.4,
    activeVehicleCount: activeRoutes.length,
    vehicleLoads: new Array(numVehicles).fill(0),
    vehicleTimeElapsed: new Array(numVehicles).fill(0),
    constraintViolations: qpsoResult.twViolations,
    unservedNodes,
    unservedDemand,
    recommendedAdditionalVehicles: recommendedVehicles,
    stats: {
      distanceKm: qpsoResult.totalDistanceKm,
      timeMin: qpsoResult.totalTimeMin,
      iteration: 0,
      capacityUtil: 0,
      twViolations: qpsoResult.twViolations,
    },
    activeVehicleIndex: 0,
    activeSegment: undefined,
    visitedNodeIds: [],
  });

  // Steps 1..N: Leg-by-Leg Vehicle Movement
  const visitedStops = new Set<string>();
  const liveVehicleLoads = new Array(numVehicles).fill(0);

  dispatchLegs.forEach((leg, idx) => {
    if (leg.toId !== depot.id) {
      visitedStops.add(leg.toId);
    }
    liveVehicleLoads[leg.vehicleIndex] = leg.cumulativeLoad;

    const vNum = leg.vehicleIndex + 1;
    let title = "";
    let expl = "";

    if (leg.isDepotDeparture) {
      title = `🚚 Vehicle #${vNum}: Departed Depot (D) → ${leg.toName} (+${leg.legDemand}kg)`;
      expl = `Vehicle #${vNum} has been dispatched from Central Depot to supply ${leg.toName} with ${leg.legDemand}kg payload.`;
    } else if (leg.isReturnToDepot) {
      title = `🏢 Vehicle #${vNum}: Completed Tour & Returned to Depot (${leg.cumulativeLoad}/${vehicleCapacity}kg)`;
      if (idx < dispatchLegs.length - 1) {
        expl = `Vehicle #${vNum} reached capacity / completed route (${leg.cumulativeLoad}/${vehicleCapacity}kg) and returned to base. Vehicle #${dispatchLegs[idx + 1].vehicleIndex + 1} will now depart from Depot.`;
      } else if (unservedNodes.length > 0) {
        expl = `Vehicle #${vNum} completed its tour (${leg.cumulativeLoad}/${vehicleCapacity}kg) and returned to Depot. ⚠️ ${unservedNodes.length} node(s) (${unservedDemand}kg) left unvisited due to fleet limit. Suggestion: Need +${recommendedVehicles} more vehicle(s).`;
      } else {
        expl = `Vehicle #${vNum} completed its assigned tour (${leg.cumulativeLoad}/${vehicleCapacity}kg) and returned safely to Depot. All customer demands successfully fulfilled!`;
      }
    } else {
      title = `🚚 Vehicle #${vNum}: ${leg.fromName} → ${leg.toName} (+${leg.legDemand}kg, Load: ${leg.cumulativeLoad}kg)`;
      expl = `Vehicle #${vNum} delivers ${leg.legDemand}kg to ${leg.toName}. Current payload: ${leg.cumulativeLoad}/${vehicleCapacity}kg (${Math.round((leg.cumulativeLoad / vehicleCapacity) * 100)}% capacity).`;
    }

    const matchingEdge = edges.find(
      (e) => (e.src === leg.fromId && e.dst === leg.toId) || (e.src === leg.toId && e.dst === leg.fromId)
    );

    const capUtilPct = Math.round(
      (liveVehicleLoads.reduce((s, l) => s + l, 0) / (Math.max(1, activeRoutes.length) * vehicleCapacity)) * 100
    );

    snapshots.push({
      stepIndex: idx + 1,
      totalSteps: totalSimulationSteps,
      phase: idx === dispatchLegs.length - 1 && leg.isReturnToDepot ? 'converged' : 'dispatch_simulation',
      phaseTitle: title,
      explanation: expl,
      visibleNodes: nodes,
      visibleEdges: edges,
      highlightedEdgeIds: matchingEdge ? [matchingEdge.id] : [],
      activeParticles: [],
      currentRoutes: finalRoutes,
      bestFitness: bestFit,
      betaContraction: 0.4,
      activeVehicleCount: activeRoutes.length,
      vehicleLoads: [...liveVehicleLoads],
      vehicleTimeElapsed: new Array(numVehicles).fill(0),
      constraintViolations: qpsoResult.twViolations,
      unservedNodes,
      unservedDemand,
      recommendedAdditionalVehicles: recommendedVehicles,
      stats: {
        distanceKm: qpsoResult.totalDistanceKm,
        timeMin: qpsoResult.totalTimeMin,
        iteration: idx + 1,
        capacityUtil: capUtilPct,
        twViolations: qpsoResult.twViolations,
      },
      activeVehicleIndex: leg.vehicleIndex,
      activeSegment: { fromId: leg.fromId, toId: leg.toId, vehicleIndex: leg.vehicleIndex },
      visitedNodeIds: Array.from(visitedStops),
    });
  });

  return snapshots;
}
