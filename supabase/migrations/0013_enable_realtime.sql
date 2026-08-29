-- ยืนยันแล้วว่า Supabase Realtime ไม่เคยส่ง event ให้ตาราง readings เลย (ทดสอบ subscribe แล้ว UPDATE จริง ไม่มี event เข้า)
-- สาเหตุ: ตารางยังไม่ได้ถูกเพิ่มเข้า publication "supabase_realtime" ซึ่งเป็นเงื่อนไขที่ต้องทำแยกจากการสร้างตาราง/เปิด RLS
-- แก้โดยเพิ่มตารางที่หน้าเว็บ subscribe แบบ realtime (readings, devices, water_rate_settings) เข้า publication นี้

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'readings'
  ) then
    alter publication supabase_realtime add table readings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'devices'
  ) then
    alter publication supabase_realtime add table devices;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'water_rate_settings'
  ) then
    alter publication supabase_realtime add table water_rate_settings;
  end if;
end $$;
