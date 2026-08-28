import type { Timestamp } from "firebase/firestore";

export interface Device {
  id: string;
  name: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: Timestamp | null;
  lastFlowRateLpm: number | null;
  lastWifiRssi: number | null;
  lastBatteryPercent: number | null;
}

export interface Reading {
  id: string;
  recordedAt: Timestamp;
  flowRateLpm: number;
  volumeLiters: number;
  wifiRssi: number | null;
  batteryPercent: number | null;
}

export interface WaterRateSettings {
  pricePerCubicMeter: number;
  updatedAt: Timestamp | null;
}
