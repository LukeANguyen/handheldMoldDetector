#ifndef MOLDGUARD_SHT40_DRIVER_H
#define MOLDGUARD_SHT40_DRIVER_H

#include <Arduino.h>
#include <Wire.h>
#include "config.h"

// Non-blocking SHT40 read: call tick() from loop(); poll ready()/get values when done.
class Sht40Async {
 public:
  enum class Phase { Idle, Triggered, WaitConversion, ReadPending, Error };

  void begin(TwoWire &w) {
    wire_ = &w;
    phase_ = Phase::Idle;
  }

  void startMeasurement() {
    if (phase_ == Phase::Triggered || phase_ == Phase::WaitConversion ||
        phase_ == Phase::ReadPending) {
      return;
    }
    phase_ = Phase::Idle;
    wire_->beginTransmission(SHT40_I2C_ADDR);
    wire_->write(SHT40_CMD_MEAS_HIGH, sizeof(SHT40_CMD_MEAS_HIGH));
    uint8_t err = wire_->endTransmission();
    if (err != 0) {
      phase_ = Phase::Error;
      return;
    }
    phase_ = Phase::Triggered;
    waitUntilMs_ = millis() + 10;  // >8.3 ms datasheet max for high precision
  }

  void tick() {
    if (phase_ == Phase::Triggered && (int32_t)(millis() - waitUntilMs_) >= 0) {
      phase_ = Phase::ReadPending;
    }
  }

  bool ready() const { return phase_ == Phase::ReadPending || phase_ == Phase::Error; }
  bool ok() const { return phase_ == Phase::ReadPending; }
  Phase phase() const { return phase_; }

  bool readResult(float &tempC, float &rhPct) {
    if (phase_ != Phase::ReadPending) {
      if (phase_ == Phase::Error) return false;
      return false;
    }
    uint8_t buf[6];
    size_t n = wire_->requestFrom((int)SHT40_I2C_ADDR, (int)sizeof(buf));
    if (n != sizeof(buf)) {
      phase_ = Phase::Error;
      return false;
    }
    for (size_t i = 0; i < sizeof(buf); i++) buf[i] = wire_->read();

    uint16_t rawT = (uint16_t(buf[0]) << 8) | buf[1];
    uint16_t rawH = (uint16_t(buf[3]) << 8) | buf[4];
    // Sensirion conversion (datasheet)
    tempC = -45.0f + 175.0f * (float(rawT) / 65535.0f);
    rhPct = -6.0f + 125.0f * (float(rawH) / 65535.0f);
    if (rhPct < 0.0f) rhPct = 0.0f;
    if (rhPct > 100.0f) rhPct = 100.0f;
    phase_ = Phase::Idle;
    return true;
  }

  void resetPhase() { phase_ = Phase::Idle; }

 private:
  TwoWire *wire_{nullptr};
  Phase phase_{Phase::Idle};
  uint32_t waitUntilMs_{0};
};

#endif
