export interface Device {
  id: string;
  name: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  lastFlowRateLpm: number | null;
  lastWifiRssi: number | null;
  lastBatteryPercent: number | null;
}

export interface Reading {
  id: number;
  recordedAt: string;
  flowRateLpm: number;
  volumeLiters: number;
  wifiRssi: number | null;
  batteryPercent: number | null;
}

export interface WaterRateSettings {
  pricePerCubicMeter: number;
  updatedAt: string | null;
}
