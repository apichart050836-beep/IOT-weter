import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

interface LinkPayload {
  deviceKey: string;
  name?: string;
  location?: string;
}

function isValidPayload(body: unknown): body is LinkPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.deviceKey === "string" && b.deviceKey.trim().length > 0;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
  const userId = userData.user.id;

  const { deviceKey, name, location } = body;
  const keyHash = hashKey(deviceKey.trim());

  const { data: existing, error: findError } = await supabase
    .from("devices")
    .select("id, owner_id")
    .eq("device_key_hash", keyHash)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.owner_id && existing.owner_id !== userId) {
      return NextResponse.json({ error: "อุปกรณ์นี้ถูกผูกกับบัญชีอื่นแล้ว" }, { status: 409 });
    }
    const { error: updateError } = await supabase
      .from("devices")
      .update({
        owner_id: userId,
        ...(name ? { name } : {}),
        ...(location ? { location } : {}),
      })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deviceId: existing.id, created: false });
  }

  const { data: created, error: insertError } = await supabase
    .from("devices")
    .insert({
      device_key_hash: keyHash,
      owner_id: userId,
      name: name || "มิเตอร์น้ำหลัก",
      location: location || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deviceId: created.id, created: true }, { status: 201 });
}
