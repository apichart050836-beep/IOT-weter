import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { ArrowRight, Camera } from "lucide-react";

export const metadata: Metadata = {
  title: "IoT Water Guard - ระบบบริหารจัดการและตรวจจับน้ำอัจฉริยะ",
  description:
    "อุปกรณ์ตรวจจับและควบคุมการไหลของน้ำ IoT Water Guard พร้อมเซนเซอร์ FS300A บอร์ด ESP32 และแจ้งเตือนผ่าน LINE Alert",
};

function hardwareImageExists(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "hardware", filename));
}

function HardwareCard({
  filename,
  alt,
  badge,
  title,
  description,
}: {
  filename: string;
  alt: string;
  badge: string;
  title: string;
  description: string;
}) {
  const exists = hardwareImageExists(filename);

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl transition hover:border-cyan-500/50">
      <div className="relative aspect-video overflow-hidden bg-slate-800">
        {exists ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/hardware/${filename}`}
            alt={alt}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-600">
            <Camera className="h-8 w-8" />
            <span className="font-mono text-xs">public/hardware/{filename}</span>
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full border border-cyan-500/30 bg-slate-950/80 px-3 py-1 font-mono text-xs text-cyan-400 backdrop-blur-md">
          {badge}
        </div>
      </div>
      <div className="p-5">
        <h3 className="mb-1 text-base font-bold text-white">{title}</h3>
        <p className="text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🌊",
    title: "วัดการไหลแม่นยำ",
    description: "ใช้ Flow Sensor รองรับอัตราไหล 1-60L/min แรงดันสูงสุด <1.20Mpa",
  },
  {
    icon: "⚙️",
    title: "บอลวาล์วมอเตอร์",
    description:
      "บอลวาล์วทองเหลืองขับเคลื่อนด้วยมอเตอร์ไฟฟ้า ตัดการทำงานนุ่มนวล ลดแรงกระแทกน้ำ",
  },
  {
    icon: "📲",
    title: "แจ้งเตือนผ่าน LINE",
    description:
      "ส่งการแจ้งเตือนทันทีผ่าน LINE Alert เมื่อพบท่อน้ำรั่ว ซึม หรือน้ำไหลผิดปกติ",
  },
  {
    icon: "☁️",
    title: "บันทึกข้อมูล Cloud",
    description:
      "ซิงค์สถานะการใช้น้ำ ขึ้นคลาวด์ดูประวัติและควบคุมเปิด-ปิดด้วยตนเอง (Manual/Auto)",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 font-bold text-white shadow-lg shadow-cyan-500/30">
              W
            </div>
            <span className="text-lg font-bold tracking-wider text-white">
              IOT WATER <span className="text-cyan-400">GUARD</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#hardware"
              className="hidden text-sm text-slate-400 transition hover:text-cyan-400 sm:block"
            >
              อุปกรณ์จริง
            </a>
            <a
              href="#features"
              className="hidden text-sm text-slate-400 transition hover:text-cyan-400 sm:block"
            >
              คุณสมบัติ
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15),transparent_50%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="mb-4 inline-block rounded-full border border-cyan-800/50 bg-cyan-950/80 px-3 py-1 font-mono text-xs font-semibold text-cyan-400">
            SMART WATER MONITORING & CONTROL DEVICE
          </span>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            อุปกรณ์ตรวจจับและควบคุมการไหลของน้ำ <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent">
              IoT Water Guard (รุ่น PVC ฟ้า1/2 และ 3/4 นิ้ว)
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base text-slate-400 sm:text-lg">
            ควบคุม บอลวาล์วทองเหลืองขับเคลื่อนด้วยมอเตอร์ พร้อมเซนเซอร์การไหลของน้ำ
            และบอร์ด ESP32 แจ้งเตือนสถานะผ่าน LINE Alert ได้ทันที
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              เข้าสู่ระบบควบคุม (Dashboard)
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#hardware"
              className="flex items-center justify-center rounded-xl border border-slate-700 px-8 py-3.5 font-bold text-slate-300 transition hover:bg-slate-900"
            >
              ดูฮาร์ดแวร์จริง
            </a>
          </div>
        </div>
      </section>

      <section id="hardware" className="border-y border-slate-800 bg-slate-900/60 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
              ฮาร์ดแวร์และการติดตั้งใช้งานจริง
            </h2>
            <p className="text-sm text-slate-400">
              การเชื่อมต่ออุปกรณ์จริงกับระบบท่อประปาบ้านและกล่องควบคุม IoT
            </p>
          </div>

          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <HardwareCard
              filename="installation.jpg"
              alt="การติดตั้ง IoT Water Guard หน้างานจริง"
              badge="LIVE INSTALLATION"
              title="ติดตั้งเข้ากับระบบท่อน้ำหลัก"
              description="รองรับการวัดแรงดันน้ำเข้าจากริมถนน ตัดการทำงานและแจ้งเตือนเข้าก๊อกน้ำภายในบ้านอัตโนมัติเมื่อพบการรั่วไหล"
            />
            <HardwareCard
              filename="components.jpg"
              alt="ส่วนประกอบอุปกรณ์ IoT Water Guard"
              badge="SYSTEM COMPONENTS"
              title="ชุดควบคุม ESP32 & Water Flow Sensor"
              description="รวมวาล์วไฟฟ้าขับเคลื่อนด้วยมอเตอร์ (DN25 PN16), เซนเซอร์ FS300A (1-60L/min) และบอร์ดควบคุมในกล่องกันน้ำ IP65"
            />
          </div>
        </div>
      </section>

      <section id="features" className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <div className="mb-2 text-xl font-bold text-cyan-400">
                  {f.icon} {f.title}
                </div>
                <p className="text-xs text-slate-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        <p>© 2026 IoT Water System - การติดตั้งได้รับการยืนยันแล้ว</p>
      </footer>
    </div>
  );
}
