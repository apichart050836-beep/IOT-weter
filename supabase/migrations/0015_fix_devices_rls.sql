-- แก้บั๊กความปลอดภัย: ตรวจพบว่า user คนหนึ่งสามารถมองเห็นอุปกรณ์ของอีกคนได้ผ่าน anon key
-- (ทดสอบตรงแล้วพบว่า RLS ไม่ได้บังคับใช้จริงตอนนี้ ไม่ทราบสาเหตุแน่ชัด อาจมีคนกดปิด RLS
-- หรือ policy เดิมถูกลบ/ทับโดยไม่ได้ตั้งใจระหว่างแก้ไขอื่นๆ) — migration นี้ตั้งค่าใหม่ทั้งหมดให้แน่นอน

alter table devices enable row level security;
alter table readings enable row level security;

drop policy if exists "authenticated read devices" on devices;
drop policy if exists "owner read devices" on devices;
create policy "owner read devices" on devices
  for select using (auth.uid() = owner_id);

drop policy if exists "authenticated update devices" on devices;
drop policy if exists "owner update devices" on devices;
create policy "owner update devices" on devices
  for update using (auth.uid() = owner_id);

drop policy if exists "authenticated read readings" on readings;
drop policy if exists "owner read readings" on readings;
create policy "owner read readings" on readings
  for select using (
    exists (
      select 1 from devices
      where devices.id = readings.device_id
      and devices.owner_id = auth.uid()
    )
  );

-- profiles เดิมให้ "authenticated" ทุกคนอ่านได้ทั้งตาราง (อีเมล/is_admin/line_user_id ของทุกคน) ตั้งแต่แรกโดยตั้งใจไว้ชั่วคราว
-- ตอนนี้ไม่มีจุดไหนในโค้ดต้องใช้แบบนั้นแล้ว (หน้า admin อ่านผ่าน service role ไม่ผ่าน RLS) จึงจำกัดให้เห็นแค่แถวตัวเอง
alter table profiles enable row level security;
drop policy if exists "authenticated read profiles" on profiles;
drop policy if exists "own read profile" on profiles;
create policy "own read profile" on profiles
  for select using (auth.uid() = id);
