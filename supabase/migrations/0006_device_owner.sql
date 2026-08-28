-- ผูก device เข้ากับผู้ใช้ที่เป็นเจ้าของ (สำหรับใช้งานในอนาคต เช่น กรองอุปกรณ์ตามผู้ใช้)
-- ตอนนี้ dashboard ยังไม่กรองตาม owner_id — ทุกคนที่ login แล้วยังเห็น device แรกที่เจอเหมือนเดิม
alter table devices
  add column if not exists owner_id uuid references profiles(id) on delete set null;
