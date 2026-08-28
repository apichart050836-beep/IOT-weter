"use client";

import Link from "next/link";
import { useSession } from "@/lib/useSession";

export default function AdminPage() {
  const { signOut } = useSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 text-center text-slate-100">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-2xl font-bold shadow-lg shadow-cyan-500/30">
        A
      </div>
      <h1 className="text-xl font-bold">หน้าแอดมิน</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        อยู่ระหว่างพัฒนา — จะใช้จัดการรายชื่อผู้สมัคร, อุปกรณ์, และการตั้งค่าระบบในอนาคต
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          ไปหน้าแดชบอร์ด
        </Link>
        <button
          onClick={signOut}
          className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/60"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
