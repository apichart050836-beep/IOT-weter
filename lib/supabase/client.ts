import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ใช้ placeholder ตอนยังไม่ได้ตั้งค่า .env.local เพื่อไม่ให้ createClient() throw ตอน build/SSR
// ทุกจุดที่เรียก supabase จริงต้องเช็ค isSupabaseConfigured ก่อนเสมอ
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
