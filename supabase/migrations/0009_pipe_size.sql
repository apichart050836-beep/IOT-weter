-- ขนาดท่อของอุปกรณ์แต่ละตัว (แอดมินเลือกตอนผูกอุปกรณ์) มีผลกับค่าบริการทั่วไปที่ใช้คำนวณบิล
alter table devices
  add column if not exists pipe_size text not null default '3/4"' check (pipe_size in ('1/2"', '3/4"'));

-- ค่าบริการทั่วไปแยกตามขนาดท่อ — service_fee เดิม (ตั้งไว้ 30) ใช้กับท่อ 3/4" ต่อไป, เพิ่มค่าแยกสำหรับท่อ 1/2"
alter table water_rate_settings
  add column if not exists service_fee_half_inch numeric not null default 30;
