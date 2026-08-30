import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/adminAuth";

type PipeSize = '1/2"' | '3/4"';

interface LinkPayload {
  userId: string;
  deviceId: string;
  name?: string;
  location?: string;
  pipeSize?: PipeSize;
}

function isValidPayload(body: unknown): body is LinkPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.pipeSize !== undefined && b.pipeSize !== '1/2"' && b.pipeSize !== '3/4"') return false;
  return (
    typeof b.userId === "string" &&
    b.userId.trim().length > 0 &&
    typeof b.deviceId === "string" &&
    b.deviceId.trim().length > 0
  );
}

// ผูกอุปกรณ์ที่มีอยู่แล้ว (ลงทะเบียนเองผ่าน /api/ingest) เข้ากับผู้ใช้ที่เลือก
// อัปเดตอย่างเดียว ไม่สร้างอุปกรณ์ใหม่จากหน้านี้
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

  const { userId, deviceId, name, location, pipeSize } = body;

  const { data: target, error: findError } = await supabase
    .from("devices")
    .select("id, owner_id")
    .eq("id", deviceId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "ไม่พบอุปกรณ์นี้" }, { status: 404 });
  }
  if (target.owner_id && target.owner_id !== userId) {
    return NextResponse.json({ error: "อุปกรณ์นี้ถูกผูกกับบัญชีอื่นแล้ว" }, { status: 409 });
  }

  // ถ้าผู้ใช้คนนี้มีอุปกรณ์อื่นผูกอยู่ก่อนแล้ว ให้ปลดออกก่อน (โมเดล 1 บัญชี : 1 อุปกรณ์)
  await supabase.from("devices").update({ owner_id: null }).eq("owner_id", userId).neq("id", deviceId);

  const { error: updateError } = await supabase
    .from("devices")
    .update({
      owner_id: userId,
      ...(name ? { name } : {}),
      ...(location ? { location } : {}),
      ...(pipeSize ? { pipe_size: pipeSize } : {}),
    })
    .eq("id", deviceId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deviceId });
}
