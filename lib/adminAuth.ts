import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// รายชื่ออีเมลแอดมิน คั่นด้วย comma ใน .env.local เช่น ADMIN_EMAILS=a@x.com,b@y.com
// หมายเหตุ: ใช้ได้เฉพาะเครื่อง/สภาพแวดล้อมที่ตั้งค่า env นี้ไว้เท่านั้น — บน deploy อื่น (เช่น Render)
// ที่ไม่ได้ตั้ง ADMIN_EMAILS ไว้ ให้พึ่ง isAdminUser (เช็คจาก DB) แทน ซึ่งใช้ได้ทุกที่ที่ชี้ไป Supabase เดียวกัน
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

// เช็คสิทธิ์แอดมินจริง: ผ่านถ้าอยู่ใน ADMIN_EMAILS หรือมี profiles.is_admin = true
export async function isAdminUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return data?.is_admin === true;
}
