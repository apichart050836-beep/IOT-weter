import { supabase } from "./client";
import type { Device, Reading, WaterRateSettings, RateTier, DailyVolume, LineStatus } from "./types";

function toDevice(row: Record<string, unknown>): Device {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "มิเตอร์น้ำหลัก",
    location: (row.location as string) ?? null,
    firmwareVersion: (row.firmware_version as string) ?? null,
    lastSeenAt: (row.last_seen_at as string) ?? null,
    lastFlowRateLpm: (row.last_flow_rate_lpm as number) ?? null,
    lastWifiRssi: (row.last_wifi_rssi as number) ?? null,
    lastBatteryPercent: (row.last_battery_percent as number) ?? null,
    valveOpen: (row.valve_open as boolean) ?? true,
    targetFlowPercent: (row.target_flow_percent as number) ?? 100,
    commandUpdatedAt: (row.command_updated_at as string) ?? null,
    ownerId: (row.owner_id as string) ?? null,
    pipeSize: (row.pipe_size as Device["pipeSize"]) ?? '3/4"',
  };
}

function toReading(row: Record<string, unknown>): Reading {
  return {
    id: row.id as number,
    recordedAt: row.recorded_at as string,
    flowRateLpm: row.flow_rate_lpm as number,
    volumeLiters: row.volume_liters as number,
    wifiRssi: (row.wifi_rssi as number) ?? null,
    batteryPercent: (row.battery_percent as number) ?? null,
  };
}

// สเกลปัจจุบันมีมิเตอร์เดียว: ดึง device แรกที่มีอยู่
export async function getPrimaryDeviceId(): Promise<string | null> {
  const { data } = await supabase.from("devices").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  const { data } = await supabase.from("devices").select("*").eq("id", deviceId).maybeSingle();
  return data ? toDevice(data) : null;
}

export function subscribeDevice(deviceId: string, callback: (device: Device | null) => void) {
  supabase
    .from("devices")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle()
    .then(({ data }) => callback(data ? toDevice(data) : null));

  const channel = supabase
    .channel(`device-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "devices", filter: `id=eq.${deviceId}` },
      (payload) => callback(payload.new ? toDevice(payload.new as Record<string, unknown>) : null)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeLatestReadings(
  deviceId: string,
  maxPoints: number,
  callback: (readings: Reading[]) => void
) {
  async function loadInitial() {
    const { data } = await supabase
      .from("readings")
      .select("*")
      .eq("device_id", deviceId)
      .order("recorded_at", { ascending: false })
      .limit(maxPoints);
    callback((data ?? []).map(toReading).reverse());
  }
  loadInitial();

  const channel = supabase
    .channel(`readings-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "readings", filter: `device_id=eq.${deviceId}` },
      () => loadInitial()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// แจ้งเตือนเฉยๆ ว่า readings ของ device นี้เปลี่ยน (insert/update/delete) โดยไม่ดึงข้อมูลมาเอง
// ใช้สำหรับ trigger ให้โค้ดที่คำนวณผลรวม (เช่นยอดใช้น้ำสะสม) โหลดใหม่ทันทีแทนที่จะรอ interval
export function subscribeReadingsChanged(deviceId: string, callback: () => void) {
  const channel = supabase
    .channel(`readings-changed-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "readings", filter: `device_id=eq.${deviceId}` },
      () => callback()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// เขียนคำสั่งที่ต้องการ (desired state) ให้อุปกรณ์จริง poll ไปทำตาม
export async function setDeviceCommand(
  deviceId: string,
  command: { valveOpen?: boolean; targetFlowPercent?: number }
): Promise<void> {
  const patch: Record<string, unknown> = { command_updated_at: new Date().toISOString() };
  if (command.valveOpen !== undefined) patch.valve_open = command.valveOpen;
  if (command.targetFlowPercent !== undefined) patch.target_flow_percent = command.targetFlowPercent;

  const { error } = await supabase.from("devices").update(patch).eq("id", deviceId);
  if (error) throw error;
}

export async function getVolumeSum(deviceId: string, start: Date, end: Date): Promise<number> {
  const { data } = await supabase
    .from("readings")
    .select("volume_liters")
    .eq("device_id", deviceId)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());

  return (data ?? []).reduce((sum, row) => sum + (row.volume_liters as number), 0);
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// รวมปริมาณน้ำ (ลิตร) เป็นรายวัน ย้อนหลัง `days` วัน (รวมวันนี้) เรียงจากเก่าไปใหม่ เติม 0 ให้วันที่ไม่มีข้อมูล
export async function getDailyVolumeTotals(deviceId: string, days: number): Promise<DailyVolume[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("readings")
    .select("recorded_at, volume_liters")
    .eq("device_id", deviceId)
    .gte("recorded_at", start.toISOString());

  const totals = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    totals.set(localDateKey(d), 0);
  }

  for (const row of data ?? []) {
    const key = localDateKey(new Date(row.recorded_at as string));
    if (totals.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + (row.volume_liters as number));
    }
  }

  return Array.from(totals.entries()).map(([date, totalLiters]) => ({ date, totalLiters }));
}

export function subscribeWaterRate(callback: (settings: WaterRateSettings) => void) {
  function toSettings(row: Record<string, unknown> | null): WaterRateSettings {
    return {
      pricePerCubicMeter: (row?.price_per_cubic_meter as number) ?? 18.0,
      billingCutoffDay: (row?.billing_cutoff_day as number) ?? 1,
      serviceFee: (row?.service_fee as number) ?? 30,
      serviceFeeHalfInch: (row?.service_fee_half_inch as number) ?? 30,
      updatedAt: (row?.updated_at as string) ?? null,
    };
  }

  supabase
    .from("water_rate_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle()
    .then(({ data }) => callback(toSettings(data)));

  const channel = supabase
    .channel("water-rate-settings")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "water_rate_settings", filter: "id=eq.1" },
      (payload) => callback(toSettings(payload.new as Record<string, unknown>))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function setBillingCutoffDay(day: number): Promise<void> {
  const { error } = await supabase
    .from("water_rate_settings")
    .update({ billing_cutoff_day: day, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export async function getRateTiers(): Promise<RateTier[]> {
  const { data } = await supabase
    .from("water_rate_tiers")
    .select("*")
    .order("tier_order", { ascending: true });

  return (data ?? []).map((row) => ({
    tierOrder: row.tier_order as number,
    label: row.label as string,
    unitLimit: (row.unit_limit as number) ?? null,
    ratePerUnit: row.rate_per_unit as number,
  }));
}

export async function getLineStatus(userId: string): Promise<LineStatus | null> {
  const { data } = await supabase
    .from("profiles")
    .select("line_user_id, line_display_name, notify_no_flow, notify_long_flow")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    lineUserId: (data.line_user_id as string) ?? null,
    lineDisplayName: (data.line_display_name as string) ?? null,
    notifyNoFlow: (data.notify_no_flow as boolean) ?? false,
    notifyLongFlow: (data.notify_long_flow as boolean) ?? false,
  };
}
