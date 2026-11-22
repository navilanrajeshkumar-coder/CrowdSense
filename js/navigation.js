/**
 * CrowdSense - Smart Navigation Engine
 * Graph-based route planning with Dijkstra's algorithm.
 * Evaluates shortest physical distance vs. least crowded / congestion-penalized paths.
 */

class SmartNavigationEngine {
  constructor(simulationEngine, mapEngine) {
    this.sim = simulationEngine;
    this.map = mapEngine;

    // Navigation Graph Nodes
    this.nodes = {
      main_entrance: { id: 'main_entrance', name: 'Main Grand Entrance', floor: 'G', x: 580, y: 120 },
      kids_zone: { id: 'kids_zone', name: 'Kids Play Arena', floor: 'L1', x: 580, y: 240 },
      central_atrium: { id: 'central_atrium', name: 'Central Grand Atrium', floor: 'G', x: 580, y: 390 },
      fashion_wing: { id: 'fashion_wing', name: 'Fashion Boulevard', floor: 'L1', x: 270, y: 370 },
      electronics_sec: { id: 'electronics_sec', name: 'Electronics & Tech Hub', floor: 'L1', x: 890, y: 370 },
      food_court: { id: 'food_court', name: 'Gourmet Food Court', floor: 'L2', x: 580, y: 640 },
      gaming_zone: { id: 'gaming_zone', name: 'Cyber Arcade & VR', floor: 'L2', x: 270, y: 640 },
      cinema: { id: 'cinema', name: 'Multiplex Cinema & IMAX', floor: 'L2', x: 890, y: 640 },
      restrooms_north: { id: 'restrooms_north', name: 'North Restrooms & Lounge', floor: 'G', x: 270, y: 150 },
      restrooms_south: { id: 'restrooms_south', name: 'South Restrooms & Lounge', floor: 'L2', x: 890, y: 150 },
      parking_area: { id: 'parking_area', name: 'Smart Transit & Parking P1-P2', floor: 'G', x: 120, y: 390 },
      hypermarket: { id: 'hypermarket', name: 'Superstore & Hypermarket', floor: 'G', x: 1040, y: 390 }
    };

    // Graph Adjacency List with physical distances (meters)
    this.edges = [
      { u: 'main_entrance', v: 'kids_zone', distance: 60 },
      { u: 'kids_zone', v: 'central_atrium', distance: 75 },
      { u: 'central_atrium', v: 'fashion_wing', distance: 155 },
      { u: 'central_atrium', v: 'electronics_sec', distance: 155 },
      { u: 'central_atrium', v: 'food_court', distance: 125 },
      { u: 'fashion_wing', v: 'parking_area', distance: 75 },
      { u: 'fashion_wing', v: 'restrooms_north', distance: 110 },
      { u: 'electronics_sec', v: 'hypermarket', distance: 75 },
      { u: 'electronics_sec', v: 'restrooms_south', distance: 110 },
      { u: 'food_court', v: 'gaming_zone', distance: 155 },
      { u: 'food_court', v: 'cinema', distance: 155 },
      { u: 'fashion_wing', v: 'gaming_zone', distance: 135 }, // West Skybridge
      { u: 'electronics_sec', v: 'cinema', distance: 135 }     // East Skybridge
    ];

    this.activeRoute = null;
    this.currentMode = 'least_crowded'; // 'shortest' or 'least_crowded'
  }

  // Build graph with dynamic edge costs based on mode
  getAdjacencyList(mode = 'least_crowded') {
    const adj = {};
    Object.keys(this.nodes).forEach(id => {
      adj[id] = [];
    });

    this.edges.forEach(edge => {
      const { u, v, distance } = edge;
      let cost = distance;

      if (mode === 'least_crowded') {
        const zoneU = this.sim.getZone(u);
        const zoneV = this.sim.getZone(v);
        const occU = zoneU ? zoneU.count / zoneU.capacity : 0.2;
        const occV = zoneV ? zoneV.count / zoneV.capacity : 0.2;
        const maxOcc = Math.max(occU, occV);

        // Exponential penalty for congested nodes (>85% gets massive penalty)
        let penaltyMultiplier = 1;
        if (maxOcc > 0.85) {
          penaltyMultiplier = 12.0; // Severe congestion penalty - detour strongly encouraged
        } else if (maxOcc > 0.70) {
          penaltyMultiplier = 4.5;
        } else if (maxOcc > 0.40) {
          penaltyMultiplier = 1.8;
        }

        cost = distance * penaltyMultiplier;
      }

      adj[u].push({ node: v, distance, cost });
      adj[v].push({ node: u, distance, cost });
    });

    return adj;
  }

