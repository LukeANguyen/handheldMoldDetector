#ifndef MOLDGUARD_CONFIG_H
#define MOLDGUARD_CONFIG_H

// -----------------------------------------------------------------------------
// MoldGuard — WiFi AP & I2C (ESP32). Adjust for your board / wiring.
// -----------------------------------------------------------------------------

// Access Point (client connects here to read /data and optionally load dashboard)
static const char *const WIFI_AP_SSID = "MoldGuard-AP";
static const char *const WIFI_AP_PASS = "moldguard2026";  // min 8 chars for WPA2

// I2C — SHT40 default address 0x44 (leave pins per your ESP32 module)
static const int PIN_I2C_SDA = 21;
static const int PIN_I2C_SCL = 22;
static const uint8_t SHT40_I2C_ADDR = 0x44;

// SHT40: high-precision measure command (max ~8.3 ms)
static const uint8_t SHT40_CMD_MEAS_HIGH[] = {0xFD};

// Thermal stabilization: subtract estimated self-heating from enclosure/MCU (tune in field)
static const float SELF_HEAT_OFFSET_C = 2.4f;
// First-order low-pass on calibrated temperature (0..1, higher = smoother)
static const float TEMP_LPF_ALPHA = 0.35f;

// Sensor poll interval (non-blocking scheduler)
static const uint32_t SENSOR_INTERVAL_MS = 500;

// Mold risk thresholds (spec)
static const float RISK_HUMIDITY_PCT = 60.0f;
static const float RISK_TEMP_C = 21.0f;

// I2C recovery
static const uint8_t I2C_FAIL_THRESHOLD = 5;
static const uint32_t I2C_SCAN_INTERVAL_MS = 2000;

// Watchdog timeout (seconds) before soft reset
static const uint32_t WDT_TIMEOUT_SEC = 30;

#endif
