import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/adminAuth";

interface UnlinkPayload {
  deviceId: string;
}

function isValidPayload(body: unknown): body is UnlinkPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.deviceId === "string" && b.deviceId.trim().length > 0;
}

// ปลดอุปกรณ์ออกจากบัญชีที่ผูกอยู่ (owner_id -> null) กลับไปอยู่ในกลุ่มอุปกรณ์ที่ยังไม่ได้ผูก
// ไม่ลบอุปกรณ์หรือประวัติการใช้น้ำ
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
  const { data: callerData, error: callerError } = await supabase.auth.getUser(accessToken);
  if (callerError || !callerData.user || !(await isAdminUser(supabase, callerData.user.id, callerData.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("devices")
    .update({ owner_id: null })
    .eq("id", body.deviceId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
