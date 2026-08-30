import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/adminAuth";

// รายการอุปกรณ์ที่ยังไม่ได้ผูกกับบัญชีใด (owner_id เป็น null) — มาจากการที่อุปกรณ์ยิงเข้า /api/ingest
// ครั้งแรกแล้วลงทะเบียนตัวเองอัตโนมัติแบบยังไม่มีเจ้าของ ให้แอดมินมาเลือกผูกทีหลัง
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user || !(await isAdminUser(supabase, userData.user.id, userData.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: devices, error: devicesError } = await supabase
    .from("devices")
    .select("id, name, device_key_hash, created_at, last_seen_at")
    .is("owner_id", null)
    .order("created_at", { ascending: false });

  if (devicesError) {
    return NextResponse.json({ error: devicesError.message }, { status: 500 });
  }

  return NextResponse.json({
    devices: (devices ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      deviceKeyHash: d.device_key_hash as string,
      createdAt: d.created_at as string,
      lastSeenAt: (d.last_seen_at as string) ?? null,
    })),
  });
}
