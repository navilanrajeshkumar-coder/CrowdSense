/**
 * CrowdSense - Main Application Controller
 * Coordinates map rendering, simulation lifecycle, navigation graph,
 * analytics dashboard, inspector panel, and user interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Engines
  const sim = window.crowdSim;
  const map = new window.InteractiveMallMap('mapViewportContainer', sim);
  window.mallMap = map;

  const nav = new window.SmartNavigationEngine(sim, map);
  window.mallNav = nav;

  const alerts = new window.AlertNotificationManager();
  window.mallAlerts = alerts;

  const analytics = new window.CrowdAnalyticsEngine(sim);
  window.mallAnalytics = analytics;

  // Initialize Dual-Camera AI People Counter Engine
  const cameraMonitor = new window.AICameraMonitor(sim);
  window.mallCamera = cameraMonitor;

  // 2. DOM Elements
  const totalPeopleEl = document.getElementById('metricTotalPeople');
  const occupancyPctEl = document.getElementById('metricOccupancyPct');
  const occupancyGaugeEl = document.getElementById('occupancyGaugeCircle');
  const crowdedZonesEl = document.getElementById('metricCrowdedZones');
  const safeZonesEl = document.getElementById('metricSafeZones');
  const velocityEl = document.getElementById('metricVelocity');
  const clockEl = document.getElementById('liveClock');

  // Simulation Controls
  const simPlayBtn = document.getElementById('simPlayBtn');
  const simSpeedSelect = document.getElementById('simSpeedSelect');
  const simScenarioSelect = document.getElementById('simScenarioSelect');
  const simStepBtn = document.getElementById('simStepBtn');
  const simResetBtn = document.getElementById('simResetBtn');

  // Search & Filters
  const searchInput = document.getElementById('zoneSearchInput');
  const searchResultsDropdown = document.getElementById('searchResultsDropdown');
  const floorLevelBtns = document.querySelectorAll('.level-btn');
  const densityFilterChips = document.querySelectorAll('.filter-chip');

  // Inspector Panel Elements
  const inspectorEmpty = document.getElementById('inspectorEmptyState');
  const inspectorDetails = document.getElementById('inspectorDetailsContent');
  const inspectorName = document.getElementById('inspectorZoneName');
  const inspectorCategory = document.getElementById('inspectorZoneCategory');
  const inspectorStatusBadge = document.getElementById('inspectorStatusBadge');
  const inspectorCount = document.getElementById('inspectorCount');
  const inspectorCapacity = document.getElementById('inspectorCapacity');
  const inspectorOccupancyPct = document.getElementById('inspectorOccupancyPct');
  const inspectorMeterFill = document.getElementById('inspectorMeterFill');
  const inspectorPeak = document.getElementById('inspectorPeak');
  const inspectorSparkline = document.getElementById('inspectorSparklineSvg');
  const inspectorSlider = document.getElementById('inspectorCrowdSlider');
  const inspectorSliderVal = document.getElementById('inspectorSliderVal');
  const inspectorRecsList = document.getElementById('inspectorRecsList');
  const inspectorNavigateBtn = document.getElementById('inspectorNavigateBtn');

  // Navigation Panel Elements
  const navStartSelect = document.getElementById('navStartSelect');
  const navEndSelect = document.getElementById('navEndSelect');
  const navShortestBtn = document.getElementById('navShortestBtn');
  const navLeastCrowdedBtn = document.getElementById('navLeastCrowdedBtn');
  const navCalculateBtn = document.getElementById('navCalculateBtn');
  const navClearBtn = document.getElementById('navClearBtn');
  const navResultsCard = document.getElementById('navResultsCard');
  const navRouteDist = document.getElementById('navRouteDist');
  const navRouteTime = document.getElementById('navRouteTime');
  const navRouteCongestion = document.getElementById('navRouteCongestion');
  const navComparisonBanner = document.getElementById('navComparisonBanner');
  const navStepsList = document.getElementById('navStepsList');

  // Modals & Drawers
  const notificationsDrawer = document.getElementById('notificationsDrawer');
  const notificationsToggleBtn = document.getElementById('notificationsToggleBtn');
  const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
  const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');

  const analyticsModal = document.getElementById('analyticsModal');
  const analyticsToggleBtn = document.getElementById('analyticsToggleBtn');
  const closeAnalyticsModalBtn = document.getElementById('closeAnalyticsModalBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  let activeNavigationMode = 'least_crowded';
  let currentSelectedZoneId = null;

  // 3. Live Clock Update
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // 4. Update Summary Metrics Ribbon
  function updateSummaryUI(summary) {
    totalPeopleEl.textContent = summary.totalPeople.toLocaleString();
    occupancyPctEl.textContent = `${summary.overallOccupancy}%`;

    // Circular gauge animation (stroke-dasharray="pct, 100")
    if (occupancyGaugeEl) {
      occupancyGaugeEl.setAttribute('stroke-dasharray', `${summary.overallOccupancy}, 100`);
      let strokeColor = '#10b981';
      if (summary.overallOccupancy > 85) strokeColor = '#ef4444';
      else if (summary.overallOccupancy > 70) strokeColor = '#f97316';
      else if (summary.overallOccupancy > 40) strokeColor = '#f59e0b';
      occupancyGaugeEl.setAttribute('stroke', strokeColor);
    }

    crowdedZonesEl.textContent = `${summary.crowdedCount} / ${summary.totalZones}`;
    safeZonesEl.textContent = `${summary.safeCount} / ${summary.totalZones}`;

    // Velocity trend
    const vel = summary.netVelocity;
    const sign = vel >= 0 ? '+' : '';
    velocityEl.textContent = `${sign}${vel} /min`;
    const velCard = document.getElementById('metricVelocityCard');
    if (velCard) {
      if (vel > 5) {
        velCard.className = 'metric-card warning';
      } else {
        velCard.className = 'metric-card safe';
      }
    }
  }

  // 5. Populate Navigation Select Dropdowns
  function populateNavDropdowns() {
    const zones = sim.getAllZones();
    const optionsHtml = zones.map(z => `<option value="${z.id}">${z.name} (Floor ${z.floor})</option>`).join('');

    navStartSelect.innerHTML = `<option value="">-- Choose Starting Point --</option>` + optionsHtml;
    navEndSelect.innerHTML = `<option value="">-- Choose Destination --</option>` + optionsHtml;

    // Set smart defaults
    navStartSelect.value = 'main_entrance';
    navEndSelect.value = 'food_court';
  }
  populateNavDropdowns();

  // 6. Zone Selection & Inspector Panel Handler
  function displayZoneInInspector(zone) {
    if (!zone) {
      inspectorEmpty.style.display = 'block';
      inspectorDetails.style.display = 'none';
      return;
    }

    currentSelectedZoneId = zone.id;
    inspectorEmpty.style.display = 'none';
    inspectorDetails.style.display = 'flex';

    inspectorName.textContent = zone.name;
    inspectorCategory.innerHTML = `<i class="fa-solid fa-layer-group"></i> Floor ${zone.floor} • ${zone.category}`;

    const status = sim.getZoneDensityStatus(zone);
    const pct = Math.round((zone.count / zone.capacity) * 100);

    inspectorStatusBadge.textContent = status.label;
    inspectorStatusBadge.className = `status-badge ${status.badgeClass}`;

    inspectorCount.textContent = zone.count.toLocaleString();
    inspectorCapacity.textContent = zone.capacity.toLocaleString();
    inspectorOccupancyPct.textContent = `${pct}%`;
    inspectorOccupancyPct.style.color = status.color;

    inspectorMeterFill.style.width = `${pct}%`;
    inspectorMeterFill.style.backgroundColor = status.color;

    inspectorPeak.textContent = zone.peakToday.toLocaleString();

    // Setup manual slider
    inspectorSlider.max = zone.capacity;
    inspectorSlider.value = zone.count;
    inspectorSliderVal.textContent = `${zone.count} (${pct}%)`;

    // Render Sparkline SVG
    renderSparkline(zone.history, status.color);

    // Render Smart Recommendations / Alternatives
    renderRecommendations(zone);
  }

  function renderSparkline(history, color) {
    if (!history || history.length === 0 || !inspectorSparkline) return;

    const width = 280;
    const height = 48;
    const maxVal = 100;
    const minVal = 0;
    const stepX = width / (history.length - 1);

    let pathD = '';
    let areaD = `M 0 ${height}`;

    history.forEach((val, i) => {
      const x = i * stepX;
      const y = height - (val / (maxVal - minVal)) * (height - 8) - 4;
      if (i === 0) {
        pathD += `M ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
      }
    });

    areaD += ` L ${width} ${height} Z`;

    inspectorSparkline.innerHTML = `
      <defs>
        <linearGradient id="sparklineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#sparklineGrad)"/>
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="${width}" cy="${height - (history[history.length - 1] / 100) * (height - 8) - 4}" r="3.5" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
    `;
  }

  function renderRecommendations(zone) {
    if (!inspectorRecsList) return;

    if (!zone.alternatives || zone.alternatives.length === 0) {
      inspectorRecsList.innerHTML = `<p style="font-size:0.75rem;color:var(--text-dim);">No direct alternatives available.</p>`;
      return;
    }

    const recsHtml = zone.alternatives.map(altId => {
      const altZone = sim.getZone(altId);
      if (!altZone) return '';
      const altPct = Math.round((altZone.count / altZone.capacity) * 100);
      const altStatus = sim.getZoneDensityStatus(altZone);

      return `
        <div class="recommendation-item" data-zone="${altZone.id}">
          <div>
            <div class="rec-zone-name">${altZone.name}</div>
            <div style="font-size:0.7rem;color:var(--text-dim);">Floor ${altZone.floor} • ${altZone.category}</div>
          </div>
          <div style="text-align:right;">
            <span class="status-badge ${altStatus.badgeClass}" style="font-size:0.68rem;padding:2px 6px;">
              ${altPct}% full
            </span>
          </div>
        </div>
      `;
    }).join('');

    inspectorRecsList.innerHTML = recsHtml;

    inspectorRecsList.querySelectorAll('.recommendation-item').forEach(item => {
      item.addEventListener('click', () => {
        const altId = item.getAttribute('data-zone');
        map.selectZone(altId);
      });
    });
  }

  // Connect Map Zone Selection to Inspector
  map.onZoneSelect(zone => {
    displayZoneInInspector(zone);
    // Switch to Details tab if needed
    switchSidebarTab('zoneDetails');
  });

  // Manual Crowd Slider Event (Real-time testing)
  inspectorSlider.addEventListener('input', (e) => {
    if (!currentSelectedZoneId) return;
    const newCount = parseInt(e.target.value, 10);
    sim.manualOverrideZone(currentSelectedZoneId, newCount);

    const zone = sim.getZone(currentSelectedZoneId);
    const pct = Math.round((zone.count / zone.capacity) * 100);
    inspectorSliderVal.textContent = `${zone.count} (${pct}%)`;

    // Update inspector view immediately
    displayZoneInInspector(zone);
  });

  // Navigate here from inspector button
  inspectorNavigateBtn.addEventListener('click', () => {
    if (!currentSelectedZoneId) return;
    navEndSelect.value = currentSelectedZoneId;
    switchSidebarTab('navigationPlanner');
    calculateAndRenderRoute();
  });

  // 7. Smart Navigation Calculations & UI
  function calculateAndRenderRoute() {
    const start = navStartSelect.value;
    const end = navEndSelect.value;

    if (!start || !end) {
      alert('Please select both starting point and destination.');
      return;
    }

    if (start === end) {
      alert('Starting point and destination cannot be the same.');
      return;
    }

    const { activeRoute, comparison } = nav.navigate(start, end, activeNavigationMode);

    if (!activeRoute) {
      alert('Could not calculate path between selected zones.');
      return;
    }

    navResultsCard.style.display = 'flex';
    navRouteDist.textContent = `${activeRoute.totalDistance} m`;
    navRouteTime.textContent = `${activeRoute.estimatedMinutes} min`;
    navRouteCongestion.textContent = `${activeRoute.avgCongestion}%`;

    // Congestion color
    if (activeRoute.avgCongestion > 70) navRouteCongestion.style.color = '#ef4444';
    else if (activeRoute.avgCongestion > 40) navRouteCongestion.style.color = '#f59e0b';
    else navRouteCongestion.style.color = '#10b981';

    // Comparison Banner
    if (comparison.isIdentical) {
      navComparisonBanner.className = 'route-comparison-callout recommended';
      navComparisonBanner.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color:var(--density-low);margin-top:2px;"></i>
        <div><strong>Optimal Path:</strong> The shortest route is already low-density and optimal!</div>
      `;
    } else {
      const shortestDist = comparison.shortest.totalDistance;
      const leastCrowdedDist = comparison.leastCrowded.totalDistance;
      const diffDist = leastCrowdedDist - shortestDist;

      if (activeNavigationMode === 'least_crowded') {
        navComparisonBanner.className = 'route-comparison-callout recommended';
        navComparisonBanner.innerHTML = `
          <i class="fa-solid fa-shield-halved" style="color:var(--density-low);margin-top:2px;"></i>
          <div>
            <strong>Least Crowded Route Active:</strong> Detours ${diffDist}m around congested choke points (${comparison.shortest.maxCongestion}% peak in shortest path vs ${comparison.leastCrowded.maxCongestion}% here).
          </div>
        `;
      } else {
        navComparisonBanner.className = 'route-comparison-callout warning';
        navComparisonBanner.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation" style="color:var(--density-high);margin-top:2px;"></i>
          <div>
            <strong>Shortest Route Active:</strong> Direct path (${shortestDist}m), but passes through high crowd congestion (${comparison.shortest.maxCongestion}% max density).
          </div>
        `;
      }
    }

    // Step-by-Step Directions List
    navStepsList.innerHTML = activeRoute.stepDetails.map((step, idx) => `
      <div class="step-item">
        <div class="step-dot">${idx + 1}</div>
        <div class="step-desc">
          <div>Proceed towards <span class="step-zone-tag">${step.to}</span> (${step.distance}m)</div>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-top:1px;">
            Crowd Density: <span style="color:${step.statusColor};font-weight:700;">${step.zoneStatus} (${step.occupancyPct}%)</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  navCalculateBtn.addEventListener('click', calculateAndRenderRoute);

  navClearBtn.addEventListener('click', () => {
    nav.clearRoute();
    navResultsCard.style.display = 'none';
  });

  navShortestBtn.addEventListener('click', () => {
    activeNavigationMode = 'shortest';
    navShortestBtn.classList.add('active');
    navLeastCrowdedBtn.classList.remove('active');
    if (nav.activeRoute) calculateAndRenderRoute();
  });

  navLeastCrowdedBtn.addEventListener('click', () => {
    activeNavigationMode = 'least_crowded';
    navLeastCrowdedBtn.classList.add('active');
    navShortestBtn.classList.remove('active');
    if (nav.activeRoute) calculateAndRenderRoute();
  });

  // 8. Sidebar Tab Switcher (Zone Inspector vs Navigation Planner)
  const tabBtns = document.querySelectorAll('.panel-header-tabs .tab-btn');
  const tabContents = {
    zoneDetails: document.getElementById('zoneDetailsTab'),
    navigationPlanner: document.getElementById('navigationPlannerTab')
  };

  function switchSidebarTab(tabKey) {
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    Object.keys(tabContents).forEach(key => {
      if (tabContents[key]) {
        tabContents[key].style.display = key === tabKey ? 'block' : 'none';
      }
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchSidebarTab(btn.getAttribute('data-tab'));
    });
  });

  // 9. Simulation Controls Bar Events
  simPlayBtn.addEventListener('click', () => {
    const isPlaying = sim.togglePlay();
    if (isPlaying) {
      simPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause</span>';
      simPlayBtn.classList.add('active');
    } else {
      simPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Resume</span>';
      simPlayBtn.classList.remove('active');
    }
  });

  simSpeedSelect.addEventListener('change', (e) => {
    sim.setSpeed(e.target.value);
  });

  simScenarioSelect.addEventListener('change', (e) => {
    sim.setScenario(e.target.value);
  });

  simStepBtn.addEventListener('click', () => {
    sim.tick();
  });

  simResetBtn.addEventListener('click', () => {
    sim.setScenario('normal');
    simScenarioSelect.value = 'normal';
  });

  // 10. Floor Level Switcher
  floorLevelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      floorLevelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const floor = btn.getAttribute('data-level');
      map.setFloorFilter(floor);
    });
  });

  // 11. Density Filter Chips
  densityFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      densityFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.getAttribute('data-filter');
      map.setDensityFilter(filter);
    });
  });

  // 12. Zone Search Bar & Dropdown
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      searchResultsDropdown.classList.remove('active');
      searchResultsDropdown.innerHTML = '';
      return;
    }

    const matches = sim.getAllZones().filter(z => 
      z.name.toLowerCase().includes(query) || 
      z.category.toLowerCase().includes(query) ||
      z.floor.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      searchResultsDropdown.innerHTML = `<div style="padding:0.75rem;font-size:0.75rem;color:var(--text-dim);text-align:center;">No matching zones found</div>`;
      searchResultsDropdown.classList.add('active');
      return;
    }

    searchResultsDropdown.innerHTML = matches.map(z => {
      const status = sim.getZoneDensityStatus(z);
      const pct = Math.round((z.count / z.capacity) * 100);
      return `
        <div class="search-result-item" data-zone="${z.id}">
          <div>
            <div class="search-result-name">${z.name}</div>
            <div style="font-size:0.7rem;color:var(--text-dim);">Floor ${z.floor} • ${z.category}</div>
          </div>
          <span class="status-badge ${status.badgeClass}" style="font-size:0.68rem;padding:2px 6px;">
            ${pct}%
          </span>
        </div>
      `;
    }).join('');

    searchResultsDropdown.classList.add('active');

    searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const zoneId = item.getAttribute('data-zone');
        map.selectZone(zoneId);
        searchInput.value = '';
        searchResultsDropdown.classList.remove('active');
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      searchResultsDropdown.classList.remove('active');
    }
  });

  // 13. Map Floating Buttons
  document.getElementById('mapZoomInBtn')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('mapZoomOutBtn')?.addEventListener('click', () => map.zoomOut());
  document.getElementById('mapResetBtn')?.addEventListener('click', () => map.resetView());
  document.getElementById('mapFitBtn')?.addEventListener('click', () => map.fitToScreen());

  // Particles Toggle
  const toggleParticlesBtn = document.getElementById('toggleParticlesBtn');
  if (toggleParticlesBtn) {
    toggleParticlesBtn.addEventListener('click', () => {
      const enabled = map.toggleParticles();
      if (enabled) {
        toggleParticlesBtn.classList.add('active');
      } else {
        toggleParticlesBtn.classList.remove('active');
      }
    });
  }

  // 14. Notifications Drawer
  notificationsToggleBtn.addEventListener('click', () => {
    notificationsDrawer.classList.toggle('active');
    if (notificationsDrawer.classList.contains('active')) {
      alerts.markAllAsRead();
    }
  });

  closeNotificationsBtn.addEventListener('click', () => {
    notificationsDrawer.classList.remove('active');
  });

  clearNotificationsBtn.addEventListener('click', () => {
    alerts.clearAll();
  });

  // Notification Filter Pills in Drawer
  document.querySelectorAll('.drawer-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.drawer-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      alerts.setFilter(btn.getAttribute('data-filter'));
    });
  });

  // 15. Analytics Modal
  analyticsToggleBtn.addEventListener('click', () => {
    analyticsModal.classList.add('active');
  });

  closeAnalyticsModalBtn.addEventListener('click', () => {
    analyticsModal.classList.remove('active');
  });

  analyticsModal.addEventListener('click', (e) => {
    if (e.target === analyticsModal) {
      analyticsModal.classList.remove('active');
    }
  });

  exportDataBtn.addEventListener('click', () => {
    analytics.exportDataReport();
  });

  // 16. Audio Mute Toggle
  audioToggleBtn.addEventListener('click', () => {
    const isEnabled = alerts.toggleAudio();
    if (isEnabled) {
      audioToggleBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      audioToggleBtn.classList.add('active');
    } else {
      audioToggleBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      audioToggleBtn.classList.remove('active');
    }
  });

  // 17. Theme Switcher (Dark -> Light -> Tactical)
  let currentThemeIndex = 0;
  const themes = ['dark', 'light', 'tactical'];
  themeToggleBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const theme = themes[currentThemeIndex];
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else if (theme === 'tactical') {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    } else {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
  });

  // 18. Fullscreen Toggle
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
      document.exitFullscreen().catch(() => {});
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
  });

  // 19. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      simPlayBtn.click();
    } else if (e.key === 'Escape') {
      notificationsDrawer.classList.remove('active');
      analyticsModal.classList.remove('active');
      map.deselectZone();
    }
  });

  // 20. Simulation Subscriber for Main UI
  sim.subscribe((zones, summary) => {
    updateSummaryUI(summary);

    // If a zone is currently being inspected, update its metrics in real time
    if (currentSelectedZoneId) {
      const activeZone = zones[currentSelectedZoneId];
      if (activeZone) {
        displayZoneInInspector(activeZone);
      }
    }
  });

  // Start simulation loop
  sim.start();
  updateSummaryUI(sim.getSummaryMetrics());
  // Pre-select Central Atrium by default for inspection
  map.selectZone('central_atrium');
});
