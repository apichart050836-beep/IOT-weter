-- วันตัดรอบบิลประจำเดือน (เช่น ตัดทุกวันที่ 5 แทนที่จะเป็นวันที่ 1 ของทุกเดือนเสมอ)
-- ผู้ใช้ตั้งค่าเองได้ผ่านหน้าแดชบอร์ด (ปุ่มเฟือง ⚙️) รีเซตรอบให้อัตโนมัติทุกเดือนตามวันที่ตั้งไว้
alter table water_rate_settings
  add column if not exists billing_cutoff_day int not null default 1
    check (billing_cutoff_day between 1 and 28); -- จำกัดที่ 28 กันปัญหาเดือน ก.พ.
