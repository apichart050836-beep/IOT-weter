import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

interface PreferencesPayload {
  notifyNoFlow?: boolean;
  notifyLongFlow?: boolean;
}

function isValidPayload(body: unknown): body is PreferencesPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.notifyNoFlow !== undefined && typeof b.notifyNoFlow !== "boolean") return false;
  if (b.notifyLongFlow !== undefined && typeof b.notifyLongFlow !== "boolean") return false;
  return true;
}

// อัปเดตการตั้งค่ารับแจ้งเตือนของบัญชีตัวเอง (ต้องผ่าน API เพราะ profiles ไม่มี RLS update policy ให้ผู้ใช้ทั่วไป)
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

  const patch: Record<string, boolean> = {};
  if (body.notifyNoFlow !== undefined) patch.notify_no_flow = body.notifyNoFlow;
  if (body.notifyLongFlow !== undefined) patch.notify_long_flow = body.notifyLongFlow;

  const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", userData.user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
