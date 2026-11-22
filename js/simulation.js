/**
 * CrowdSense - Simulation Engine
 * Manages zone states, capacities, realistic stochastic pedestrian flow,
 * scenario presets, and manual density testing.
 */

class CrowdSimulationEngine {
  constructor() {
    this.isRunning = true;
    this.speed = 1; // 1x, 2x, 5x
    this.intervalId = null;
    this.tickIntervalMs = 2500;
    this.tickCount = 0;
    this.currentScenario = 'normal';
    this.listeners = [];
    this.alertListeners = [];
    this.previousMallTotal = 0;

    // Dual-Camera AI Integration Properties
    this.operatingMode = 'simulation'; // 'simulation' or 'camera'
    this.cameraMonitoredZoneId = 'main_entrance'; // Target zone driven by live camera
    this.cameraEntries = 0;
    this.cameraExits = 0;
    this.cameraNetOccupancy = 0;
    this.cameraActive = false;

    // Define All Mall Zones with architectural, operational & topological data
    this.zones = {
      main_entrance: {
        id: 'main_entrance',
        name: 'Main Grand Entrance',
        floor: 'G',
        category: 'Transit',
        capacity: 450,
        count: 140,
        peakToday: 380,
        history: [120, 125, 130, 138, 140],
        trend: 'neutral',
        alternatives: ['parking_area', 'central_atrium'],
        nodeId: 'node_entrance',
        coords: { x: 580, y: 120 }
      },
      central_atrium: {
        id: 'central_atrium',
        name: 'Central Grand Atrium',
        floor: 'G',
        category: 'Plaza',
        capacity: 650,
        count: 220,
        peakToday: 510,
        history: [190, 205, 215, 218, 220],
        trend: 'up',
        alternatives: ['fashion_wing', 'food_court'],
        nodeId: 'node_atrium',
        coords: { x: 580, y: 390 }
      },
      fashion_wing: {
        id: 'fashion_wing',
        name: 'Fashion Boulevard',
        floor: 'L1',
        category: 'Retail',
        capacity: 420,
        count: 185,
        peakToday: 340,
        history: [160, 170, 175, 180, 185],
        trend: 'up',
        alternatives: ['electronics_sec', 'hypermarket'],
        nodeId: 'node_fashion',
        coords: { x: 270, y: 370 }
      },
      electronics_sec: {
        id: 'electronics_sec',
        name: 'Electronics & Tech Hub',
        floor: 'L1',
        category: 'Retail',
        capacity: 320,
        count: 98,
        peakToday: 260,
        history: [110, 105, 102, 100, 98],
        trend: 'down',
        alternatives: ['fashion_wing', 'gaming_zone'],
        nodeId: 'node_electronics',
        coords: { x: 890, y: 370 }
      },
      food_court: {
        id: 'food_court',
        name: 'Gourmet Food Court',
        floor: 'L2',
        category: 'Dining',
        capacity: 520,
        count: 360,
        peakToday: 490,
        history: [290, 310, 335, 350, 360],
        trend: 'up',
        alternatives: ['central_atrium', 'gaming_zone'],
        nodeId: 'node_food_court',
        coords: { x: 580, y: 640 }
      },
      cinema: {
        id: 'cinema',
        name: 'Multiplex Cinema & IMAX',
        floor: 'L2',
        category: 'Entertainment',
        capacity: 550,
        count: 160,
        peakToday: 480,
        history: [180, 175, 168, 165, 160],
        trend: 'neutral',
        alternatives: ['gaming_zone', 'food_court'],
        nodeId: 'node_cinema',
        coords: { x: 890, y: 640 }
      },
      gaming_zone: {
        id: 'gaming_zone',
        name: 'Cyber Arcade & VR Zone',
        floor: 'L2',
        category: 'Entertainment',
        capacity: 260,
        count: 110,
        peakToday: 220,
        history: [90, 95, 100, 105, 110],
        trend: 'up',
        alternatives: ['cinema', 'food_court'],
        nodeId: 'node_gaming',
        coords: { x: 270, y: 640 }
      },
      restrooms_north: {
        id: 'restrooms_north',
        name: 'North Restrooms & Lounge',
        floor: 'G',
        category: 'Amenities',
        capacity: 85,
        count: 24,
        peakToday: 70,
        history: [20, 22, 23, 24, 24],
        trend: 'neutral',
        alternatives: ['restrooms_south'],
        nodeId: 'node_restrooms_north',
        coords: { x: 270, y: 150 }
      },
      restrooms_south: {
        id: 'restrooms_south',
        name: 'South Restrooms & Lounge',
        floor: 'L2',
        category: 'Amenities',
        capacity: 85,
        count: 38,
        peakToday: 72,
        history: [30, 32, 35, 36, 38],
        trend: 'up',
        alternatives: ['restrooms_north'],
        nodeId: 'node_restrooms_south',
        coords: { x: 890, y: 150 }
      },
      parking_area: {
        id: 'parking_area',
        name: 'Smart Transit & Parking P1-P2',
        floor: 'G',
        category: 'Transit',
        capacity: 750,
        count: 310,
        peakToday: 620,
        history: [290, 295, 300, 305, 310],
        trend: 'neutral',
        alternatives: ['main_entrance'],
        nodeId: 'node_parking',
        coords: { x: 120, y: 390 }
      },
      hypermarket: {
        id: 'hypermarket',
        name: 'Superstore & Hypermarket',
        floor: 'G',
        category: 'Retail',
        capacity: 380,
        count: 135,
        peakToday: 300,
        history: [145, 140, 138, 136, 135],
        trend: 'down',
        alternatives: ['fashion_wing'],
        nodeId: 'node_hypermarket',
        coords: { x: 1040, y: 390 }
      },
      kids_zone: {
        id: 'kids_zone',
        name: 'Kids Play Arena & Creche',
        floor: 'L1',
        category: 'Entertainment',
        capacity: 190,
        count: 65,
        peakToday: 150,
        history: [55, 58, 60, 62, 65],
        trend: 'up',
        alternatives: ['gaming_zone'],
        nodeId: 'node_kids',
        coords: { x: 580, y: 240 }
      }
    };

    // Keep history initialized
    this.initHistory();
  }

