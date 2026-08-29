-- ตาราง readings บน DB จริงขาดคอลัมน์ wifi_rssi / battery_percent ที่โค้ด (app/api/ingest, lib/supabase/queries.ts)
-- คาดหวังว่าจะมี ทำให้การ insert reading จริงจาก ESP32 ที่ส่งค่าพวกนี้มาล้มเหลว (500) มาโดยตลอด
alter table readings
  add column if not exists wifi_rssi integer,
  add column if not exists battery_percent numeric;
