# IoT Water Guard

ระบบตรวจจับและควบคุมการไหลของน้ำแบบ IoT — Next.js + Tailwind CSS + Supabase

## โครงสร้างเว็บ
- `/` — หน้า Landing แนะนำผลิตภัณฑ์/ฮาร์ดแวร์
- `/login` — เข้าสู่ระบบ (รองรับ Supabase Auth จริง หรือบัญชีทดสอบถ้ายังไม่ได้ตั้งค่า)
- `/dashboard` — แดชบอร์ดควบคุม (Digital Gauge, ควบคุมวาล์ว, กราฟ real-time, คำนวณค่าน้ำ, แจ้งเตือนผ่าน LINE)

## Setup

### 1. ติดตั้ง dependencies และรัน dev server
```bash
npm install
npm run dev
```
เปิด [http://localhost:3000](http://localhost:3000) — ตอนนี้ยังไม่ได้ตั้งค่า Supabase ก็ใช้งานได้เลยผ่าน**บัญชีทดสอบ**:
- หน้า `/login` จะมีปุ่ม "กรอกให้อัตโนมัติ + เข้าสู่ระบบด้วยบัญชีทดสอบ" (บัญชี `admintest`, ดูรหัสผ่านได้ที่ `lib/demoAuth.ts`)

### 2. สร้าง Supabase project (เมื่อพร้อมใช้ข้อมูลจริง)
1. ไปที่ [supabase.com](https://supabase.com/) → New project
2. เปิดใช้ **Authentication** → Providers → Email → สร้างผู้ใช้ 1 คนสำหรับตัวเอง (Authentication → Users → Add user)
3. ไปที่ SQL Editor → รันไฟล์ `supabase/migrations/0001_init.sql` เพื่อสร้างตาราง `devices`, `readings`, `water_rate_settings`
4. ไปที่ Project Settings → API → คัดลอก **Project URL**, **anon public key**, และ **service_role key**

### 3. ตั้งค่า environment variables
คัดลอก `.env.local.example` เป็น `.env.local` แล้วกรอกค่าจาก Supabase (ไฟล์นี้ถูก gitignore ไว้แล้ว ห้าม commit ค่าจริง):
```
NEXT_PUBLIC_SKIP_AUTH=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
รีสตาร์ท dev server หลังแก้ `.env.local`

### 4. เพิ่มมิเตอร์ตัวแรก
ผ่าน Supabase Table Editor → ตาราง `devices` → เพิ่มแถวใหม่:
```
name: "มิเตอร์น้ำหลัก"
device_key_hash: <sha256 ของ secret key ที่จะใช้ในเฟิร์มแวร์>
```
คำนวณ `device_key_hash` ด้วยเช่น:
```bash
node -e "console.log(require('crypto').createHash('sha256').update('YOUR_SECRET_KEY').digest('hex'))"
```

### 5. ทดสอบส่งข้อมูลจำลอง (แทน ESP32)
อุปกรณ์ยิงข้อมูลเข้า Next.js API route `/api/ingest` ตรงๆ (deploy พร้อมกับเว็บ ไม่ต้องตั้งค่าแยก):
```bash
curl -X POST "http://localhost:3000/api/ingest" \
  -H "x-device-key: YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"flowRateLpm":5.2,"volumeLiters":0.9,"wifiRssi":-55,"batteryPercent":87}'
```

## โครงสร้างโปรเจกต์
- `app/page.tsx` — หน้า Landing
- `app/login/page.tsx` — หน้า login (Supabase Auth + fallback บัญชีทดสอบ)
- `app/dashboard/` — แดชบอร์ดควบคุม (auth guard ใน `layout.tsx`, เนื้อหาใน `page.tsx`)
- `app/api/ingest/route.ts` — API route รับข้อมูลจากอุปกรณ์ IoT
- `lib/supabase/` — Supabase client (`client.ts`), admin client สำหรับ server (`admin.ts`), query helpers (`queries.ts`)
- `lib/demoAuth.ts` — บัญชีทดสอบสำหรับลองระบบก่อนตั้งค่า Supabase จริง
- `supabase/migrations/0001_init.sql` — schema ฐานข้อมูล + Row Level Security

## รันแบบไม่ต้องเปิด terminal เอง
- ดับเบิลคลิก `run.bat` — เปิด dev server (auto-restart ถ้า crash) แล้วเปิดเบราว์เซอร์ไปที่ `/dashboard` ให้อัตโนมัติ
- ดับเบิลคลิก `git-push.bat` — `git add` + `commit` + `push` ในคลิกเดียว (ถามข้อความ commit ก่อน)

## Deploy
- **หน้าเว็บ**: แนะนำ [Vercel](https://vercel.com/new) หรือ Render — ตั้งค่า Environment Variables ให้ตรงกับ `.env.local`, Build Command: `npm install && npm run build`, Start Command: `npm run start`
- **Database**: Supabase (ไม่ต้อง deploy แยก ใช้ project เดียวกับตอน dev ได้เลย หรือสร้าง project แยกสำหรับ production)
