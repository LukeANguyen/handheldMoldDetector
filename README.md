# MoldGuard Handheld Sensing System

Full-stack project for the **MoldGuard** handheld checker: ESP32 firmware for an **SHT40** sensor, Wi‑Fi access-point hosting with a JSON `/data` API, and a browser dashboard with live charts, CSV export, and pitch-ready beta analytics.

## Repository layout

| Path | Description |
|------|-------------|
| `firmware/MoldGuard_SHT40/` | Arduino/ESP32 sketch, `config.h`, SHT40 helper |
| `dashboard/` | `index.html`, `styles.css`, `app.js`, `pitch_data.js` |
| `presentation/` | `pitch_data.json`, `software-architecture.md` |

## Wiring — SHT40 to ESP32 (I²C)

Power the breakout from **3.3 V** (not 5 V unless your module is 5 V tolerant).

| SHT40 breakout | ESP32 |
|----------------|--------|
| VIN / VCC | 3.3 V |
| GND | GND |
| SDA | GPIO **21** (default in `config.h`; change if your board differs) |
| SCL | GPIO **22** |

Use short wires and a stable ground. Most SHT40 boards include I²C pull-ups; if the bus is noisy or long, add **4.7 kΩ–10 kΩ** pull-ups to 3.3 V on SDA and SCL.

- **I²C address:** `0x44` (default; some boards offer a solder jumper for `0x45`).

## Flashing the ESP32 (Arduino IDE)

1. Install **Arduino IDE 2.x** (or 1.8.x) and add the **esp32** board package (Espressif Arduino core).
2. Select your board (e.g. **ESP32 Dev Module**) and the correct **COM port**.
3. Open `firmware/MoldGuard_SHT40/MoldGuard_SHT40.ino`.
4. Adjust `config.h` if needed: Wi‑Fi AP name/password, I²C pins, `SELF_HEAT_OFFSET_C` for your enclosure.
5. Click **Upload**.

Serial monitor at **115200** baud shows sensor lines, I²C scans, and AP IP (typically `192.168.4.1` for the soft AP).

### Arduino Uno R4 WiFi

This repository targets **ESP32** first (AP + `WebServer` + watchdog as implemented). The Uno R4 WiFi can speak I²C to the SHT40, but you would need to adapt Wi‑Fi and HTTP server APIs to the Renesas/WiFi stack your core provides; pin numbers and watchdog calls differ. Use the same JSON shape for the dashboard.

## Using the dashboard

1. Power the ESP32 and connect your PC or phone to Wi‑Fi network **`MoldGuard-AP`** (password from `config.h`, default `moldguard2026`).
2. Open `dashboard/index.html` in a browser (double-click or serve via any static file server).
3. Ensure **Device URL** is `http://192.168.4.1` (or the IP shown in Serial if you change AP settings).
4. Charts update every 500 ms. **Capture session (5 min)** downloads the buffered samples as CSV.

If the device is offline, the UI switches to **Demo Mode** using `pitch_data.js`. Use **Force demo mode** for pitches without hardware; **Retry connection** attempts live `/data` again.

## Mold risk model (firmware)

Risk is derived from the intersection of **relative humidity > 60%** and **temperature > 21 °C**, mapped to a 0–100 index and labels `safe` / `high` / `mold`. Tune thresholds in `config.h` if your clinical or field definition changes.

## Pitch narrative

Traditional mail-in kits often imply **48–72 hour** lab turnaround; MoldGuard surfaces a **probability-style risk signal in seconds** for triage. See `presentation/pitch_data.json` and the Analytics tab for simulated beta metrics.

## License

Use and modify for your product and pitch; verify sensor and RF compliance for commercial deployment.
