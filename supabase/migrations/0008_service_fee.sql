-- ย้ายค่าบริการทั่วไป (service fee) จากค่าคงที่ในโค้ดมาเก็บใน DB แทน แก้ได้จากส่วนกลางในอนาคต
alter table water_rate_settings
  add column if not exists service_fee numeric not null default 30;

update water_rate_settings set service_fee = 30 where id = 1;
