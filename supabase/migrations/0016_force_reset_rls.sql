-- 0015 ไม่ได้ผล (ทดสอบตรงแล้วยังเห็นข้ามบัญชีอยู่) แปลว่ามี policy อื่นที่ชื่อไม่ตรงกับที่เดาไว้ยังค้างอยู่
-- Postgres RLS จะอนุญาตถ้ามี policy แบบ permissive ตัวใดตัวหนึ่งอนุญาต (OR กันหมด) ต่อให้ตั้ง policy ที่ถูกต้องไว้แล้วก็ตาม
-- migration นี้จึงลบ policy ทั้งหมดที่มีอยู่จริงบนตาราง devices/readings/profiles (ไม่ว่าจะชื่ออะไร) แล้วค่อยสร้างใหม่ให้ถูกต้อง

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'devices' loop
    execute format('drop policy %I on devices', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'readings' loop
    execute format('drop policy %I on readings', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on profiles', pol.policyname);
  end loop;
end $$;

alter table devices enable row level security;
alter table readings enable row level security;
alter table profiles enable row level security;

create policy "owner read devices" on devices
  for select using (auth.uid() = owner_id);

create policy "owner update devices" on devices
  for update using (auth.uid() = owner_id);

create policy "owner read readings" on readings
  for select using (
    exists (
      select 1 from devices
      where devices.id = readings.device_id
      and devices.owner_id = auth.uid()
    )
  );

create policy "own read profile" on profiles
  for select using (auth.uid() = id);
