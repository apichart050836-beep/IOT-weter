import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

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

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id")
    .eq("device_key_hash", keyHash)
    .limit(1)
    .maybeSingle();

  if (deviceError || !device) {
    return NextResponse.json({ error: "Unknown device key" }, { status: 401 });
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

  await supabase
    .from("devices")
    .update({
      last_seen_at: now,
      last_flow_rate_lpm: flowRateLpm,
      last_wifi_rssi: wifiRssi ?? null,
      last_battery_percent: batteryPercent ?? null,
    })
    .eq("id", device.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
