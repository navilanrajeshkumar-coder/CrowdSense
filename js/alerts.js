/**
 * CrowdSense - Alerts & Notifications System
 * Manages toast notifications, audio chimes (via Web Audio API),
 * notification center history, and alert filtering.
 */

class AlertNotificationManager {
  constructor() {
    this.alerts = [];
    this.maxHistory = 50;
    this.audioEnabled = true;
    this.audioCtx = null;
    this.unreadCount = 0;

    this.toastContainer = null;
    this.drawerList = null;
    this.badgeEl = null;

    this.activeFilter = 'ALL';

    this.init();
  }

  init() {
    this.toastContainer = document.getElementById('toastsContainer');
    this.drawerList = document.getElementById('notificationsList');
    this.badgeEl = document.getElementById('notificationBadge');

    // Subscribe to simulation alerts
    if (window.crowdSim) {
      window.crowdSim.onAlert(alert => this.addAlert(alert));
    }
  }

  initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
  }

  // Play pleasant synthesized futuristic notification chimes
  playAlertSound(type = 'info') {
    if (!this.audioEnabled) return;
    try {
      this.initAudio();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'critical') {
        // High alert double pulse
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'warning') {
        // Warning chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440.00, now); // A4
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        // Subtle soft blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // Audio context may require user interaction first
    }
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    return this.audioEnabled;
  }

  addAlert(alertData) {
    const alert = {
      id: 'alert_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: alertData.type || 'info', // 'critical', 'warning', 'info', 'success'
      title: alertData.title || 'System Notification',
      message: alertData.message,
      zoneId: alertData.zoneId || null,
      timestamp: alertData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxHistory) {
      this.alerts.pop();
    }

    this.unreadCount++;
    this.updateBadge();
    this.showToast(alert);
    this.renderDrawerList();
    this.playAlertSound(alert.type);
  }

  showToast(alert) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-alert ${alert.type}`;
    toast.id = `toast-${alert.id}`;

    let iconHtml = '<i class="fa-solid fa-info-circle" style="color:var(--accent-cyan)"></i>';
    if (alert.type === 'critical') iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--density-critical)"></i>';
    else if (alert.type === 'warning') iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color:var(--density-high)"></i>';
    else if (alert.type === 'success') iconHtml = '<i class="fa-solid fa-circle-check" style="color:var(--density-low)"></i>';

    toast.innerHTML = `
      <div style="font-size:1.2rem;margin-top:2px;">${iconHtml}</div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <strong style="font-size:0.82rem;color:var(--text-main);">${alert.title}</strong>
          <span style="font-size:0.68rem;color:var(--text-dim);font-family:var(--font-mono);">${alert.timestamp}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${alert.message}</div>
        ${alert.zoneId && alert.zoneId !== 'all' ? `
          <button class="toast-inspect-btn" data-zone="${alert.zoneId}" style="margin-top:6px;background:none;border:none;color:var(--accent-cyan);font-size:0.72rem;font-weight:700;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:4px;">
            <span>Locate Zone</span> <i class="fa-solid fa-arrow-right" style="font-size:0.65rem;"></i>
          </button>
        ` : ''}
      </div>
      <button class="toast-close-btn" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.85rem;padding:2px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    // Click to locate zone
    const inspectBtn = toast.querySelector('.toast-inspect-btn');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.mallMap) {
          window.mallMap.selectZone(alert.zoneId);
        }
        this.dismissToast(toast);
      });
    }

    // Close button
    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('click', () => this.dismissToast(toast));

    this.toastContainer.appendChild(toast);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      this.dismissToast(toast);
    }, 6000);
  }

  dismissToast(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(120%)';
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 300);
  }

  updateBadge() {
    if (!this.badgeEl) return;
    if (this.unreadCount > 0) {
      this.badgeEl.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.badgeEl.style.display = 'flex';
    } else {
      this.badgeEl.style.display = 'none';
    }
  }

  markAllAsRead() {
    this.unreadCount = 0;
    this.alerts.forEach(a => a.read = true);
    this.updateBadge();
    this.renderDrawerList();
  }

  clearAll() {
    this.alerts = [];
    this.unreadCount = 0;
    this.updateBadge();
    this.renderDrawerList();
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.renderDrawerList();
  }

  renderDrawerList() {
    if (!this.drawerList) return;

    let filtered = this.alerts;
    if (this.activeFilter !== 'ALL') {
      filtered = this.alerts.filter(a => a.type.toLowerCase() === this.activeFilter.toLowerCase());
    }

    if (filtered.length === 0) {
      this.drawerList.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;color:var(--text-dim);">
          <i class="fa-solid fa-bell-slash" style="font-size:2rem;margin-bottom:0.75rem;opacity:0.5;"></i>
          <p style="font-size:0.85rem;">No active alerts matching filter.</p>
        </div>
      `;
      return;
    }

    this.drawerList.innerHTML = filtered.map(a => `
      <div class="notification-item ${a.type} ${!a.read ? 'unread' : ''}" data-zone="${a.zoneId || ''}">
        <div class="notification-header">
          <span class="notification-title">
            ${a.type === 'critical' ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--density-critical)"></i>' : 
              a.type === 'warning' ? '<i class="fa-solid fa-circle-exclamation" style="color:var(--density-high)"></i>' : 
              '<i class="fa-solid fa-circle-info" style="color:var(--accent-cyan)"></i>'}
            ${a.title}
          </span>
          <span class="notification-time">${a.timestamp}</span>
        </div>
        <p class="notification-msg">${a.message}</p>
        ${a.zoneId && a.zoneId !== 'all' ? `
          <div style="margin-top:4px;">
            <a href="javascript:void(0)" class="drawer-zone-link" data-zone="${a.zoneId}" style="font-size:0.72rem;color:var(--accent-cyan);font-weight:600;text-decoration:none;">
              Inspect on Floorplan &rarr;
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');

    // Attach click listeners to zone links in drawer
    const links = this.drawerList.querySelectorAll('.drawer-zone-link');
    links.forEach(l => {
      l.addEventListener('click', (e) => {
        e.preventDefault();
        const zoneId = l.getAttribute('data-zone');
        if (zoneId && window.mallMap) {
          window.mallMap.selectZone(zoneId);
          // Close drawer on mobile
          const drawer = document.getElementById('notificationsDrawer');
          if (drawer) drawer.classList.remove('active');
        }
      });
    });
  }
}

// Export class
window.AlertNotificationManager = AlertNotificationManager;
