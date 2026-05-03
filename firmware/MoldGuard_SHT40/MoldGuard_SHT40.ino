/**
 * MoldGuard Handheld — ESP32 firmware
 * SHT40 @ I2C, WiFi AP, JSON /data, mold risk index, I2C recovery, task WDT.
 *
 * Board support: ESP32 (Arduino-ESP32 core). See README for Uno R4 WiFi notes.
 */
#include <WiFi.h>
#include <WebServer.h>
#include <esp_task_wdt.h>
#include <cstring>

#include "config.h"
#include "SHT40_driver.h"

WebServer server(80);
Sht40Async sht40;
TwoWire &i2c = Wire;

static float g_tempRawC = NAN;
static float g_rhPct = NAN;
static float g_tempCalibratedC = NAN;
static float g_tempLpfC = NAN;
static float g_moldRiskIndex = 0.0f;
static const char *g_status = "unknown";  // safe | high | mold
static uint32_t g_lastOkMs = 0;
static uint32_t g_uptimeMs = 0;
static uint32_t g_i2cFailCount = 0;
static uint32_t g_lastScanMs = 0;
static uint32_t g_lastSensorTickMs = 0;
static bool g_measInFlight = false;

static float computeMoldRisk(float tempC, float rh) {
  if (!(rh > RISK_HUMIDITY_PCT && tempC > RISK_TEMP_C)) {
    return 0.0f;
  }
  const float hSpan = 100.0f - RISK_HUMIDITY_PCT;
  const float tSpan = 40.0f - RISK_TEMP_C;
  float hEx = (rh - RISK_HUMIDITY_PCT) / hSpan;
  float tEx = (tempC - RISK_TEMP_C) / tSpan;
  if (hEx < 0.0f) hEx = 0.0f;
  if (tEx < 0.0f) tEx = 0.0f;
  if (hEx > 1.0f) hEx = 1.0f;
  if (tEx > 1.0f) tEx = 1.0f;
  return 100.0f * hEx * tEx;
}

static void updateStatus(float risk) {
  if (risk <= 0.01f) {
    g_status = "safe";
  } else if (risk < 45.0f) {
    g_status = "high";
  } else {
    g_status = "mold";
  }
}

static void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

static void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

static void handleData() {
  sendCorsHeaders();
  uint32_t now = millis();
  char buf[320];
  float tShow = g_tempLpfC;
  float rhShow = g_rhPct;
  if (isnan(tShow)) tShow = 0.0f;
  if (isnan(rhShow)) rhShow = 0.0f;

  bool sensorOk = (g_lastOkMs > 0) && ((now - g_lastOkMs) < 10000u);
  snprintf(buf, sizeof(buf),
           "{\"temperature_c\":%.2f,\"humidity_pct\":%.2f,\"mold_risk_index\":%.1f,"
           "\"status\":\"%s\",\"timestamp_ms\":%lu,\"uptime_ms\":%lu,"
           "\"sensor_ok\":%s,\"i2c_fail_streak\":%lu}",
           tShow, rhShow, g_moldRiskIndex, g_status, (unsigned long)millis(),
           (unsigned long)g_uptimeMs, sensorOk ? "true" : "false",
           (unsigned long)g_i2cFailCount);
  server.send(200, "application/json; charset=utf-8", buf);
}

static void handleRoot() {
  sendCorsHeaders();
  const char *html =
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>MoldGuard</title></head>"
      "<body style='font-family:sans-serif'>"
      "<h1>MoldGuard</h1><p>JSON: <a href=\"/data\">/data</a></p>"
      "<p>Open the dashboard <code>dashboard/index.html</code> on your laptop while "
      "connected to this AP (CORS enabled).</p></body></html>";
  server.send(200, "text/html; charset=utf-8", html);
}

static bool i2cDevicePresent(uint8_t addr) {
  i2c.beginTransmission(addr);
  return i2c.endTransmission() == 0;
}

static void i2cBusRecover() {
  Serial.println(F("[I2C] Re-initializing bus (sensor disconnect / noise)."));
  i2c.end();
  delay(20);
  i2c.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  delay(10);
  sht40.resetPhase();
  g_measInFlight = false;
}

static void i2cScanLog() {
  Serial.println(F("[I2C] Scan:"));
  uint8_t found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    if (i2cDevicePresent(a)) {
      Serial.printf("  0x%02X\n", a);
      found++;
    }
  }
  if (found == 0) Serial.println(F("  (no devices)"));
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n=== MoldGuard ESP32 boot ==="));

#if CONFIG_ESP_TASK_WDT_EN
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);
#endif

  i2c.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  sht40.begin(i2c);
  i2cScanLog();

  WiFi.mode(WIFI_AP);
  bool apOk = WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS);
  Serial.printf("[WiFi] AP %s — IP %s\n", apOk ? "OK" : "FAIL",
                WiFi.softAPIP().toString().c_str());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.println(F("[HTTP] server on :80  GET /data"));

  g_lastSensorTickMs = millis();
  g_lastScanMs = millis();
}

void loop() {
#if CONFIG_ESP_TASK_WDT_EN
  esp_task_wdt_reset();
#endif
  server.handleClient();

  uint32_t now = millis();
  g_uptimeMs = now;

  if (now - g_lastScanMs >= I2C_SCAN_INTERVAL_MS) {
    g_lastScanMs = now;
    if (!i2cDevicePresent(SHT40_I2C_ADDR)) {
      Serial.println(F("[SHT40] Address not responding — recovery."));
      i2cBusRecover();
      i2cScanLog();
    }
  }

  if (!g_measInFlight && (now - g_lastSensorTickMs >= SENSOR_INTERVAL_MS)) {
    g_lastSensorTickMs = now;
    g_measInFlight = true;
    sht40.startMeasurement();
  }

  sht40.tick();
  if (g_measInFlight && sht40.ready()) {
    g_measInFlight = false;
    float tC, rh;
    if (sht40.ok() && sht40.readResult(tC, rh)) {
      g_i2cFailCount = 0;
      g_tempRawC = tC;
      g_rhPct = rh;
      g_tempCalibratedC = tC - SELF_HEAT_OFFSET_C;
      if (isnan(g_tempLpfC)) {
        g_tempLpfC = g_tempCalibratedC;
      } else {
        g_tempLpfC = TEMP_LPF_ALPHA * g_tempCalibratedC +
                     (1.0f - TEMP_LPF_ALPHA) * g_tempLpfC;
      }
      g_moldRiskIndex = computeMoldRisk(g_tempLpfC, g_rhPct);
      updateStatus(g_moldRiskIndex);
      g_lastOkMs = now;

      Serial.printf("[SENS] T_raw=%.2f T_cal=%.2f RH=%.1f risk=%.1f %s\n", tC,
                    g_tempCalibratedC, rh, g_moldRiskIndex, g_status);
    } else {
      g_i2cFailCount++;
      Serial.printf("[SHT40] read fail (streak %lu)\n",
                    (unsigned long)g_i2cFailCount);
      sht40.resetPhase();
      if (g_i2cFailCount >= I2C_FAIL_THRESHOLD) {
        i2cBusRecover();
        i2cScanLog();
        g_i2cFailCount = 0;
      }
    }
  }

  delay(2);
}
