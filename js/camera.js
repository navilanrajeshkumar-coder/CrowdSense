/**
 * CrowdSense - Dual-Camera AI People Counter Engine
 * Connects dual webcams (Entry & Exit) with TensorFlow.js COCO-SSD,
 * draws tripwire overlays, and feeds real-time headcount deltas into CrowdSimulationEngine.
 */

class AICameraMonitor {
  constructor(simulationEngine) {
    this.sim = simulationEngine;
    this.model = null;
    this.camList = [];
    this.isSwapped = false;
    this.isRunning = false;

    this.activeStreams = { entry: null, exit: null };
    this.lastSide = { entry: null, exit: null };
    this.lastTriggerTime = { entry: 0, exit: 0 };

    // Optional DOM bindings (automatically hooks into html/index.html if present)
    this.els = {
      status: document.getElementById('cameraStatusText') || document.getElementById('aiStatus'),
      startBtn: document.getElementById('cameraStartBtn'),
      stopBtn: document.getElementById('cameraStopBtn'),
      swapBtn: document.getElementById('cameraSwapBtn'),
      resetBtn: document.getElementById('cameraResetBtn'),
      modeToggle: document.getElementById('operatingModeSelect'),
      zoneSelect: document.getElementById('cameraZoneSelect'),
      entryVideo: document.getElementById('entryVideo'),
      entryCanvas: document.getElementById('entryCanvas'),
      entryLabel: document.getElementById('entryLabel'),
      exitVideo: document.getElementById('exitVideo'),
      exitCanvas: document.getElementById('exitCanvas'),
      exitLabel: document.getElementById('exitLabel'),
      entryCount: document.getElementById('cameraEntryCount'),
      exitCount: document.getElementById('cameraExitCount'),
      netCount: document.getElementById('cameraNetCount')
    };

    this.init();
  }

  init() {
    this.bindUIEvents();
    this.loadAIModel();

    // Sync camera telemetry numbers whenever simulation updates
    if (this.sim) {
      this.sim.subscribe((zones, summary) => {
        if (this.els.entryCount) this.els.entryCount.textContent = summary.cameraEntries;
        if (this.els.exitCount) this.els.exitCount.textContent = summary.cameraExits;
        if (this.els.netCount) this.els.netCount.textContent = summary.cameraNetOccupancy;
      });
    }
  }

  bindUIEvents() {
    if (this.els.startBtn) {
      this.els.startBtn.addEventListener('click', () => this.startDualCameras());
    }
    if (this.els.stopBtn) {
      this.els.stopBtn.addEventListener('click', () => this.stopDualCameras());
    }
    if (this.els.swapBtn) {
      this.els.swapBtn.addEventListener('click', () => this.swapCameras());
    }
    if (this.els.resetBtn) {
      this.els.resetBtn.addEventListener('click', () => {
        if (this.sim) this.sim.resetCameraCounts();
      });
    }
    if (this.els.modeToggle) {
      this.els.modeToggle.addEventListener('change', (e) => {
        if (this.sim) this.sim.setOperatingMode(e.target.value);
      });
    }
    if (this.els.zoneSelect) {
      // Populate zone dropdown if empty
      if (this.els.zoneSelect.options.length === 0 && this.sim) {
        this.sim.getAllZones().forEach(z => {
          this.els.zoneSelect.add(new Option(`${z.name} (Floor ${z.floor})`, z.id));
        });
        this.els.zoneSelect.value = this.sim.cameraMonitoredZoneId || 'main_entrance';
      }
      this.els.zoneSelect.addEventListener('change', (e) => {
        if (this.sim) this.sim.setCameraMonitoredZone(e.target.value);
      });
    }
  }

  async loadAIModel() {
    if (typeof cocoSsd === 'undefined') {
      this.setStatus('TensorFlow COCO-SSD library not loaded. Check script tags in index.html.');
      return;
    }
    try {
      this.setStatus('Loading AI vision model...');
      this.model = await cocoSsd.load();
      this.setStatus('AI Vision Ready — Click Start Cameras to begin live tracking.');
    } catch (err) {
      this.setStatus('AI Model load failed: ' + err.message);
    }
  }

  setStatus(msg) {
    if (this.els.status) {
      this.els.status.textContent = msg;
    }
  }

