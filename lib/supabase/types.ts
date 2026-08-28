export interface Device {
  id: string;
  name: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  lastFlowRateLpm: number | null;
  lastWifiRssi: number | null;
  lastBatteryPercent: number | null;
  // คำสั่งที่ต้องการ (desired state) — อุปกรณ์จริงจะ poll ค่านี้แล้วสั่งวาล์วให้ตรง
  valveOpen: boolean;
  targetFlowPercent: number;
  commandUpdatedAt: string | null;
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
  billingCutoffDay: number; // วันที่ตัดรอบบิลของทุกเดือน (1-28)
  updatedAt: string | null;
}

export interface RateTier {
  tierOrder: number;
  label: string;
  unitLimit: number | null; // null = ไม่จำกัด (ช่วงสุดท้าย)
  ratePerUnit: number;
}

export interface Profile {
  id: string;
  email: string;
  createdAt: string;
}
