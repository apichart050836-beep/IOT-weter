-- เปลี่ยนการสมัครสมาชิกจากต้องยืนยันอีเมล มาเป็นต้องรอแอดมินอนุมัติที่หน้า /admin แทน
alter table profiles
  add column if not exists is_approved boolean not null default false;

-- ผู้ใช้ที่มีอยู่แล้วก่อนระบบอนุมัตินี้ ถือว่าอนุมัติแล้วทั้งหมด (ไม่ต้องรออนุมัติย้อนหลัง)
update profiles set is_approved = true;
