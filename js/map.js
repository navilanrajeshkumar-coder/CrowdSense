/**
 * CrowdSense - Interactive Floor Map Engine
 * Manages SVG floorplan geometry, pan/zoom matrix, dynamic crowd density shaders,
 * hover HUDs, particle flow animations, and zone interactions.
 */

class InteractiveMallMap {
  constructor(containerId, simulationEngine) {
    this.container = document.getElementById(containerId);
    this.sim = simulationEngine;
    this.svg = null;
    this.worldGroup = null;
    this.canvas = null;
    this.ctx = null;
    this.hoverHud = null;

    // Viewport & Pan/Zoom Matrix
    this.scale = 1;
    this.minScale = 0.6;
    this.maxScale = 3.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    // Active Filters
    this.activeFloor = 'ALL';
    this.activeDensityFilter = 'ALL';
    this.selectedZoneId = null;
    this.showParticles = true;
    this.showHeatmap = true;

    // Particle flow system
    this.particles = [];
    this.maxParticles = 120;
    this.animFrameId = null;

    this.onZoneSelectCallbacks = [];

    this.init();
  }

  init() {
    this.buildSVG();
    this.buildCanvas();
    this.buildHoverHud();
    this.attachEventListeners();
    this.initParticles();
    this.startParticleLoop();

    // Subscribe to simulation updates
    this.sim.subscribe((zones, summary) => {
      this.updateDensityVisuals(zones);
    });

    // Initial render
    this.updateDensityVisuals(this.sim.zones);
  }

  onZoneSelect(cb) {
    this.onZoneSelectCallbacks.push(cb);
  }

