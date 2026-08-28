-- เพิ่มคอลัมน์ "คำสั่งที่ต้องการ" (desired state) ลงในตาราง devices
-- ใช้สำหรับ Master Valve toggle + Flow Rate slider บนแดชบอร์ด
-- อุปกรณ์จริง (ESP32) จะ poll ค่านี้เป็นระยะแล้วสั่งวาล์วให้ตรงกับที่ตั้งไว้
alter table devices
  add column if not exists valve_open boolean not null default true,
  add column if not exists target_flow_percent int not null default 100
    check (target_flow_percent between 0 and 100),
  add column if not exists command_updated_at timestamptz not null default now();

-- อนุญาตให้ authenticated user (ผู้ดูแลระบบที่ login แล้ว) แก้ไขคำสั่งวาล์วได้
create policy "authenticated update devices" on devices
  for update using (auth.role() = 'authenticated');
