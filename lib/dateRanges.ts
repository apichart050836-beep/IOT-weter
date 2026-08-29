export function now(): Date {
  return new Date();
}

const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

function toBangkokParts(reference: Date) {
  const bangkok = new Date(reference.getTime() + THAILAND_OFFSET_MS);
  return { y: bangkok.getUTCFullYear(), m: bangkok.getUTCMonth(), d: bangkok.getUTCDate() };
}

function bangkokMidnightUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - THAILAND_OFFSET_MS);
}

// เที่ยงคืนของ "วันนี้" ตามเวลาไทย — ใช้ได้ทั้งฝั่ง client (เวลาเครื่อง = เวลาไทยอยู่แล้ว)
// และฝั่ง server ที่ timezone อาจไม่ใช่เวลาไทย (เช่น Render มักรันเป็น UTC)
export function thailandStartOfDay(reference: Date = new Date()): Date {
  const { y, m, d } = toBangkokParts(reference);
  return bangkokMidnightUtc(y, m, d);
}

export function thailandStartOfMonth(reference: Date = new Date()): Date {
  const { y, m } = toBangkokParts(reference);
  return bangkokMidnightUtc(y, m, 1);
}

// วันเริ่มต้นของ "รอบบิลปัจจุบัน" ตามวันตัดรอบที่ตั้งไว้ (เช่น cutoffDay=5 → รอบบิลเริ่มวันที่ 5 ของเดือน) ตามเวลาไทย
// ถ้าวันนี้ยังไม่ถึงวันตัดรอบของเดือนนี้ ให้ถือว่ารอบปัจจุบันเริ่มจากวันตัดรอบของเดือนก่อน
export function billingPeriodStart(cutoffDay: number, reference: Date = new Date()): Date {
  const { y, m, d } = toBangkokParts(reference);
  if (d >= cutoffDay) return bangkokMidnightUtc(y, m, cutoffDay);
  const prevMonth = new Date(Date.UTC(y, m, 1));
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  return bangkokMidnightUtc(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), cutoffDay);
}