  buildSVG() {
    this.container.innerHTML = `
      <div class="map-grid-bg"></div>
      <svg id="mallFloorplan" class="floorplan-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">
        <defs>
          <!-- Grid Pattern -->
          <pattern id="floor-tile" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
          </pattern>
          
          <!-- Drop Shadows & Glow Filters -->
          <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
          </filter>

          <!-- Dynamic Density Gradients -->
          <radialGradient id="grad-low" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.10"/>
          </radialGradient>
          <radialGradient id="grad-moderate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.10"/>
          </radialGradient>
          <radialGradient id="grad-high" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0.15"/>
          </radialGradient>
          <radialGradient id="grad-critical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.20"/>
          </radialGradient>
        </defs>

        <g id="map-world">
          <!-- Background Base Slab -->
          <rect x="10" y="20" width="1180" height="760" rx="24" fill="#0b1220" stroke="rgba(148,163,184,0.15)" stroke-width="2" />
          <rect x="10" y="20" width="1180" height="760" rx="24" fill="url(#floor-tile)" />

          <!-- Corridors / Walkway Layer -->
          <g id="corridors-layer">
            <!-- Main Spine: West to East -->
            <path class="corridor-path" d="M 120 390 L 1040 390" />
            <path class="corridor-centerline" d="M 120 390 L 1040 390" />

            <!-- North-South Grand Promenade -->
            <path class="corridor-path" d="M 580 120 L 580 640" />
            <path class="corridor-centerline" d="M 580 120 L 580 640" />

            <!-- Diagonal Walkways -->
            <path class="corridor-path" d="M 270 370 L 580 390 L 890 370" />
            <path class="corridor-path" d="M 270 640 L 580 640 L 890 640" />
            
            <!-- Skybridges -->
            <path class="corridor-path" d="M 270 370 L 270 640" />
            <path class="corridor-path" d="M 890 370 L 890 640" />

            <!-- Restrooms corridors -->
            <path class="corridor-path" d="M 270 150 L 270 370" />
            <path class="corridor-path" d="M 890 150 L 890 370" />
          </g>

          <!-- Zones Polygons Layer -->
          <g id="zones-layer">
            <!-- 1. MAIN GRAND ENTRANCE -->
            <g class="zone-group" data-zone="main_entrance">
              <path class="mall-zone" id="zone-poly-main_entrance"
                d="M 460 50 L 700 50 L 680 160 L 480 160 Z" />
              <text class="zone-text-label" x="580" y="95">MAIN ENTRANCE</text>
              <text class="zone-sub-label" x="580" y="112">Ground Level • Transit</text>
              <rect class="zone-badge-bg" id="badge-bg-main_entrance" x="525" y="125" width="110" height="20" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-main_entrance" x="580" y="135">140 / 450 • 31%</text>
            </g>

            <!-- 2. CENTRAL GRAND ATRIUM -->
            <g class="zone-group" data-zone="central_atrium">
              <polygon class="mall-zone" id="zone-poly-central_atrium"
                points="580,280 710,340 710,460 580,520 450,460 450,340" />
              <text class="zone-text-label" x="580" y="380">CENTRAL ATRIUM</text>
              <text class="zone-sub-label" x="580" y="398">Piazza • Information • Hub</text>
              <rect class="zone-badge-bg" id="badge-bg-central_atrium" x="525" y="420" width="110" height="20" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-central_atrium" x="580" y="430">220 / 650 • 34%</text>
            </g>

            <!-- 3. KIDS PLAY ARENA (Level 1 Central North) -->
            <g class="zone-group" data-zone="kids_zone">
              <rect class="mall-zone" id="zone-poly-kids_zone" x="480" y="185" width="200" height="75" rx="12" />
              <text class="zone-text-label" x="580" y="222">KIDS PLAY ARENA</text>
              <rect class="zone-badge-bg" id="badge-bg-kids_zone" x="530" y="235" width="100" height="18" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-kids_zone" x="580" y="244">65 / 190 • 34%</text>
            </g>

            <!-- 4. FASHION BOULEVARD (Level 1 West) -->
            <g class="zone-group" data-zone="fashion_wing">
              <rect class="mall-zone" id="zone-poly-fashion_wing" x="140" y="280" width="260" height="180" rx="16" />
              <text class="zone-text-label" x="270" y="355">FASHION BOULEVARD</text>
              <text class="zone-sub-label" x="270" y="375">Apparel • Footwear • Luxury</text>
              <rect class="zone-badge-bg" id="badge-bg-fashion_wing" x="215" y="405" width="110" height="20" fill="#f59e0b" />
              <text class="zone-badge-text" id="badge-txt-fashion_wing" x="270" y="415">185 / 420 • 44%</text>
            </g>

            <!-- 5. ELECTRONICS & TECH HUB (Level 1 East) -->
            <g class="zone-group" data-zone="electronics_sec">
              <rect class="mall-zone" id="zone-poly-electronics_sec" x="760" y="280" width="260" height="180" rx="16" />
              <text class="zone-text-label" x="890" y="355">ELECTRONICS & TECH</text>
              <text class="zone-sub-label" x="890" y="375">Computers • Mobile • Gadgets</text>
              <rect class="zone-badge-bg" id="badge-bg-electronics_sec" x="835" y="405" width="110" height="20" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-electronics_sec" x="890" y="415">98 / 320 • 31%</text>
            </g>

            <!-- 6. GOURMET FOOD COURT (Level 2 South Central) -->
            <g class="zone-group" data-zone="food_court">
              <path class="mall-zone" id="zone-poly-food_court"
                d="M 450 550 L 710 550 L 730 730 L 430 730 Z" />
              <text class="zone-text-label" x="580" y="625">GOURMET FOOD COURT</text>
              <text class="zone-sub-label" x="580" y="645">Restaurants • Cafes • Terrace</text>
              <rect class="zone-badge-bg" id="badge-bg-food_court" x="525" y="675" width="110" height="20" fill="#f97316" />
              <text class="zone-badge-text" id="badge-txt-food_court" x="580" y="685">360 / 520 • 69%</text>
            </g>

            <!-- 7. CYBER ARCADE & GAMING (Level 2 South-West) -->
            <g class="zone-group" data-zone="gaming_zone">
              <rect class="mall-zone" id="zone-poly-gaming_zone" x="140" y="550" width="260" height="180" rx="16" />
              <text class="zone-text-label" x="270" y="625">CYBER ARCADE & VR</text>
              <text class="zone-sub-label" x="270" y="645">Gaming • VR Arena • Bowling</text>
              <rect class="zone-badge-bg" id="badge-bg-gaming_zone" x="215" y="675" width="110" height="20" fill="#f59e0b" />
              <text class="zone-badge-text" id="badge-txt-gaming_zone" x="270" y="685">110 / 260 • 42%</text>
            </g>

            <!-- 8. MULTIPLEX CINEMA & IMAX (Level 2 South-East) -->
            <g class="zone-group" data-zone="cinema">
              <rect class="mall-zone" id="zone-poly-cinema" x="760" y="550" width="260" height="180" rx="16" />
              <text class="zone-text-label" x="890" y="625">MULTIPLEX CINEMA</text>
              <text class="zone-sub-label" x="890" y="645">8 Screens • IMAX Theatre</text>
              <rect class="zone-badge-bg" id="badge-bg-cinema" x="835" y="675" width="110" height="20" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-cinema" x="890" y="685">160 / 550 • 29%</text>
            </g>

            <!-- 9. RESTROOMS NORTH (Ground North-West) -->
            <g class="zone-group" data-zone="restrooms_north">
              <rect class="mall-zone" id="zone-poly-restrooms_north" x="170" y="90" width="200" height="110" rx="12" />
              <text class="zone-text-label" x="270" y="140">RESTROOMS NORTH</text>
              <text class="zone-sub-label" x="270" y="156">Lounge & Baby Care</text>
              <rect class="zone-badge-bg" id="badge-bg-restrooms_north" x="220" y="170" width="100" height="18" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-restrooms_north" x="270" y="179">24 / 85 • 28%</text>
            </g>

            <!-- 10. RESTROOMS SOUTH (Level 2 North-East) -->
            <g class="zone-group" data-zone="restrooms_south">
              <rect class="mall-zone" id="zone-poly-restrooms_south" x="790" y="90" width="200" height="110" rx="12" />
              <text class="zone-text-label" x="890" y="140">RESTROOMS SOUTH</text>
              <text class="zone-sub-label" x="890" y="156">Family Lounge</text>
              <rect class="zone-badge-bg" id="badge-bg-restrooms_south" x="840" y="170" width="100" height="18" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-restrooms_south" x="890" y="179">38 / 85 • 45%</text>
            </g>

            <!-- 11. SMART TRANSIT & PARKING P1-P2 (West) -->
            <g class="zone-group" data-zone="parking_area">
              <rect class="mall-zone" id="zone-poly-parking_area" x="30" y="270" width="80" height="220" rx="12" />
              <text class="zone-text-label" x="70" y="365" transform="rotate(-90 70 365)">PARKING P1/P2</text>
              <rect class="zone-badge-bg" id="badge-bg-parking_area" x="35" y="450" width="70" height="20" fill="#f59e0b" />
              <text class="zone-badge-text" id="badge-txt-parking_area" x="70" y="460">310/750</text>
            </g>

            <!-- 12. HYPERMARKET (East) -->
            <g class="zone-group" data-zone="hypermarket">
              <rect class="mall-zone" id="zone-poly-hypermarket" x="1050" y="270" width="115" height="220" rx="12" />
              <text class="zone-text-label" x="1107" y="365" transform="rotate(90 1107 365)">SUPERSTORE</text>
              <rect class="zone-badge-bg" id="badge-bg-hypermarket" x="1060" y="450" width="95" height="20" fill="#10b981" />
              <text class="zone-badge-text" id="badge-txt-hypermarket" x="1107" y="460">135 / 380</text>
            </g>
          </g>

          <!-- Emergency Exits & Waypoint Markers Layer -->
          <g id="exits-layer">
            <g class="exit-marker" transform="translate(580, 28)">
              <rect x="-35" y="-14" width="70" height="22" rx="4" fill="#10b981" stroke="#ffffff" stroke-width="1.2"/>
              <text x="0" y="1" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle" dominant-baseline="central">EXIT NORTH</text>
            </g>
            <g class="exit-marker" transform="translate(580, 755)">
              <rect x="-35" y="-14" width="70" height="22" rx="4" fill="#10b981" stroke="#ffffff" stroke-width="1.2"/>
              <text x="0" y="1" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle" dominant-baseline="central">EXIT SOUTH</text>
            </g>
            <g class="exit-marker" transform="translate(18, 380)">
              <rect x="-10" y="-30" width="20" height="60" rx="4" fill="#10b981" stroke="#ffffff" stroke-width="1.2"/>
              <text x="0" y="0" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 0 0)">EXIT WEST</text>
            </g>
            <g class="exit-marker" transform="translate(1182, 380)">
              <rect x="-10" y="-30" width="20" height="60" rx="4" fill="#10b981" stroke="#ffffff" stroke-width="1.2"/>
              <text x="0" y="0" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="central" transform="rotate(90 0 0)">EXIT EAST</text>
            </g>
          </g>

          <!-- Dynamic Active Route Layer (For Smart Navigation) -->
          <g id="route-render-group">
            <path id="routeUnderglow" class="nav-route-underglow" d="" />
            <path id="routeActiveLine" class="nav-route-active" d="" />
            <g id="routeWaypointsGroup"></g>
          </g>
        </g>
      </svg>
      <canvas id="crowdParticlesCanvas" class="particle-canvas"></canvas>
    `;

    this.svg = document.getElementById('mallFloorplan');
    this.worldGroup = document.getElementById('map-world');
  }