  async startDualCameras() {
    try {
      this.setStatus('Requesting dual camera access...');
      // Unlock permissions and enumerate devices on localhost
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      tempStream.getTracks().forEach(t => t.stop());

      this.camList = devices.filter(d => d.kind === 'videoinput');
      if (this.camList.length < 2) {
        this.setStatus(`Only ${this.camList.length} camera found. Plug in your 2nd webcam.`);
        return;
      }

      // Switch CrowdSense engine into live camera mode automatically
      if (this.sim) {
        this.sim.setOperatingMode('camera');
        this.sim.cameraActive = true;
        if (this.els.modeToggle) this.els.modeToggle.value = 'camera';
      }

      const entryCam = this.isSwapped ? this.camList[1] : this.camList[0];
      const exitCam = this.isSwapped ? this.camList[0] : this.camList[1];

      this.isRunning = true;
      await this.openCamera('entry', entryCam);
      await this.openCamera('exit', exitCam);

      this.setStatus('Live Dual-Camera Tripwire Active (Entry +1 / Exit -1)');
    } catch (err) {
      this.setStatus(`Camera Error (${err.name}): ${err.message}`);
    }
  }

  async openCamera(type, device) {
    if (this.activeStreams[type]) {
      this.activeStreams[type].getTracks().forEach(t => t.stop());
    }

    const video = this.els[type + 'Video'];
    const canvas = this.els[type + 'Canvas'];
    const labelEl = this.els[type + 'Label'];

    if (!video || !canvas) return;

    // Exact deviceId constraint required so Chrome opens two distinct cameras
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: device.deviceId } },
      audio: false
    });

    this.activeStreams[type] = stream;
    video.srcObject = stream;
    if (labelEl) labelEl.textContent = device.label || `Camera (${type})`;

    video.onloadeddata = () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      this.detectFrame(type);
    };
  }

  stopDualCameras() {
    this.isRunning = false;
    ['entry', 'exit'].forEach(type => {
      if (this.activeStreams[type]) {
        this.activeStreams[type].getTracks().forEach(t => t.stop());
        this.activeStreams[type] = null;
      }
      const canvas = this.els[type + 'Canvas'];
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    if (this.sim) {
      this.sim.cameraActive = false;
      this.sim.setOperatingMode('simulation');
      if (this.els.modeToggle) this.els.modeToggle.value = 'simulation';
    }
    this.setStatus('Cameras stopped. Reverted to simulation mode.');
  }

  swapCameras() {
    this.isSwapped = !this.isSwapped;
    if (this.isRunning) {
      this.startDualCameras();
    }
  }

  async detectFrame(type) {
    if (!this.isRunning) return;

    const video = this.els[type + 'Video'];
    const canvas = this.els[type + 'Canvas'];
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');

    if (video.readyState === 4) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw yellow vertical tripwire line down the center
      const midX = canvas.width / 2;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, canvas.height);
      ctx.stroke();

      if (this.model) {
        const predictions = await this.model.detect(video);
        const people = predictions.filter(p => p.class === 'person' && p.score > 0.55);

        people.forEach(person => {
          const [x, y, w, h] = person.bbox;
          const centerX = x + w / 2;
          const centerY = y + h / 2;

          // Bounding box (green for entry, red for exit)
          ctx.strokeStyle = type === 'entry' ? '#10b981' : '#ef4444';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);

          // Center tracking dot
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Left-to-right tripwire crossing with 1.5s debounce
          const currentSide = centerX < midX ? 'left' : 'right';
          const now = Date.now();

          if (
            this.lastSide[type] === 'left' &&
            currentSide === 'right' &&
            now - this.lastTriggerTime[type] > 1500
          ) {
            this.lastTriggerTime[type] = now;
            if (this.sim) {
              this.sim.registerCameraDetection(type, 1);
            }
          }
          this.lastSide[type] = currentSide;
        });

        if (people.length === 0) {
          this.lastSide[type] = null;
        }
      }
    }

    requestAnimationFrame(() => this.detectFrame(type));
  }
}

// Export class to match main.js initialization: new window.AICameraMonitor(sim)
window.AICameraMonitor = AICameraMonitor;