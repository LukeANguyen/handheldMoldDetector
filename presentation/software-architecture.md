# MoldGuard — Software Architecture Summary

## Overview

MoldGuard is a three-layer system: **embedded firmware** on ESP32 (or compatible boards) reads an **SHT40** humidity and temperature sensor over I²C, exposes telemetry as **JSON** over Wi‑Fi in access-point mode, and a **static web dashboard** polls that endpoint for live charts and pitch-ready analytics.

```
┌─────────────────┐     Wi‑Fi (AP)      ┌──────────────────────────────┐
│  ESP32 + SHT40  │ ─── HTTP GET /data ─▶│  Laptop / phone browser       │
│  MoldGuard_SHT40│     (JSON + CORS)   │  dashboard/index.html       │
└─────────────────┘                      │  Chart.js + pitch_data.js   │
         │                               └──────────────────────────────┘
         │ I²C
         ▼
   Sensirion SHT40
```

## Firmware (`firmware/MoldGuard_SHT40/`)

- **Sensor path:** Non-blocking SHT40 reads on a fixed cadence (`SENSOR_INTERVAL_MS`, default 500 ms) using a small state machine (trigger measure → wait conversion → read six bytes).
- **Thermal stabilization:** Raw temperature is offset by a configurable `SELF_HEAT_OFFSET_C` and smoothed with a one-pole low-pass filter to reduce enclosure and MCU self-heating effects.
- **Mold risk index:** If relative humidity is above 60% **and** temperature is above 21 °C, risk scales from 0–100 from the “excess” over those thresholds; otherwise risk is 0. Status strings map to `safe`, `high`, or `mold` for the UI.
- **Networking:** Soft AP (`WiFi.softAP`) and Arduino `WebServer` on port 80. `GET /data` returns JSON; CORS `*` allows opening the dashboard from a local file or another origin while associated to the AP.
- **Reliability:** ESP task watchdog; periodic I²C presence check for address `0x44`; on repeated read failures the bus is re-initalized and a scan is logged to Serial.

## Dashboard (`dashboard/`)

- **stack:** HTML, CSS (utility-style tokens in `styles.css`), vanilla JavaScript; **Chart.js** from CDN for two line charts.
- **Polling:** Every 500 ms, `fetch` to `{deviceBase}/data`. Last five minutes of samples are retained for CSV export (`Capture session`).
- **Demo mode:** If the device is unreachable, the app falls back to `pitch_data.js` (`MoldGuardPitch.createDemoStream`). **Force demo mode** bypasses the network entirely for presentations without hardware.

## Pitch Deck Data

- **`dashboard/pitch_data.js`** — Generates reproducible (seeded) beta statistics: kit agreement near **80%**, five micro-climate scenarios with **time-to-detection** vs lab turnaround, and Likert ease-of-use scores for 20 participants.
- **`presentation/pitch_data.json`** — Serialized snapshot from the same generator for decks or offline references.

## JSON Contract (`GET /data`)

The dashboard expects:

| Field | Type | Meaning |
|--------|------|--------|
| `temperature_c` | number | Calibrated / filtered °C |
| `humidity_pct` | number | % RH |
| `mold_risk_index` | number | 0–100 |
| `status` | string | `safe` \| `high` \| `mold` |
| `timestamp_ms` | number | Device `millis()` (relative) |
| `uptime_ms` | number | Same as timestamp in current firmware |
| `sensor_ok` | boolean | Recent successful read |
| `i2c_fail_streak` | number | Consecutive failure count (resets on success) |

## Security Note

The soft AP uses a default password in `config.h` for lab and demo use only. Change `WIFI_AP_SSID` / `WIFI_AP_PASS` before any field deployment.