  buildCanvas() {
    this.canvas = document.getElementById('crowdParticlesCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  buildHoverHud() {
    this.hoverHud = document.createElement('div');
    this.hoverHud.id = 'mapHoverHud';
    this.hoverHud.className = 'map-hover-hud';
    this.hoverHud.innerHTML = `
      <div class="hud-zone-name" id="hudZoneName">Zone Name</div>
      <div class="hud-row">
        <span>Occupancy</span>
        <span class="hud-val" id="hudOccupancy">0%</span>
      </div>
      <div class="hud-row">
        <span>Count / Capacity</span>
        <span class="hud-val" id="hudCount">0 / 0</span>
      </div>
      <div class="hud-row">
        <span>Status</span>
        <span class="hud-val" id="hudStatus">Low</span>
      </div>
    `;
    this.container.appendChild(this.hoverHud);
  }

  attachEventListeners() {
    // Zoom with mouse wheel
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      this.zoomAtPoint(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // Pan with mouse drag
    this.container.addEventListener('mousedown', (e) => {
      // Don't drag if clicked on a button or tool
      if (e.target.closest('.map-ctrl-btn') || e.target.closest('.layer-toggle-pill')) return;
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch events for mobile/tablet
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.startX = e.touches[0].clientX - this.panX;
        this.startY = e.touches[0].clientY - this.panY;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        this.panX = e.touches[0].clientX - this.startX;
        this.panY = e.touches[0].clientY - this.startY;
        this.applyTransform();
      }
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Zone Interactions (Click & Hover)
    const zoneGroups = this.container.querySelectorAll('.zone-group');
    zoneGroups.forEach(zg => {
      const zoneId = zg.getAttribute('data-zone');

      zg.addEventListener('mouseenter', (e) => this.showZoneHud(zoneId, e));
      zg.addEventListener('mousemove', (e) => this.updateZoneHudPos(e));
      zg.addEventListener('mouseleave', () => this.hideZoneHud());
      zg.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectZone(zoneId);
      });
    });

    // Click background to deselect
    this.container.addEventListener('click', (e) => {
      if (!e.target.closest('.zone-group')) {
        this.deselectZone();
      }
    });
  }

  zoomAtPoint(factor, clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    if (newScale === this.scale) return;

    // Adjust pan to zoom towards mouse position
    this.panX = x - (x - this.panX) * (newScale / this.scale);
    this.panY = y - (y - this.panY) * (newScale / this.scale);
    this.scale = newScale;

    this.applyTransform();
  }

  applyTransform() {
    if (this.worldGroup) {
      this.worldGroup.setAttribute(
        'transform',
        `matrix(${this.scale}, 0, 0, ${this.scale}, ${this.panX}, ${this.panY})`
      );
    }
  }

  zoomIn() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAtPoint(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  zoomOut() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAtPoint(0.83, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  resetView() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  fitToScreen() {
    this.scale = 0.95;
    this.panX = 15;
    this.panY = 15;
    this.applyTransform();
  }

  selectZone(zoneId) {
    this.selectedZoneId = zoneId;
    // Highlight SVG polygon
    const allPolys = this.container.querySelectorAll('.mall-zone');
    allPolys.forEach(p => p.classList.remove('selected-zone'));

    const activePoly = document.getElementById(`zone-poly-${zoneId}`);
    if (activePoly) {
      activePoly.classList.add('selected-zone');
    }

    // Notify listeners (UI Inspector drawer)
    const zoneData = this.sim.getZone(zoneId);
    if (zoneData) {
      this.onZoneSelectCallbacks.forEach(cb => cb(zoneData));
    }
  }

  deselectZone() {
    this.selectedZoneId = null;
    const allPolys = this.container.querySelectorAll('.mall-zone');
    allPolys.forEach(p => p.classList.remove('selected-zone'));
  }

  showZoneHud(zoneId, e) {
    const zone = this.sim.getZone(zoneId);
    if (!zone || !this.hoverHud) return;

    const status = this.sim.getZoneDensityStatus(zone);
    const pct = Math.round((zone.count / zone.capacity) * 100);

    document.getElementById('hudZoneName').textContent = zone.name;
    document.getElementById('hudOccupancy').textContent = `${pct}%`;
    document.getElementById('hudOccupancy').style.color = status.color;
    document.getElementById('hudCount').textContent = `${zone.count} / ${zone.capacity}`;
    document.getElementById('hudStatus').textContent = status.label;
    document.getElementById('hudStatus').style.color = status.color;

    this.updateZoneHudPos(e);
    this.hoverHud.style.display = 'flex';
  }

  updateZoneHudPos(e) {
    if (!this.hoverHud) return;
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.hoverHud.style.left = `${x}px`;
    this.hoverHud.style.top = `${y}px`;
  }

  hideZoneHud() {
    if (this.hoverHud) {
      this.hoverHud.style.display = 'none';
    }
  }

  // Update SVG styling, badges, and colors based on live simulation metrics
  updateDensityVisuals(zones) {
    Object.values(zones).forEach(z => {
      const poly = document.getElementById(`zone-poly-${z.id}`);
      const badgeBg = document.getElementById(`badge-bg-${z.id}`);
      const badgeTxt = document.getElementById(`badge-txt-${z.id}`);
      if (!poly) return;

      const status = this.sim.getZoneDensityStatus(z);
      const pct = Math.round((z.count / z.capacity) * 100);

      // Clean old density classes
      poly.classList.remove('density-low', 'density-moderate', 'density-high', 'density-critical');
      poly.classList.add(`density-${status.level}`);

      // Density filter checking
      let shouldDim = false;
      if (this.activeFloor !== 'ALL' && z.floor !== this.activeFloor) {
        shouldDim = true;
      }
      if (this.activeDensityFilter !== 'ALL' && status.level !== this.activeDensityFilter) {
        shouldDim = true;
      }

      poly.style.opacity = shouldDim ? '0.2' : '1';

      if (badgeBg) {
        badgeBg.setAttribute('fill', status.color);
        badgeBg.style.opacity = shouldDim ? '0.2' : '1';
      }
      if (badgeTxt) {
        badgeTxt.textContent = `${z.count} / ${z.capacity} • ${pct}%`;
        badgeTxt.style.opacity = shouldDim ? '0.2' : '1';
      }
    });
  }

  setFloorFilter(floorKey) {
    this.activeFloor = floorKey;
    this.updateDensityVisuals(this.sim.zones);
  }

  setDensityFilter(filterKey) {
    this.activeDensityFilter = filterKey;
    this.updateDensityVisuals(this.sim.zones);
  }

  toggleParticles() {
    this.showParticles = !this.showParticles;
    if (!this.showParticles && this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    return this.showParticles;
  }

  // ================= CROWD PARTICLES SYSTEM =================
  initParticles() {
    this.particles = [];
    const waypoints = [
      { x: 580, y: 120 }, { x: 580, y: 240 }, { x: 580, y: 390 },
      { x: 270, y: 370 }, { x: 890, y: 370 }, { x: 580, y: 640 },
      { x: 270, y: 640 }, { x: 890, y: 640 }, { x: 120, y: 390 },
      { x: 1040, y: 390 }
    ];

    for (let i = 0; i < this.maxParticles; i++) {
      const startNode = waypoints[Math.floor(Math.random() * waypoints.length)];
      const targetNode = waypoints[Math.floor(Math.random() * waypoints.length)];
      this.particles.push({
        x: startNode.x + (Math.random() - 0.5) * 40,
        y: startNode.y + (Math.random() - 0.5) * 40,
        targetX: targetNode.x + (Math.random() - 0.5) * 40,
        targetY: targetNode.y + (Math.random() - 0.5) * 40,
        speed: 0.6 + Math.random() * 0.9,
        size: 2.2 + Math.random() * 1.5,
        color: Math.random() > 0.4 ? '#06b6d4' : (Math.random() > 0.5 ? '#10b981' : '#f59e0b')
      });
    }
  }

  startParticleLoop() {
    const waypoints = [
      { x: 580, y: 120 }, { x: 580, y: 240 }, { x: 580, y: 390 },
      { x: 270, y: 370 }, { x: 890, y: 370 }, { x: 580, y: 640 },
      { x: 270, y: 640 }, { x: 890, y: 640 }, { x: 120, y: 390 },
      { x: 1040, y: 390 }
    ];

    const render = () => {
      if (this.showParticles && this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // SVG to Canvas coordinate transformation
        const svgRect = this.svg.getBoundingClientRect();
        const scaleX = svgRect.width / 1200;
        const scaleY = svgRect.height / 800;

        this.particles.forEach(p => {
          // Move towards target
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 5) {
            // Pick new target
            const nextNode = waypoints[Math.floor(Math.random() * waypoints.length)];
            p.targetX = nextNode.x + (Math.random() - 0.5) * 40;
            p.targetY = nextNode.y + (Math.random() - 0.5) * 40;
          } else {
            p.x += (dx / dist) * p.speed;
            p.y += (dy / dist) * p.speed;
          }

          // Apply current SVG pan/zoom matrix to particle positions
          const screenX = (p.x * this.scale + this.panX) * scaleX;
          const screenY = (p.y * this.scale + this.panY) * scaleY;

          this.ctx.beginPath();
          this.ctx.arc(screenX, screenY, p.size * this.scale * scaleX, 0, Math.PI * 2);
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 4;
          this.ctx.fill();
        });
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    render();
  }

  // Draw calculated route from Navigation Engine
  drawRoute(points, isLeastCrowded) {
    const underglow = document.getElementById('routeUnderglow');
    const activeLine = document.getElementById('routeActiveLine');
    const waypointsGroup = document.getElementById('routeWaypointsGroup');

    if (!points || points.length < 2) {
      if (underglow) underglow.setAttribute('d', '');
      if (activeLine) activeLine.setAttribute('d', '');
      if (waypointsGroup) waypointsGroup.innerHTML = '';
      return;
    }

    // Build SVG path data
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    if (underglow) {
      underglow.setAttribute('d', d);
      underglow.style.stroke = isLeastCrowded ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)';
    }

    if (activeLine) {
      activeLine.setAttribute('d', d);
      if (isLeastCrowded) {
        activeLine.classList.add('least-crowded');
      } else {
        activeLine.classList.remove('least-crowded');
      }
    }

    // Add start and destination pulse pins
    if (waypointsGroup) {
      const start = points[0];
      const end = points[points.length - 1];

      waypointsGroup.innerHTML = `
        <!-- Start Pin -->
        <g class="nav-pin-start" transform="translate(${start.x}, ${start.y})">
          <circle r="12" fill="#06b6d4" opacity="0.3"/>
          <circle r="7" fill="#06b6d4" stroke="#ffffff" stroke-width="2"/>
        </g>
        <!-- End Pin -->
        <g class="nav-pin-end" transform="translate(${end.x}, ${end.y})">
          <circle r="14" fill="#10b981" opacity="0.3"/>
          <circle r="8" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>
          <circle r="3" fill="#ffffff"/>
        </g>
      `;
    }
  }

  clearRoute() {
    this.drawRoute([], false);
  }
}

// Export class
window.InteractiveMallMap = InteractiveMallMap;
