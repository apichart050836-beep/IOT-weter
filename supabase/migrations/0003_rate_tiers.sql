-- อัตราค่าน้ำประปาแบบก้าวหน้า (residential) — ย้ายจากที่ hardcode ไว้ในหน้าแดชบอร์ดมาไว้ใน DB
-- เพื่อแก้อัตราได้โดยไม่ต้องแก้โค้ด/deploy ใหม่
create table water_rate_tiers (
  id int generated always as identity primary key,
  tier_order int not null unique,
  label text not null,        -- ข้อความแสดงผลในตารางบนแดชบอร์ด
  unit_limit numeric,         -- จำนวนหน่วย (ลบ.ม.) ของช่วงนี้ — null = ไม่จำกัด (ช่วงสุดท้าย)
  rate_per_unit numeric not null
);

insert into water_rate_tiers (tier_order, label, unit_limit, rate_per_unit) values
  (1, '0 - 10 ลบ.ม. (ขั้นต้น)', 10, 10.20),
  (2, '11 - 20 ลบ.ม.', 10, 16.00),
  (3, '21 - 30 ลบ.ม.', 10, 19.00),
  (4, '31 ลบ.ม. ขึ้นไป', null, 21.20);

alter table water_rate_tiers enable row level security;
create policy "authenticated read water_rate_tiers" on water_rate_tiers
  for select using (auth.role() = 'authenticated');
