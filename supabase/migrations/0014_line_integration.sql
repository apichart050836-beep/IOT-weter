-- ผูกบัญชี LINE ของผู้ใช้ (ผ่าน LINE Login) + การตั้งค่าว่าจะรับแจ้งเตือนแบบไหนบ้าง
alter table profiles
  add column if not exists line_user_id text unique,
  add column if not exists line_display_name text,
  add column if not exists notify_no_flow boolean not null default false,
  add column if not exists notify_long_flow boolean not null default false;

-- สถานะติดตามการไหลต่อเนื่องของแต่ละอุปกรณ์ ใช้ตรวจจับ "น้ำไม่ไหล" และ "น้ำไหลนานเกิน 1 ชม." ใน /api/ingest
alter table devices
  add column if not exists flow_started_at timestamptz,
  add column if not exists no_flow_alerted_at timestamptz,
  add column if not exists long_flow_alerted_at timestamptz;