  initHistory() {
    Object.values(this.zones).forEach(z => {
      const currentPct = Math.round((z.count / z.capacity) * 100);
      const hist = [];
      for (let i = 15; i >= 1; i--) {
        const jitter = (Math.random() - 0.5) * 8;
        hist.push(Math.max(5, Math.min(98, Math.round(currentPct + jitter))));
      }
      hist.push(currentPct);
      z.history = hist;
    });
  }

  // Subscribe UI components to simulation updates
  subscribe(callback) {
    this.listeners.push(callback);
  }

  // Subscribe to generated alerts
  onAlert(callback) {
    this.alertListeners.push(callback);
  }

  emitAlert(alert) {
    this.alertListeners.forEach(cb => cb(alert));
  }

  start() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = true;
    const interval = Math.max(500, Math.round(this.tickIntervalMs / this.speed));
    this.intervalId = setInterval(() => this.tick(), interval);
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume() {
    if (!this.isRunning) {
      this.start();
    }
  }

  togglePlay() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.resume();
    }
    return this.isRunning;
  }

  setSpeed(newSpeed) {
    this.speed = Number(newSpeed) || 1;
    if (this.isRunning) {
      this.start();
    }
  }

  setScenario(scenarioKey) {
    this.currentScenario = scenarioKey;
    this.applyScenarioPresets(scenarioKey);
    this.notifySubscribers();
  }

  applyScenarioPresets(scenario) {
    switch (scenario) {
      case 'lunch_rush':
        this.zones.food_court.count = Math.round(this.zones.food_court.capacity * 0.92); // Critical
        this.zones.central_atrium.count = Math.round(this.zones.central_atrium.capacity * 0.78);
        this.zones.restrooms_south.count = Math.round(this.zones.restrooms_south.capacity * 0.82);
        this.zones.fashion_wing.count = Math.round(this.zones.fashion_wing.capacity * 0.45);
        this.emitAlert({
          type: 'critical',
          title: 'Peak Rush Alert',
          zoneId: 'food_court',
          message: 'Gourmet Food Court has exceeded 90% capacity during lunch rush. Flow control active.',
          timestamp: new Date().toLocaleTimeString()
        });
        break;

      case 'flash_sale':
        this.zones.fashion_wing.count = Math.round(this.zones.fashion_wing.capacity * 0.94); // Critical
        this.zones.electronics_sec.count = Math.round(this.zones.electronics_sec.capacity * 0.88); // Critical
        this.zones.main_entrance.count = Math.round(this.zones.main_entrance.capacity * 0.76);
        this.emitAlert({
          type: 'critical',
          title: 'Promotional Flash Surge',
          zoneId: 'fashion_wing',
          message: 'Fashion Boulevard experiencing severe congestion due to promotional sale. Diverting foot traffic.',
          timestamp: new Date().toLocaleTimeString()
        });
        break;

      case 'cinema_outpour':
        this.zones.cinema.count = Math.round(this.zones.cinema.capacity * 0.25);
        this.zones.restrooms_south.count = Math.round(this.zones.restrooms_south.capacity * 0.88); // Spike
        this.zones.food_court.count = Math.round(this.zones.food_court.capacity * 0.82);
        this.zones.gaming_zone.count = Math.round(this.zones.gaming_zone.capacity * 0.72);
        this.emitAlert({
          type: 'warning',
          title: 'Post-Screening Outflow',
          zoneId: 'restrooms_south',
          message: 'Screening concluded in Multiplex Cinema. Heavy foot traffic discharging into South corridors and Restrooms.',
          timestamp: new Date().toLocaleTimeString()
        });
        break;

      case 'morning_quiet':
        Object.values(this.zones).forEach(z => {
          z.count = Math.max(10, Math.round(z.capacity * (0.15 + Math.random() * 0.15)));
        });
        this.emitAlert({
          type: 'info',
          title: 'Low Foot-Traffic Window',
          zoneId: 'central_atrium',
          message: 'Mall operations currently at optimal comfort level. All zones green and free flowing.',
          timestamp: new Date().toLocaleTimeString()
        });
        break;

      case 'evacuation':
        Object.values(this.zones).forEach(z => {
          if (z.id === 'main_entrance' || z.id === 'parking_area') {
            z.count = Math.round(z.capacity * 0.85);
          } else {
            z.count = Math.max(5, Math.round(z.count * 0.35));
          }
        });
        this.emitAlert({
          type: 'critical',
          title: 'EMERGENCY EVACUATION SIMULATION',
          zoneId: 'all',
          message: 'Emergency exits unlatched. Directing all visitors to nearest designated exit routes.',
          timestamp: new Date().toLocaleTimeString()
        });
        break;

      case 'normal':
      default:
        // Balanced realistic distribution
        this.zones.food_court.count = 340;
        this.zones.central_atrium.count = 240;
        this.zones.fashion_wing.count = 190;
        this.zones.electronics_sec.count = 110;
        this.zones.cinema.count = 175;
        this.zones.gaming_zone.count = 115;
        this.zones.main_entrance.count = 150;
        this.zones.parking_area.count = 320;
        this.zones.hypermarket.count = 140;
        this.zones.kids_zone.count = 70;
        break;
    }
  }

  // Allow manual crowd density slider adjustment for immediate testing
  manualOverrideZone(zoneId, newCount) {
    const zone = this.zones[zoneId];
    if (!zone) return;

    const count = Math.max(0, Math.min(zone.capacity, Number(newCount)));
    const prevStatus = this.getZoneDensityStatus(zone);
    zone.count = count;
    const newStatus = this.getZoneDensityStatus(zone);

    // Update history
    const pct = Math.round((zone.count / zone.capacity) * 100);
    zone.history.push(pct);
    if (zone.history.length > 20) zone.history.shift();

    if (zone.count > zone.peakToday) {
      zone.peakToday = zone.count;
    }

    // Trigger alerts if status elevated
    if (newStatus.level === 'critical' && prevStatus.level !== 'critical') {
      this.emitAlert({
        type: 'critical',
        title: 'Manual Test: Critical Congestion',
        zoneId: zone.id,
        message: `${zone.name} reached ${pct}% occupancy (${zone.count}/${zone.capacity}). Alternate routing advised.`,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    this.notifySubscribers();
  }

  // Main stochastic tick
  tick() {
    this.tickCount++;

    Object.values(this.zones).forEach(zone => {
      // In Live Camera Mode, the monitored zone is driven strictly by camera entries/exits
      if (this.operatingMode === 'camera' && zone.id === this.cameraMonitoredZoneId) {
        return;
      }

      const prevCount = zone.count;
      const prevPct = Math.round((prevCount / zone.capacity) * 100);
      const prevStatus = this.getZoneDensityStatus(zone);

      // Stochastic delta depending on current scenario
      let delta = (Math.random() - 0.48) * (zone.capacity * 0.035);

      if (this.currentScenario === 'lunch_rush' && zone.id === 'food_court') {
        delta += Math.random() * 8;
      } else if (this.currentScenario === 'flash_sale' && (zone.id === 'fashion_wing' || zone.id === 'electronics_sec')) {
        delta += Math.random() * 7;
      } else if (this.currentScenario === 'morning_quiet') {
        delta -= Math.random() * 4;
      }

      let newCount = Math.round(zone.count + delta);
      // Hard clamp between 0 and zone capacity
      newCount = Math.max(0, Math.min(zone.capacity, newCount));
      zone.count = newCount;

      if (zone.count > zone.peakToday) {
        zone.peakToday = zone.count;
      }

      // Trend determination
      if (newCount > prevCount + 2) zone.trend = 'up';
      else if (newCount < prevCount - 2) zone.trend = 'down';
      else zone.trend = 'neutral';

      // Update rolling history buffer
      const newPct = Math.round((newCount / zone.capacity) * 100);
      zone.history.push(newPct);
      if (zone.history.length > 20) zone.history.shift();

      const newStatus = this.getZoneDensityStatus(zone);

      // Alert conditions
      if (newStatus.level === 'critical' && prevStatus.level !== 'critical') {
        this.emitAlert({
          type: 'critical',
          title: 'Critical Congestion Warning',
          zoneId: zone.id,
          message: `${zone.name} has crossed into critical congestion (${newPct}% occupancy).`,
          timestamp: new Date().toLocaleTimeString()
        });
      } else if (newStatus.level === 'high' && (prevStatus.level === 'moderate' || prevStatus.level === 'low')) {
        this.emitAlert({
          type: 'warning',
          title: 'High Crowd Density Alert',
          zoneId: zone.id,
          message: `${zone.name} is experiencing elevated footfall (${newPct}% occupancy).`,
          timestamp: new Date().toLocaleTimeString()
        });
      } else if (prevStatus.level === 'critical' && (newStatus.level === 'moderate' || newStatus.level === 'low')) {
        this.emitAlert({
          type: 'success',
          title: 'Congestion Resolved',
          zoneId: zone.id,
          message: `${zone.name} crowd has thinned to ${newPct}%. Conditions are now comfortable.`,
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // Sudden surge alert (>15% jump in 2 ticks)
      if (zone.history.length >= 3) {
        const twoTicksAgo = zone.history[zone.history.length - 3];
        if (newPct - twoTicksAgo >= 14) {
          this.emitAlert({
            type: 'warning',
            title: 'Rapid Crowd Surge',
            zoneId: zone.id,
            message: `Accelerated influx detected in ${zone.name} (+${newPct - twoTicksAgo}% in 30s).`,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }
    });

    this.notifySubscribers();
  }

  getZoneDensityStatus(zone) {
    const ratio = zone.count / zone.capacity;
    const pct = Math.round(ratio * 100);

    if (pct < 40) {
      return { level: 'low', label: 'Low Density', color: '#10b981', glow: 'rgba(16, 185, 129, 0.3)', badgeClass: 'low' };
    } else if (pct < 70) {
      return { level: 'moderate', label: 'Moderate', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)', badgeClass: 'moderate' };
    } else if (pct < 85) {
      return { level: 'high', label: 'High Density', color: '#f97316', glow: 'rgba(249, 115, 22, 0.3)', badgeClass: 'high' };
    } else {
      return { level: 'critical', label: 'Critical Congestion', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)', badgeClass: 'critical' };
    }
  }

  getSummaryMetrics() {
    let totalPeople = 0;
    let totalCapacity = 0;
    let crowdedCount = 0; // high + critical
    let safeCount = 0;    // low
    let moderateCount = 0;

    Object.values(this.zones).forEach(z => {
      totalPeople += z.count;
      totalCapacity += z.capacity;
      const status = this.getZoneDensityStatus(z);
      if (status.level === 'critical' || status.level === 'high') crowdedCount++;
      else if (status.level === 'low') safeCount++;
      else moderateCount++;
    });

    const overallOccupancy = Math.round((totalPeople / totalCapacity) * 100);
    const netVelocity = (this.previousMallTotal === 0) ? 4 : (totalPeople - this.previousMallTotal);
    this.previousMallTotal = totalPeople;

    return {
      totalPeople,
      totalCapacity,
      overallOccupancy,
      crowdedCount,
      safeCount,
      moderateCount,
      netVelocity,
      totalZones: Object.keys(this.zones).length,
      // Camera specific summary
      operatingMode: this.operatingMode,
      cameraMonitoredZoneId: this.cameraMonitoredZoneId,
      cameraEntries: this.cameraEntries,
      cameraExits: this.cameraExits,
      cameraNetOccupancy: this.cameraNetOccupancy
    };
  }

  // Set Operating Mode (Simulation vs Live Camera)
  setOperatingMode(mode) {
    if (mode !== 'simulation' && mode !== 'camera') return;
    this.operatingMode = mode;
    
    // When switching to camera mode, initialize camera net occupancy to current zone count if camera is starting fresh
    const targetZone = this.zones[this.cameraMonitoredZoneId];
    if (mode === 'camera' && targetZone) {
      if (this.cameraEntries === 0 && this.cameraExits === 0) {
        // Base line established
        this.cameraEntries = targetZone.count;
        this.cameraExits = 0;
        this.cameraNetOccupancy = targetZone.count;
      }
    }

    this.notifySubscribers();
  }

  // Set which mall zone the dual cameras are deployed at
  setCameraMonitoredZone(zoneId) {
    if (this.zones[zoneId]) {
      this.cameraMonitoredZoneId = zoneId;
      const targetZone = this.zones[zoneId];
      if (this.operatingMode === 'camera' && targetZone) {
        this.cameraEntries = targetZone.count;
        this.cameraExits = 0;
        this.cameraNetOccupancy = targetZone.count;
      }
      this.notifySubscribers();
    }
  }

  // Register real-time people detection from AI camera counter
  registerCameraDetection(type, countDelta = 1) {
    const targetZone = this.zones[this.cameraMonitoredZoneId];
    if (!targetZone) return;

    const prevCount = targetZone.count;
    const prevStatus = this.getZoneDensityStatus(targetZone);

    if (type === 'entry') {
      this.cameraEntries += countDelta;
      this.cameraNetOccupancy = Math.max(0, this.cameraEntries - this.cameraExits);
      
      // Update zone headcount (clamped to capacity)
      targetZone.count = Math.min(targetZone.capacity, targetZone.count + countDelta);
      if (targetZone.count > targetZone.peakToday) {
        targetZone.peakToday = targetZone.count;
      }
      targetZone.trend = 'up';
    } else if (type === 'exit') {
      this.cameraExits += countDelta;
      this.cameraNetOccupancy = Math.max(0, this.cameraEntries - this.cameraExits);
      
      // Update zone headcount (clamped to 0)
      targetZone.count = Math.max(0, targetZone.count - countDelta);
      targetZone.trend = 'down';
    }

    // Update rolling history buffer
    const newPct = Math.round((targetZone.count / targetZone.capacity) * 100);
    targetZone.history.push(newPct);
    if (targetZone.history.length > 20) targetZone.history.shift();

    const newStatus = this.getZoneDensityStatus(targetZone);

    // Proactive Congestion Alerts for camera events
    if (newStatus.level === 'critical' && prevStatus.level !== 'critical') {
      this.emitAlert({
        type: 'critical',
        title: 'AI Camera Alert: Critical Congestion',
        zoneId: targetZone.id,
        message: `High influx detected by Entry Camera at ${targetZone.name}. Zone has reached ${newPct}% occupancy (${targetZone.count}/${targetZone.capacity}).`,
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (newStatus.level === 'high' && (prevStatus.level === 'moderate' || prevStatus.level === 'low')) {
      this.emitAlert({
        type: 'warning',
        title: 'AI Camera Alert: High Inflow Surge',
        zoneId: targetZone.id,
        message: `Footfall crossing line at ${targetZone.name} has elevated occupancy to ${newPct}%.`,
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (prevStatus.level === 'critical' && (newStatus.level === 'moderate' || newStatus.level === 'low')) {
      this.emitAlert({
        type: 'success',
        title: 'Congestion Relieved',
        zoneId: targetZone.id,
        message: `Exit Camera outflow at ${targetZone.name} has reduced crowd density to ${newPct}%.`,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    // Instantly notify all subscribers (UI ribbons, SVG map, charts, inspector)
    this.notifySubscribers();
  }

  // Reset live camera counts
  resetCameraCounts() {
    this.cameraEntries = 0;
    this.cameraExits = 0;
    this.cameraNetOccupancy = 0;
    const targetZone = this.zones[this.cameraMonitoredZoneId];
    if (targetZone && this.operatingMode === 'camera') {
      targetZone.count = 0;
      targetZone.history.push(0);
      if (targetZone.history.length > 20) targetZone.history.shift();
    }
    this.notifySubscribers();
  }

  getZone(id) {
    return this.zones[id];
  }

  getAllZones() {
    return Object.values(this.zones);
  }

  notifySubscribers() {
    const summary = this.getSummaryMetrics();
    this.listeners.forEach(cb => cb(this.zones, summary));
  }
}

// Export singleton instance
window.crowdSim = new CrowdSimulationEngine();
