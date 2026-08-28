-- แก้ RLS ให้บังคับสิทธิ์จริง: เห็น/แก้ไขได้เฉพาะอุปกรณ์ของตัวเอง (ตาม owner_id)
-- ก่อนหน้านี้ authenticated ทุกคนอ่าน/แก้ได้ทุก device ซึ่งเป็นช่องโหว่เมื่อเริ่มมีผู้ใช้หลายคน

drop policy if exists "authenticated read devices" on devices;
create policy "owner read devices" on devices
  for select using (auth.uid() = owner_id);

drop policy if exists "authenticated update devices" on devices;
create policy "owner update devices" on devices
  for update using (auth.uid() = owner_id);

drop policy if exists "authenticated read readings" on readings;
create policy "owner read readings" on readings
  for select using (
    exists (
      select 1 from devices
      where devices.id = readings.device_id
      and devices.owner_id = auth.uid()
    )
  );

-- หมายเหตุ: water_rate_settings / water_rate_tiers ยังเป็นค่ากลางใช้ร่วมกันทุกคนเหมือนเดิม ไม่ได้แก้
-- หมายเหตุ: การ insert readings/devices ยังทำผ่าน service role เท่านั้น (app/api/ingest, สคริปต์ seed) ไม่กระทบ
