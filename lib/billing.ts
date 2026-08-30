import type { RateTier } from "./supabase/types";

export const DEFAULT_SERVICE_FEE = 30;
export const VAT_RATE = 0.07;

export const DEFAULT_TIERS: RateTier[] = [
  { tierOrder: 1, label: "0 - 10 ลบ.ม. (ขั้นต้น)", unitLimit: 10, ratePerUnit: 10.2 },
  { tierOrder: 2, label: "11 - 20 ลบ.ม.", unitLimit: 10, ratePerUnit: 16.0 },
  { tierOrder: 3, label: "21 - 30 ลบ.ม.", unitLimit: 10, ratePerUnit: 19.0 },
  { tierOrder: 4, label: "31 ลบ.ม. ขึ้นไป", unitLimit: null, ratePerUnit: 21.2 },
];

export interface BillResult {
  volume: number;
  tierUsages: number[];
  tierCosts: number[];
  waterCost: number;
  serviceFee: number;
  otherCharges: number;
  vat: number;
  grandTotal: number;
  dailyAvg: number;
}

export function calculateWaterBill(
  volume: number,
  tiers: RateTier[],
  serviceFee: number,
  daysInPeriod: number,
  otherCharges: number = 0
): BillResult {
  // ไม่ใช้น้ำเลย = ไม่เก็บค่าอะไรทั้งสิ้น (รวมค่าบริการทั่วไปและค่าอื่นๆ ด้วย)
  if (volume <= 0) {
    return {
      volume: 0,
      tierUsages: tiers.map(() => 0),
      tierCosts: tiers.map(() => 0),
      waterCost: 0,
      serviceFee: 0,
      otherCharges: 0,
      vat: 0,
      grandTotal: 0,
      dailyAvg: 0,
    };
  }

  let remaining = volume;
  let waterCost = 0;
  const tierUsages = tiers.map(() => 0);
  const tierCosts = tiers.map(() => 0);

  tiers.forEach((tier, i) => {
    if (remaining > 0) {
      const take = Math.min(remaining, tier.unitLimit ?? Infinity);
      tierUsages[i] = take;
      tierCosts[i] = take * tier.ratePerUnit;
      waterCost += tierCosts[i];
      remaining -= take;
    }
  });

  const vat = (waterCost + serviceFee) * VAT_RATE;
  const grandTotal = waterCost + serviceFee + vat + otherCharges;

  return {
    volume,
    tierUsages,
    tierCosts,
    waterCost,
    serviceFee,
    otherCharges,
    vat,
    grandTotal,
    dailyAvg: grandTotal / Math.max(1, daysInPeriod),
  };
}
