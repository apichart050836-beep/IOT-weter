import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { exchangeLineLoginCode, getLineProfile, isLineLoginConfigured } from "@/lib/line";

interface LinkPayload {
  code: string;
  redirectUri: string;
}

function isValidPayload(body: unknown): body is LinkPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.code === "string" && b.code.length > 0 && typeof b.redirectUri === "string" && b.redirectUri.length > 0;
}

// ผูกบัญชี LINE ของผู้ใช้ที่ login อยู่ กับ profile ผ่าน LINE Login OAuth code (แลกจากฝั่ง client หลัง redirect กลับมา)
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }
  if (!isLineLoginConfigured) {
    return NextResponse.json({ error: "LINE Login ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์" }, { status: 503 });
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

  let lineProfile;
  try {
    const tokenData = await exchangeLineLoginCode(body.code, body.redirectUri);
    lineProfile = await getLineProfile(tokenData.access_token);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "LINE login failed" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("line_user_id", lineProfile.userId)
    .maybeSingle();

  if (existing && existing.id !== userData.user.id) {
    return NextResponse.json({ error: "บัญชี LINE นี้ถูกผูกกับบัญชีอื่นแล้ว" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ line_user_id: lineProfile.userId, line_display_name: lineProfile.displayName })
    .eq("id", userData.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, displayName: lineProfile.displayName });
}
