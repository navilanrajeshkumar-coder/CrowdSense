class PicoHardwareBridge {
  constructor(simulationEngine, alertManager) {
    this.sim = simulationEngine;
    this.alerts = alertManager;
    this.port = null;
    this.writer = null;
    this.isConnected = false;
    this.gateState = 'OPEN';
    this.capacityLocked = false;
    this.evacTriggered = false;
    this.gasThreshold = 550;

    this.els = {
      connectBtn: document.getElementById('picoConnectBtn'),
      gateToggleBtn: document.getElementById('picoGateToggleBtn'),
      statusText: document.getElementById('picoStatusText'),
      gasVal: document.getElementById('picoGasVal'),
      humVal: document.getElementById('picoHumVal'),
      tempVal: document.getElementById('picoTempVal'),
      pressVal: document.getElementById('picoPressVal'),
      flameVal: document.getElementById('picoFlameVal'),
      gateBadge: document.getElementById('picoGateBadge')
    };

    this.init();
  }

  init() {
    if (this.els.connectBtn) {
      this.els.connectBtn.addEventListener('click', () => this.connect());
    }
    if (this.els.gateToggleBtn) {
      this.els.gateToggleBtn.addEventListener('click', () => {
        this.sendCommand(this.gateState === 'OPEN' ? 'CLOSE' : 'OPEN');
      });
    }

    // Auto-control Entry Gate (GP15) based on AI Camera net count
    if (this.sim) {
      this.sim.subscribe((zones) => {
        const monitored = zones[this.sim.cameraMonitoredZoneId];
        if (!monitored || !this.isConnected || this.evacTriggered) return;

        if (monitored.count > monitored.capacity && !this.capacityLocked) {
          this.capacityLocked = true;
          this.sendCommand('CLOSE');

          if (this.alerts) {
            this.alerts.addAlert({
              type: 'warning',
              title: 'CAPACITY EXCEEDED — ENTRY GATE CLOSED',
              zoneId: monitored.id,
              message: `${monitored.name} reached ${monitored.count}/${monitored.capacity} people. Entry gate closed automatically.`
            });
          }
        } else if (monitored.count <= monitored.capacity && this.capacityLocked) {
          this.capacityLocked = false;
          this.sendCommand('OPEN');
        }
      });
    }
  }

  async connect() {
    if (!('serial' in navigator)) {
      alert('Web Serial requires Google Chrome or Edge.');
      return;
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      const encoder = new TextEncoderStream();
      encoder.readable.pipeTo(this.port.writable);
      this.writer = encoder.writable.getWriter();

      this.isConnected = true;
      if (this.els.statusText) this.els.statusText.textContent = 'Pico Connected — Live Sensors & Entry Gate Synced';
      if (this.els.connectBtn) this.els.connectBtn.textContent = 'Connected';

      this.readLoop();
    } catch (err) {
      if (this.els.statusText) this.els.statusText.textContent = 'Connection failed: ' + err.message;
    }
  }

  async readLoop() {
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const clean = line.trim();
          if (clean.startsWith('DATA:')) {
            const parts = clean.replace('DATA:', '').split(',');
            this.handleTelemetry({
              gas: Number(parts[0]),
              hum: Number(parts[1]),
              temp: Number(parts[2]),
              pressure: Number(parts[3] || 1013.2),
              flameFood: Number(parts[4] || 0),
              flameCinema: Number(parts[5] || 0),
              gate: parts[6] || 'OPEN'
            });
          }
        }
      }
    } catch (err) {
      this.isConnected = false;
      if (this.els.statusText) this.els.statusText.textContent = 'Pico disconnected';
    }
  }

  handleTelemetry(data) {
    if (this.els.gasVal) this.els.gasVal.textContent = `${data.gas} ppm`;
    if (this.els.humVal) this.els.humVal.textContent = `${data.hum}%`;
    if (this.els.tempVal) this.els.tempVal.textContent = `${data.temp}°C`;
    if (this.els.pressVal) this.els.pressVal.textContent = `${data.pressure} hPa`;

    this.gateState = data.gate;
    if (this.els.gateBadge) {
      this.els.gateBadge.textContent = `ENTRY GATE: ${data.gate}`;
      this.els.gateBadge.style.color = data.gate === 'CLOSED' ? '#ef4444' : '#10b981';
    }

    const fireZone = data.flameFood ? 'food_court' : (data.flameCinema ? 'cinema' : null);
    if (this.els.flameVal) {
      this.els.flameVal.textContent = fireZone ? 'FIRE DETECTED' : 'CLEAR';
      this.els.flameVal.style.color = fireZone ? '#ef4444' : '#10b981';
    }

    if ((fireZone || data.gas >= this.gasThreshold) && !this.evacTriggered) {
      this.evacTriggered = true;
      this.sendCommand('EVAC');

      const evacBtn = document.querySelector('[data-scenario="evacuation"]');
      if (evacBtn) evacBtn.click();

      if (this.alerts) {
        this.alerts.addAlert({
          type: 'critical',
          title: fireZone ? 'FLAME SENSOR ALERT — EVACUATING' : 'CRITICAL SMOKE ALERT — EVACUATING',
          zoneId: fireZone || 'food_court',
          message: fireZone
            ? `Infrared flame detected in ${fireZone.replace('_', ' ')}. Entry gate opened and buzzer activated.`
            : `MQ-2 smoke spike (${data.gas} ppm). Entry gate opened.`
        });
      }
    } else if (!fireZone && data.gas < this.gasThreshold) {
      this.evacTriggered = false;
    }
  }

  async sendCommand(cmd) {
    if (this.writer) {
      await this.writer.write(cmd + '\n');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mallPico = new PicoHardwareBridge(window.crowdSim, window.mallAlerts);
});