  // Dijkstra's Pathfinding Implementation
  findRoute(startId, endId, mode = 'least_crowded') {
    if (!this.nodes[startId] || !this.nodes[endId]) return null;
    if (startId === endId) return null;

    const adj = this.getAdjacencyList(mode);
    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(this.nodes));

    Object.keys(this.nodes).forEach(node => {
      distances[node] = Infinity;
      previous[node] = null;
    });

    distances[startId] = 0;

    while (unvisited.size > 0) {
      // Find unvisited node with lowest tentative distance
      let current = null;
      unvisited.forEach(node => {
        if (current === null || distances[node] < distances[current]) {
          current = node;
        }
      });

      if (current === null || distances[current] === Infinity) break;
      if (current === endId) break;

      unvisited.delete(current);

      adj[current].forEach(neighbor => {
        if (!unvisited.has(neighbor.node)) return;
        const alt = distances[current] + neighbor.cost;
        if (alt < distances[neighbor.node]) {
          distances[neighbor.node] = alt;
          previous[neighbor.node] = current;
        }
      });
    }

    // Reconstruct path
    const path = [];
    let curr = endId;
    while (curr) {
      path.unshift(curr);
      curr = previous[curr];
    }

    if (path[0] !== startId) return null;

    // Calculate path statistics
    let totalPhysicalDistance = 0;
    const waypoints = [];
    const stepDetails = [];
    let congestionSum = 0;
    let maxCongestion = 0;

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const nodeData = this.nodes[nodeId];
      const zoneData = this.sim.getZone(nodeId);
      waypoints.push({ x: nodeData.x, y: nodeData.y, id: nodeId, name: nodeData.name });

      const occRatio = zoneData ? (zoneData.count / zoneData.capacity) : 0.3;
      const occPct = Math.round(occRatio * 100);
      congestionSum += occPct;
      if (occPct > maxCongestion) maxCongestion = occPct;

      if (i > 0) {
        const prevId = path[i - 1];
        const edge = this.edges.find(e => (e.u === prevId && e.v === nodeId) || (e.v === prevId && e.u === nodeId));
        const dist = edge ? edge.distance : 80;
        totalPhysicalDistance += dist;

        const status = zoneData ? this.sim.getZoneDensityStatus(zoneData) : { label: 'Low', color: '#10b981' };

        stepDetails.push({
          step: i,
          from: this.nodes[prevId].name,
          to: nodeData.name,
          distance: dist,
          zoneStatus: status.label,
          statusColor: status.color,
          occupancyPct: occPct
        });
      }
    }

    const avgCongestion = Math.round(congestionSum / path.length);
    const estimatedMinutes = (totalPhysicalDistance / 75).toFixed(1); // ~1.25 m/s walking speed

    return {
      mode,
      startId,
      endId,
      startName: this.nodes[startId].name,
      endName: this.nodes[endId].name,
      path,
      waypoints,
      totalDistance: totalPhysicalDistance,
      estimatedMinutes,
      avgCongestion,
      maxCongestion,
      stepDetails
    };
  }

  // Calculate and compare both routes side by side
  calculateComparison(startId, endId) {
    const shortestRoute = this.findRoute(startId, endId, 'shortest');
    const leastCrowdedRoute = this.findRoute(startId, endId, 'least_crowded');

    return {
      shortest: shortestRoute,
      leastCrowded: leastCrowdedRoute,
      isIdentical: JSON.stringify(shortestRoute?.path) === JSON.stringify(leastCrowdedRoute?.path)
    };
  }

  // Set and render the route on the map
  navigate(startId, endId, mode = 'least_crowded') {
    this.currentMode = mode;
    const comparison = this.calculateComparison(startId, endId);
    const route = mode === 'least_crowded' ? comparison.leastCrowded : comparison.shortest;
    this.activeRoute = route;

    if (route && this.map) {
      this.map.drawRoute(route.waypoints, mode === 'least_crowded');
    }

    return {
      activeRoute: route,
      comparison
    };
  }

  clearRoute() {
    this.activeRoute = null;
    if (this.map) {
      this.map.clearRoute();
    }
  }
}

// Export class
window.SmartNavigationEngine = SmartNavigationEngine;
