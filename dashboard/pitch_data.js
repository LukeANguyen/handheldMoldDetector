/**
 * MoldGuard — Pitch Deck Data Module
 * Simulated beta metrics for Analytics tab & Demo Mode streaming.
 * Loaded before app.js; exposes window.MoldGuardPitch
 */
(function (global) {
  const BETA_USERS = 20;
  const KIT_AGREE_COUNT = 16; // 80% of 20 — exact count for pitch consistency

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Per-user comparison vs traditional mold test kit (binary agreement).
   */
  function generateBetaAccuracyArray(seed) {
    const rand = mulberry32(seed);
    /** Exactly KIT_AGREE_COUNT successes @ 80% for n=20, order shuffled (deterministic). */
    const flags = [];
    for (let i = 0; i < KIT_AGREE_COUNT; i++) flags.push(true);
    for (let i = 0; i < BETA_USERS - KIT_AGREE_COUNT; i++) flags.push(false);
    for (let i = flags.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = flags[i];
      flags[i] = flags[j];
      flags[j] = t;
    }
    const trials = [];
    let agree = 0;
    for (let i = 0; i < BETA_USERS; i++) {
      const matchesKit = flags[i];
      if (matchesKit) agree++;
      trials.push({
        userId: i + 1,
        matchesTraditionalKit: matchesKit,
        notes: matchesKit
          ? "MoldGuard classification aligned with kit result"
          : "Discrepancy vs kit (edge micro-climate or sampling timing)",
      });
    }
    return {
      summary: {
        participants: BETA_USERS,
        agreementWithTraditionalKit: agree / BETA_USERS,
        agreementPct: Math.round((100 * agree) / BETA_USERS),
      },
      trials,
    };
  }

  /**
   * Five micro-climate scenarios — moisture spike before visible mold.
   * timeToDetectionSec: handheld MoldGuard; traditionalHours: lab kit turnaround.
   */
  function getMicroClimateScenarios() {
    return [
      {
        id: "behind_drywall",
        label: "Behind drywall",
        peakRhPct: 78,
        ambientRhPct: 52,
        timeToDetectionSec: 4.2,
        traditionalLabHours: 60,
        narrative:
          "RH uptrend detected through vent gap before staining appeared on face paper.",
      },
      {
        id: "under_sink",
        label: "Under sink trap leak",
        peakRhPct: 85,
        ambientRhPct: 48,
        timeToDetectionSec: 3.1,
        traditionalLabHours: 54,
        narrative:
          "Localized vapor spike identified while cabinet exterior still looked dry.",
      },
      {
        id: "uninsulated_attic",
        label: "Uninsulated attic",
        peakRhPct: 72,
        ambientRhPct: 41,
        timeToDetectionSec: 4.8,
        traditionalLabHours: 72,
        narrative:
          "Seasonal dew-point crossover flagged prior to sheathing discoloration.",
      },
      {
        id: "crawlspace",
        label: "Ventilated crawlspace",
        peakRhPct: 81,
        ambientRhPct: 55,
        timeToDetectionSec: 3.6,
        traditionalLabHours: 48,
        narrative:
          "Gradient vs upstairs baseline indicated trapped moisture at rim joist.",
      },
      {
        id: "hvac_closet",
        label: "Condensate / HVAC closet",
        peakRhPct: 79,
        ambientRhPct: 46,
        timeToDetectionSec: 2.9,
        traditionalLabHours: 66,
        narrative:
          "Intermittent coil cycling produced spikes invisible to spot checks.",
      },
    ];
  }

  /**
   * Likert 1–5 ease-of-use (20 responses).
   */
  function generateLikertEaseOfUse(seed) {
    const rand = mulberry32(seed + 1337);
    const responses = [];
    const weights = [0, 0.02, 0.08, 0.35, 0.55]; // skew positive
    function sampleLikert() {
      const r = rand();
      let acc = 0;
      for (let v = 1; v <= 5; v++) {
        acc += weights[v - 1];
        if (r <= acc) return v;
      }
      return 5;
    }
    for (let i = 1; i <= BETA_USERS; i++) {
      responses.push({ userId: i, easeOfUseLikert: sampleLikert() });
    }
    const avg =
      responses.reduce((s, x) => s + x.easeOfUseLikert, 0) / responses.length;
    return { average: Number(avg.toFixed(2)), responses };
  }

  /** Demo stream: produces objects compatible with firmware /data JSON */
  function createDemoStream(seed) {
    const rand = mulberry32(seed + 999);
    let phase = 0;
    let tBase = 22 + rand() * 2;
    let rhBase = 45 + rand() * 10;

    return function nextDemoSample() {
      phase += 0.08;
      // occasional "wet microclimate" bump
      const spike = Math.sin(phase) > 0.92 ? 18 : 0;
      const noiseT = (rand() - 0.5) * 0.35;
      const noiseH = (rand() - 0.5) * 2.5;
      const temp = tBase + noiseT + spike * 0.05;
      let rh = rhBase + noiseH + spike;
      rh = Math.max(10, Math.min(95, rh));

      const risk =
        rh > 60 && temp > 21
          ? Math.min(
              100,
              ((rh - 60) / 40) * ((temp - 21) / 15) * 100 + rand() * 5
            )
          : 0;
      let status = "safe";
      if (risk > 45) status = "mold";
      else if (risk > 0.5) status = "high";

      return {
        temperature_c: Number(temp.toFixed(2)),
        humidity_pct: Number(rh.toFixed(2)),
        mold_risk_index: Number(risk.toFixed(1)),
        status,
        timestamp_ms: Date.now(),
        uptime_ms: 0,
        sensor_ok: true,
        i2c_fail_streak: 0,
        _demo: true,
      };
    };
  }

  function buildPitchDeckExport(seed) {
    const accuracy = generateBetaAccuracyArray(seed);
    const likert = generateLikertEaseOfUse(seed);
    return {
      generatedAt: new Date().toISOString(),
      pitchLine: {
        tagline: "Probability of growth in under 5 seconds vs 48–72 hour lab kits",
        speedupOrdersOfMagnitude:
          "Roughly three orders of magnitude faster feedback loop for field triage",
      },
      betaAccuracy: accuracy,
      microClimateScenarios: getMicroClimateScenarios(),
      userEaseLikert: likert,
    };
  }

  global.MoldGuardPitch = {
    generateBetaAccuracyArray,
    getMicroClimateScenarios,
    generateLikertEaseOfUse,
    createDemoStream,
    buildPitchDeckExport,
    constants: { BETA_USERS, KIT_AGREE_COUNT },
  };
})(typeof window !== "undefined" ? window : globalThis);
