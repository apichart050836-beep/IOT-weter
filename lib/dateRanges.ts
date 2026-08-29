export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function now(): Date {
  return new Date();
}

export function startOfDay(reference: Date = new Date()): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  return d;
}

// วันเริ่มต้นของ "รอบบิลปัจจุบัน" ตามวันตัดรอบที่ตั้งไว้ (เช่น cutoffDay=5 → รอบบิลเริ่มวันที่ 5 ของเดือน)
// ถ้าวันนี้ยังไม่ถึงวันตัดรอบของเดือนนี้ ให้ถือว่ารอบปัจจุบันเริ่มจากวันตัดรอบของเดือนก่อน
export function billingPeriodStart(cutoffDay: number, reference: Date = new Date()): Date {
  const d = new Date(reference);
  if (d.getDate() >= cutoffDay) {
    d.setDate(cutoffDay);
  } else {
    d.setMonth(d.getMonth() - 1, cutoffDay);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}
