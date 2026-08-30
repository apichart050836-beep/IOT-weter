-- ช่องสำหรับค่าใช้จ่ายอื่นๆ เพิ่มเติมในอนาคต (นอกเหนือจากค่าน้ำตามอัตราก้าวหน้า + ค่าบริการทั่วไป)
-- เก็บไว้ในแถวเดียวกับ water_rate_settings เริ่มต้น 0 ยังไม่มีผลอะไรจนกว่าจะตั้งค่าจริง
alter table water_rate_settings
  add column if not exists other_charges numeric not null default 0;
