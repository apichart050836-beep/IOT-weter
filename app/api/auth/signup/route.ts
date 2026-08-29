import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

interface SignupPayload {
  email: string;
  password: string;
}

function isValidPayload(body: unknown): body is SignupPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === "string" &&
    b.email.trim().length > 0 &&
    typeof b.password === "string" &&
    b.password.length >= 6
  );
}

// สมัครสมาชิกผ่าน admin API โดยตรง (email_confirm: true) แทนการส่งอีเมลยืนยัน
// บัญชีใหม่จะยังเข้าใช้งานไม่ได้จนกว่าแอดมินจะกดอนุมัติที่หน้า /admin (profiles.is_approved)
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user?.id }, { status: 201 });
}
