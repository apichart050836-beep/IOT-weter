-- ย้ายสิทธิ์แอดมินจาก env var (ADMIN_EMAILS) มาเก็บใน DB แทน
-- เหตุผล: ADMIN_EMAILS ตั้งไว้เฉพาะใน .env.local เครื่อง dev เท่านั้น
-- พอ deploy ขึ้น Render (หรือเครื่องอื่น) ค่านี้ไม่ได้ถูกตั้งไว้ ทำให้เช็คสิทธิ์แอดมินไม่ผ่านแม้ login ได้ปกติ
alter table profiles
  add column if not exists is_admin boolean not null default false;

update profiles set is_admin = true where email = 'suntreehouse287@gmail.com';
