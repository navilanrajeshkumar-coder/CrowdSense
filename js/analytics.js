/**
 * CrowdSense - Analytics & Visualizations Engine
 * Powers real-time Chart.js visualisations, historical trends,
 * category distribution doughnuts, and zone leaderboards.
 */

class CrowdAnalyticsEngine {
  constructor(simulationEngine) {
    this.sim = simulationEngine;
    this.barChart = null;
    this.lineChart = null;
    this.doughnutChart = null;
    this.timeLabels = [];
    this.maxTimePoints = 15;

    this.init();
  }

  init() {
    this.initTimeLabels();
    this.setupCharts();
    this.renderLeaderboardTable();

    // Subscribe to simulation updates
    this.sim.subscribe((zones, summary) => {
      this.updateCharts(zones, summary);
      this.renderLeaderboardTable();
    });
  }

  initTimeLabels() {
    const now = Date.now();
    for (let i = this.maxTimePoints - 1; i >= 0; i--) {
      const d = new Date(now - i * 3000);
      this.timeLabels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }

  setupCharts() {
    if (typeof Chart === 'undefined') return;

    // Apply global Chart.js dark theme styling
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';

    this.setupBarChart();
    this.setupLineChart();
    this.setupDoughnutChart();
  }

  setupBarChart() {
    const canvas = document.getElementById('zoneOccupancyBarChart');
    if (!canvas) return;

    const zones = this.sim.getAllZones();
    const labels = zones.map(z => z.name.replace('Grand ', '').replace('Multiplex ', ''));
    const data = zones.map(z => Math.round((z.count / z.capacity) * 100));
    const colors = zones.map(z => this.sim.getZoneDensityStatus(z).color);

    this.barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Occupancy %',
          data: data,
          backgroundColor: colors,
          borderRadius: 4,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Occupancy: ${context.raw}%`
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }

  setupLineChart() {
    const canvas = document.getElementById('crowdTrendLineChart');
    if (!canvas) return;

    const zones = this.sim.zones;

    this.lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.timeLabels,
        datasets: [
          {
            label: 'Food Court',
            data: zones.food_court.history.slice(-this.maxTimePoints),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.35,
            fill: false,
            borderWidth: 2
          },
          {
            label: 'Central Atrium',
            data: zones.central_atrium.history.slice(-this.maxTimePoints),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.35,
            fill: false,
            borderWidth: 2
          },
          {
            label: 'Fashion Wing',
            data: zones.fashion_wing.history.slice(-this.maxTimePoints),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.35,
            fill: false,
            borderWidth: 2
          },
          {
            label: 'Cinema',
            data: zones.cinema.history.slice(-this.maxTimePoints),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.35,
            fill: false,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, usePointStyle: true }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' }
          }
        }
      }
    });
  }

  setupDoughnutChart() {
    const canvas = document.getElementById('categoryDoughnutChart');
    if (!canvas) return;

    const catData = this.calculateCategoryTotals();

    this.doughnutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catData),
        datasets: [{
          data: Object.values(catData),
          backgroundColor: [
            '#06b6d4', // Retail
            '#f97316', // Dining
            '#8b5cf6', // Entertainment
            '#3b82f6', // Transit
            '#10b981', // Amenities
            '#ec4899'  // Plaza
          ],
          borderWidth: 2,
          borderColor: '#111a2c'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } }
          }
        },
        cutout: '68%'
      }
    });
  }

  calculateCategoryTotals() {
    const cats = {};
    Object.values(this.sim.zones).forEach(z => {
      cats[z.category] = (cats[z.category] || 0) + z.count;
    });
    return cats;
  }

  updateCharts(zones, summary) {
    if (this.barChart) {
      const zArr = Object.values(zones);
      this.barChart.data.datasets[0].data = zArr.map(z => Math.round((z.count / z.capacity) * 100));
      this.barChart.data.datasets[0].backgroundColor = zArr.map(z => this.sim.getZoneDensityStatus(z).color);
      this.barChart.update('none');
    }

    if (this.lineChart) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.timeLabels.push(nowStr);
      if (this.timeLabels.length > this.maxTimePoints) {
        this.timeLabels.shift();
      }
      this.lineChart.data.labels = [...this.timeLabels];

      this.lineChart.data.datasets[0].data = zones.food_court.history.slice(-this.maxTimePoints);
      this.lineChart.data.datasets[1].data = zones.central_atrium.history.slice(-this.maxTimePoints);
      this.lineChart.data.datasets[2].data = zones.fashion_wing.history.slice(-this.maxTimePoints);
      this.lineChart.data.datasets[3].data = zones.cinema.history.slice(-this.maxTimePoints);
      this.lineChart.update('none');
    }

    if (this.doughnutChart) {
      const catData = this.calculateCategoryTotals();
      this.doughnutChart.data.labels = Object.keys(catData);
      this.doughnutChart.data.datasets[0].data = Object.values(catData);
      this.doughnutChart.update('none');
    }
  }

  renderLeaderboardTable() {
    const tableBody = document.getElementById('zoneLeaderboardBody');
    if (!tableBody) return;

    const zones = this.sim.getAllZones();
    // Sort descending by occupancy %
    const sorted = [...zones].sort((a, b) => {
      const pctA = a.count / a.capacity;
      const pctB = b.count / b.capacity;
      return pctB - pctA;
    });

    tableBody.innerHTML = sorted.map((z, idx) => {
      const pct = Math.round((z.count / z.capacity) * 100);
      const status = this.sim.getZoneDensityStatus(z);
      return `
        <tr data-zone="${z.id}" style="cursor:pointer;">
          <td style="font-weight:700;color:var(--text-dim);">${idx + 1}</td>
          <td>
            <div style="font-weight:600;color:var(--text-main);">${z.name}</div>
            <div style="font-size:0.7rem;color:var(--text-dim);">Floor ${z.floor} • ${z.category}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;min-width:60px;">
                <div style="height:100%;width:${pct}%;background:${status.color};border-radius:99px;"></div>
              </div>
              <span style="font-weight:700;font-family:var(--font-mono);font-size:0.75rem;">${pct}%</span>
            </div>
          </td>
          <td style="font-family:var(--font-mono);">${z.count} / ${z.capacity}</td>
          <td>
            <span class="status-badge ${status.badgeClass}" style="font-size:0.68rem;padding:2px 8px;">
              ${status.label}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    // Clicking row highlights zone on map
    tableBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const zoneId = row.getAttribute('data-zone');
        if (zoneId && window.mallMap) {
          window.mallMap.selectZone(zoneId);
          // Close modal if open
          const modal = document.getElementById('analyticsModal');
          if (modal) modal.classList.remove('active');
        }
      });
    });
  }

  exportDataReport() {
    const summary = this.sim.getSummaryMetrics();
    const zones = this.sim.getAllZones();

    const report = {
      facility: "CrowdSense Shopping Mall Digital Twin",
      generatedAt: new Date().toISOString(),
      summary: summary,
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        floor: z.floor,
        category: z.category,
        count: z.count,
        capacity: z.capacity,
        occupancyPercent: Math.round((z.count / z.capacity) * 100),
        status: this.sim.getZoneDensityStatus(z).label,
        peakToday: z.peakToday
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrowdSense_Mall_Telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Export class
window.CrowdAnalyticsEngine = CrowdAnalyticsEngine;
