-- แยกค่าใช้จ่ายอื่นๆ ตามขนาดท่อ เหมือนกับ service_fee / service_fee_half_inch
-- other_charges (เดิม) ใช้กับท่อ 3/4" ต่อไป, เพิ่มคอลัมน์ใหม่สำหรับท่อ 1/2"
alter table water_rate_settings
  add column if not exists other_charges_half_inch numeric not null default 0;
