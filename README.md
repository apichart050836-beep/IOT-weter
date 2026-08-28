# IoT Water Monitor

แดชบอร์ดตรวจสอบการใช้น้ำจากมิเตอร์ IoT (ESP32 + Flow Sensor) — Next.js + Tailwind CSS + Firebase

## Setup

### 1. สร้าง Firebase project
1. ไปที่ [Firebase Console](https://console.firebase.google.com/) → สร้างโปรเจกต์ใหม่ (ฟรี, Spark plan พอสำหรับสเกลนี้)
2. เปิดใช้ **Authentication** → Sign-in method → Email/Password → สร้างผู้ใช้ 1 คนสำหรับตัวเอง
3. เปิดใช้ **Firestore Database** (production mode)
4. ไปที่ Project settings → Your apps → เพิ่ม Web app → คัดลอกค่า config
5. ไปที่ Project settings → Service accounts → Generate new private key → ได้ไฟล์ JSON สำหรับ Admin SDK

### 2. ตั้งค่า environment variables
คัดลอก `.env.local.example` เป็น `.env.local` แล้วกรอกค่าจริงจาก Firebase Console (ไฟล์นี้ถูก gitignore ไว้แล้ว ห้าม commit)

### 3. ติดตั้ง dependencies และรัน dev server
```bash
npm install
npm run dev
```
เปิด [http://localhost:3000](http://localhost:3000) — ถ้ายังไม่ได้กรอก `.env.local` หน้า `/login` จะเตือนให้ตั้งค่าก่อน

### 4. สร้างเอกสารมิเตอร์ตัวแรกใน Firestore
ผ่าน Firebase Console → Firestore → สร้าง collection `devices` → เพิ่ม document (auto-id) พร้อมฟิลด์:
```
name: "มิเตอร์น้ำหลัก"
deviceKeyHash: "<sha256 ของ secret key ที่จะใช้ในเฟิร์มแวร์>"
createdAt: <timestamp ตอนนี้>
```
คำนวณ `deviceKeyHash` ด้วย เช่น `node -e "console.log(require('crypto').createHash('sha256').update('YOUR_SECRET_KEY').digest('hex'))"`

และสร้าง document `settings/waterRate` พร้อมฟิลด์ `pricePerCubicMeter` (number, เช่น 18)

### 5. Deploy Firestore rules และ Cloud Function
```bash
npm install -g firebase-tools   # ครั้งแรกครั้งเดียว
firebase login
firebase use --add               # เลือกโปรเจกต์ Firebase ที่สร้างไว้
firebase deploy --only firestore:rules,functions
```
Cloud Function `ingest` จะได้ URL แบบ `https://<region>-<project-id>.cloudfunctions.net/ingest`

### 6. ทดสอบส่งข้อมูลจำลอง (แทน ESP32)
```bash
curl -X POST "<ingest-function-url>" \
  -H "x-device-key: YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"flowRateLpm":5.2,"volumeLiters":0.9,"wifiRssi":-55,"batteryPercent":87}'
```
แล้วเปิดแดชบอร์ด (login แล้ว) ควรเห็นกราฟ real-time และการ์ดต่างๆ อัปเดต

## โครงสร้างโปรเจกต์
- `app/` — Next.js App Router (`/login`, dashboard ที่ `/`)
- `components/dashboard/` — การ์ดและกราฟของแดชบอร์ด
- `lib/firebase/` — Firebase client SDK (`client.ts`), Admin SDK (`admin.ts`), query helpers (`firestore.ts`)
- `functions/` — Firebase Cloud Functions (รับข้อมูลจากอุปกรณ์ IoT ผ่าน `POST /ingest`)
- `firestore.rules` — กฎความปลอดภัย (อ่านได้เฉพาะผู้ใช้ที่ login แล้ว, เขียนได้เฉพาะผ่าน Admin SDK)

## Deploy หน้าเว็บ
แนะนำ [Vercel](https://vercel.com/new) — เชื่อม repo แล้วตั้งค่า environment variables (`NEXT_PUBLIC_FIREBASE_*`) ในหน้า Project Settings ให้ตรงกับ `.env.local`
