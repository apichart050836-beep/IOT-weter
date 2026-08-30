export type PipeSize = '1/2"' | '3/4"';

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
  ownerId: string | null;
  pipeSize: PipeSize; // ขนาดท่อ — มีผลกับค่าบริการทั่วไปที่ใช้คำนวณบิล
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
  serviceFee: number; // ค่าบริการทั่วไปรายเดือน สำหรับท่อ 3/4" (บาท)
  serviceFeeHalfInch: number; // ค่าบริการทั่วไปรายเดือน สำหรับท่อ 1/2" (บาท)
  otherCharges: number; // ค่าใช้จ่ายอื่นๆ เพิ่มเติม สำหรับท่อ 3/4" เริ่มต้น 0
  otherChargesHalfInch: number; // ค่าใช้จ่ายอื่นๆ เพิ่มเติม สำหรับท่อ 1/2" เริ่มต้น 0
  updatedAt: string | null;
}

export interface RateTier {
  tierOrder: number;
  label: string;
  unitLimit: number | null; // null = ไม่จำกัด (ช่วงสุดท้าย)
  ratePerUnit: number;
}

export interface DailyVolume {
  date: string; // YYYY-MM-DD ตามเวลาเครื่อง (local)
  totalLiters: number;
}

export interface LineStatus {
  lineUserId: string | null;
  lineDisplayName: string | null;
  notifyNoFlow: boolean;
  notifyLongFlow: boolean;
}
