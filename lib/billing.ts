import type { RateTier } from "./supabase/types";

export const DAYS_IN_PERIOD = 15;
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
  vat: number;
  grandTotal: number;
  dailyAvg: number;
}

export function calculateWaterBill(volume: number, tiers: RateTier[], serviceFee: number): BillResult {
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
  const grandTotal = waterCost + serviceFee + vat;

  return {
    volume,
    tierUsages,
    tierCosts,
    waterCost,
    serviceFee,
    vat,
    grandTotal,
    dailyAvg: grandTotal / DAYS_IN_PERIOD,
  };
}
