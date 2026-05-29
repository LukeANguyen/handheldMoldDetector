(function () {
  "use strict";

  const POLL_MS = 500;
  const HISTORY_MS = 5 * 60 * 1000;
  const MAX_POINTS = Math.ceil(HISTORY_MS / POLL_MS) + 5;

  const el = (id) => document.getElementById(id);

  const state = {
    demo: false,
    forceDemo: false,
    demoNext: null,
    buffer: [],
    charts: { temp: null, rh: null },
    lastFetchOk: false,
  };

  function getBaseUrl() {
    const raw = el("deviceBase").value.trim().replace(/\/$/, "");
    return raw || "http://192.168.4.1";
  }

  function applyStatusCard(status) {
    const card = el("statusCard");
    card.classList.remove("safe", "high", "mold");
    const map = { safe: "Safe", high: "High risk", mold: "Mold conditions" };
    let cls = "safe";
    if (status === "high") cls = "high";
    if (status === "mold") cls = "mold";
    card.classList.add(cls);
    el("statusLabel").textContent = map[status] || status;
  }

  function pushSample(sample) {
    const t = sample.timestamp_ms != null ? sample.timestamp_ms : Date.now();
    state.buffer.push({
      t,
      temp: sample.temperature_c,
      rh: sample.humidity_pct,
      risk: sample.mold_risk_index,
      status: sample.status,
    });
    const cutoff = t - HISTORY_MS;
    while (state.buffer.length && state.buffer[0].t < cutoff) {
      state.buffer.shift();
    }
  }

  function updateCharts() {
    const labels = state.buffer.map((p) => {
      const d = new Date(p.t);
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });
    const temps = state.buffer.map((p) => p.temp);
    const rhs = state.buffer.map((p) => p.rh);

    const trim = (arr) => arr.slice(-MAX_POINTS);
    const lt = trim(labels);
    const tt = trim(temps);
    const tr = trim(rhs);

    state.charts.temp.data.labels = lt;
    state.charts.temp.data.datasets[0].data = tt;
    state.charts.rh.data.labels = lt;
    state.charts.rh.data.datasets[0].data = tr;
    state.charts.temp.update("none");
    state.charts.rh.update("none");
  }

  function updateMetrics(sample) {
    el("valTemp").textContent = `${Number(sample.temperature_c).toFixed(2)} °C`;
    el("valRh").textContent = `${Number(sample.humidity_pct).toFixed(1)} %`;
    el("valRisk").textContent = `${Number(sample.mold_risk_index).toFixed(1)} / 100`;
    applyStatusCard(sample.status || "safe");
  }

  function setModePill() {
    const pill = el("modePill");
    if (state.demo) {
      pill.textContent = "Demo";
      pill.className = "pill demo";
    } else {
      pill.textContent = state.lastFetchOk ? "Live" : "Offline";
      pill.className = "pill " + (state.lastFetchOk ? "live" : "demo");
    }
    el("sessionNote").textContent = state.demo
      ? "Demo Mode — simulated stream from pitch_data.js (no hardware required)."
      : "Polling /data every 500 ms. Buffer holds up to 5 minutes for CSV export.";
  }

  async function fetchSample() {
    if (state.forceDemo) {
      state.lastFetchOk = false;
      if (!state.demoNext) {
        state.demoNext = window.MoldGuardPitch.createDemoStream(42);
      }
      state.demo = true;
      return state.demoNext();
    }
    const url = `${getBaseUrl()}/data`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(to);
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      state.lastFetchOk = true;
      state.demo = false;
      state.forceDemo = false;
      return j;
    } catch {
      clearTimeout(to);
      state.lastFetchOk = false;
      if (!state.demo) {
        state.demo = true;
        state.demoNext = window.MoldGuardPitch.createDemoStream(42);
      }
      return state.demoNext();
    }
  }

  function tick() {
    fetchSample()
      .then((sample) => {
        updateMetrics(sample);
        pushSample(sample);
        updateCharts();
        setModePill();
      })
      .catch(() => {
        setModePill();
      });
  }

  function csvEscape(v) {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function captureCsv() {
    if (!state.buffer.length) {
      alert("No samples buffered yet.");
      return;
    }
    const header = ["iso_time", "unix_ms", "temp_c", "rh_pct", "mold_risk", "status"];
    const lines = [header.join(",")];
    for (const p of state.buffer) {
      lines.push(
        [
          csvEscape(new Date(p.t).toISOString()),
          p.t,
          p.temp.toFixed(2),
          p.rh.toFixed(2),
          p.risk.toFixed(1),
          csvEscape(p.status),
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `moldguard-session-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function initCharts() {
    const common = {
      type: "line",
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, color: "#94a3b8" },
            grid: { color: "rgba(71,85,105,0.35)" },
          },
          y: {
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(71,85,105,0.35)" },
          },
        },
        plugins: { legend: { display: false } },
      },
    };
    const ctxT = el("chartTemp").getContext("2d");
    const ctxR = el("chartRh").getContext("2d");
    state.charts.temp = new Chart(ctxT, {
      ...common,
      data: {
        labels: [],
        datasets: [
          {
            label: "°C",
            data: [],
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56,189,248,0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
    });
    state.charts.rh = new Chart(ctxR, {
      ...common,
      data: {
        labels: [],
        datasets: [
          {
            label: "% RH",
            data: [],
            borderColor: "#a78bfa",
            backgroundColor: "rgba(167,139,250,0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
    });
  }

  function renderAnalytics() {
    const mount = el("analyticsMount");
    const pitch = window.MoldGuardPitch.buildPitchDeckExport(2026);
    const acc = pitch.betaAccuracy;
    const scenarios = pitch.microClimateScenarios;
    const likert = pitch.userEaseLikert;

    const rows = scenarios
      .map(
        (s) => `<tr>
        <td>${escapeHtml(s.label)}</td>
        <td>${s.peakRhPct}</td>
        <td>${s.timeToDetectionSec.toFixed(1)} s</td>
        <td>${s.traditionalLabHours} h</td>
        <td>${escapeHtml(s.narrative)}</td>
      </tr>`
      )
      .join("");

    const likertRows = likert.responses
      .map(
        (r) => `<tr><td>${r.userId}</td><td>${r.easeOfUseLikert} / 5</td></tr>`
      )
      .join("");

    mount.innerHTML = `
      <div class="analytics-section">
        <h3>Beta vs traditional mold test kits</h3>
        <p class="note">Agreement rate: <strong>${acc.summary.agreementPct}%</strong> (${acc.summary.participants} participants).</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Matches kit</th><th>Notes</th></tr></thead>
            <tbody>
              ${acc.trials
                .map(
                  (t) =>
                    `<tr><td>${t.userId}</td><td>${
                      t.matchesTraditionalKit ? "Yes" : "No"
                    }</td><td>${escapeHtml(t.notes)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="analytics-section">
        <h3>Micro-climate detection (time to signal)</h3>
        <p class="note">${escapeHtml(pitch.pitchLine.tagline)}</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Scenario</th><th>Peak RH (%)</th><th>MoldGuard (s)</th><th>Lab kit (h)</th><th>Field note</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <div class="analytics-section">
        <h3>Ease of use (Likert 1–5)</h3>
        <p class="note">Mean score: <strong>${likert.average}</strong> / 5</p>
        <div class="likert-bar"><div class="likert-fill" style="width:${Math.min(
          100,
          (likert.average / 5) * 100
        )}%"></div></div>
        <div class="table-wrap" style="margin-top:0.75rem">
          <table>
            <thead><tr><th>User</th><th>Ease of use</th></tr></thead>
            <tbody>${likertRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setupTabs() {
    const tabLive = el("tabLive");
    const tabAnalytics = el("tabAnalytics");
    const panelLive = el("panelLive");
    const panelAnalytics = el("panelAnalytics");

    function activate(which) {
      const live = which === "live";
      tabLive.setAttribute("aria-selected", live);
      tabAnalytics.setAttribute("aria-selected", !live);
      panelLive.hidden = !live;
      panelAnalytics.hidden = live;
    }

    tabLive.addEventListener("click", () => activate("live"));
    tabAnalytics.addEventListener("click", () => {
      renderAnalytics();
      activate("analytics");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    setupTabs();
    el("btnCapture").addEventListener("click", captureCsv);
    el("btnDemo").addEventListener("click", () => {
      state.forceDemo = true;
      state.demo = true;
      state.demoNext = window.MoldGuardPitch.createDemoStream(Date.now() % 100000);
      state.lastFetchOk = false;
      setModePill();
      tick();
    });
    el("btnRetry").addEventListener("click", () => {
      state.demo = false;
      state.forceDemo = false;
      tick();
    });
    setInterval(tick, POLL_MS);
    tick();
  });
  // --- MOCK DATA PUMP FOR TESTING ---
function startMockPump() {
    console.log("Mock data pump started...");
    
    // Set an interval to run every 1000ms (1 second)
    setInterval(() => {
        // Generate realistic fluctuating temperature (20.0C to 25.0C)
        const mockTemp = (Math.random() * (25.0 - 20.0) + 20.0).toFixed(1);
        
        // Generate shifting humidity (55% to 65%) to test status changes
        const mockHum = (Math.random() * (65.0 - 55.0) + 55.0).toFixed(1);

        // Package it exactly how your dashboard expects it
        const mockSample = {
            timestamp_ms: Date.now(),
            temperature: parseFloat(mockTemp),
            humidity: parseFloat(mockHum)
        };

        console.log(`Pumping -> Temp: ${mockTemp}°C, Hum: ${mockHum}%`);

        // Push the fake data directly into your app's existing pipeline
        pushSample(mockSample);

        // Dynamically test your status card logic based on humidity levels
        if (mockSample.humidity > 60.0) {
            applyStatusCard("high"); // Triggers your "High risk" mold style
        } else {
            applyStatusCard("safe"); // Triggers your "Safe" style
        }

    }, 1000); 
}

// Automatically start pumping as soon as the app loads
document.addEventListener("DOMContentLoaded", startMockPump);
})();
