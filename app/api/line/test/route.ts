import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { pushLineMessage, isLineMessagingConfigured } from "@/lib/line";

// ส่งข้อความทดสอบไปยังบัญชี LINE ของผู้ใช้เอง เพื่อยืนยันว่าเชื่อมต่อ + ตั้งค่า Messaging API ถูกต้อง
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }
  if (!isLineMessagingConfigured) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า LINE Messaging API บนเซิร์ฟเวอร์" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile?.line_user_id) {
    return NextResponse.json({ error: "บัญชีนี้ยังไม่ได้เชื่อมต่อ LINE" }, { status: 400 });
  }

  const result = await pushLineMessage(profile.line_user_id, "✅ ทดสอบการเชื่อมต่อระบบ IoT Water Flow Monitoring สำเร็จ!");
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "ส่งข้อความไม่สำเร็จ" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
