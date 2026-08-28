import "server-only";
import { createClient } from "@supabase/supabase-js";

// service role key เท่านั้น — ใช้ในโค้ดฝั่ง server (API routes) เท่านั้น ห้าม import จาก client component
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export function getSupabaseAdmin() {
  if (!isSupabaseAdminConfigured) {
    throw new Error("Supabase admin client is not configured (missing env vars)");
  }
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false },
  });
}
