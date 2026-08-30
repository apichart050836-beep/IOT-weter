import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { pushLineMessage } from "@/lib/line";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

interface IngestPayload {
  flowRateLpm: number;
  volumeLiters: number;
  wifiRssi?: number;
  batteryPercent?: number;
}

function isValidPayload(body: unknown): body is IngestPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.flowRateLpm === "number" && typeof b.volumeLiters === "number";
}

const NO_FLOW_THRESHOLD_LPM = 1;
const LONG_FLOW_THRESHOLD_MS = 60 * 60 * 1000; // 1 ชั่วโมง

type AlertKind = "no_flow" | "long_flow";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const deviceKey = request.headers.get("x-device-key");
  if (!deviceKey) {
    return NextResponse.json({ error: "Missing x-device-key header" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const keyHash = hashKey(deviceKey);

  const { data: found, error: deviceError } = await supabase
    .from("devices")
    .select("id, owner_id, valve_open, flow_started_at, no_flow_alerted_at, long_flow_alerted_at")
    .eq("device_key_hash", keyHash)
    .limit(1)
    .maybeSingle();

  if (deviceError) {
    return NextResponse.json({ error: deviceError.message }, { status: 500 });
  }

  // ยังไม่เคยเห็น device key นี้มาก่อน → ลงทะเบียนอุปกรณ์ใหม่แบบยังไม่ผูกบัญชี (owner_id null)
  // แอดมินจะมาเลือกผูกกับผู้ใช้ทีหลังจากหน้า /admin (ไม่ต้องสร้างอุปกรณ์เองจากหน้าแอดมิน)
  let device = found;
  if (!device) {
    const { data: created, error: createError } = await supabase
      .from("devices")
      .insert({ device_key_hash: keyHash, name: "อุปกรณ์ใหม่ (รอผูกบัญชี)" })
      .select("id, owner_id, valve_open, flow_started_at, no_flow_alerted_at, long_flow_alerted_at")
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    device = created;
  }

  const { flowRateLpm, volumeLiters, wifiRssi, batteryPercent } = body;
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("readings").insert({
    device_id: device.id,
    recorded_at: now,
    flow_rate_lpm: flowRateLpm,
    volume_liters: volumeLiters,
    wifi_rssi: wifiRssi ?? null,
    battery_percent: batteryPercent ?? null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ตรวจจับ "น้ำไม่ไหล" (วาล์วเปิดแต่อัตราการไหลต่ำกว่าเกณฑ์) และ "น้ำไหลต่อเนื่องนานเกิน 1 ชม." (เฝ้าระวังน้ำรั่ว)
  const patch: Record<string, unknown> = {
    last_seen_at: now,
    last_flow_rate_lpm: flowRateLpm,
    last_wifi_rssi: wifiRssi ?? null,
    last_battery_percent: batteryPercent ?? null,
  };
  let alertKind: AlertKind | null = null;

  if (flowRateLpm < NO_FLOW_THRESHOLD_LPM) {
    if (device.flow_started_at) patch.flow_started_at = null;
    if (device.long_flow_alerted_at) patch.long_flow_alerted_at = null;
    if (device.valve_open && !device.no_flow_alerted_at) {
      patch.no_flow_alerted_at = now;
      alertKind = "no_flow";
    }
  } else {
    if (device.no_flow_alerted_at) patch.no_flow_alerted_at = null;
    if (!device.flow_started_at) {
      patch.flow_started_at = now;
    } else {
      const durationMs = new Date(now).getTime() - new Date(device.flow_started_at).getTime();
      if (durationMs > LONG_FLOW_THRESHOLD_MS && !device.long_flow_alerted_at) {
        patch.long_flow_alerted_at = now;
        alertKind = "long_flow";
      }
    }
  }

  await supabase.from("devices").update(patch).eq("id", device.id);

  if (alertKind && device.owner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("line_user_id, notify_no_flow, notify_long_flow")
      .eq("id", device.owner_id)
      .maybeSingle();

    const wantsThisAlert = alertKind === "no_flow" ? profile?.notify_no_flow : profile?.notify_long_flow;
    if (profile?.line_user_id && wantsThisAlert) {
      const message =
        alertKind === "no_flow"
          ? "🚱 แจ้งเตือน: ตรวจพบน้ำไม่ไหล (อัตราการไหลต่ำกว่า 1 ลิตร/นาที ขณะเปิดวาล์วหลัก)"
          : "⚠️ แจ้งเตือน: น้ำไหลต่อเนื่องนานเกิน 1 ชั่วโมง โปรดตรวจสอบว่ามีจุดรั่วไหลหรือไม่";
      await pushLineMessage(profile.line_user_id, message);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
