"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { demoLogin, DEMO_USERNAME, DEMO_PASSWORD } from "@/lib/demoAuth";

// ตรงกับ SKIP_AUTH ใน app/dashboard/layout.tsx — ปิดหน้า login ชั่วคราวเมื่อ bypass auth อยู่
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (SKIP_AUTH) router.replace("/dashboard");
  }, [router]);

  if (SKIP_AUTH) return null;

  async function attemptLogin(username: string, pass: string) {
    setError(null);
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: username,
          password: pass,
        });
        if (signInError) throw signInError;
      } else {
        if (!demoLogin(username, pass)) {
          throw new Error("invalid demo credentials");
        }
      }
      router.push("/dashboard");
    } catch {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    attemptLogin(email, password);
  }

  function handleQuickLogin() {
    setEmail(DEMO_USERNAME);
    setPassword(DEMO_PASSWORD);
    attemptLogin(DEMO_USERNAME, DEMO_PASSWORD);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100 antialiased">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/30">
            A
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-white">
            AQUA<span className="text-cyan-400">CONTROL</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            กรอกข้อมูลผู้ใช้งานเพื่อเข้าสู่ระบบควบคุมวาล์ว
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {!isSupabaseConfigured && (
            <div className="mb-5 space-y-2 rounded-lg bg-amber-950/40 px-3 py-2.5 text-sm text-amber-300 ring-1 ring-amber-800/50">
              <p>
                โหมดทดสอบ (ยังไม่ได้ตั้งค่า Supabase) — ใช้บัญชีทดสอบ{" "}
                <code className="rounded bg-amber-900/50 px-1">{DEMO_USERNAME}</code> เข้าสู่ระบบได้เลย
              </p>
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={loading}
                className="w-full rounded-lg border border-amber-700/50 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/70 disabled:opacity-60"
              >
                กรอกให้อัตโนมัติ + เข้าสู่ระบบด้วยบัญชีทดสอบ
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                ชื่อผู้ใช้ / อีเมล
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aquacontrol.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                  รหัสผ่าน
                </label>
                <a href="#" className="text-xs text-cyan-400 hover:underline">
                  ลืมรหัสผ่าน?
                </a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                defaultChecked
                className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="remember" className="cursor-pointer text-xs text-slate-400">
                จดจำการเข้าสู่ระบบในเครื่องนี้
              </label>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบ</span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ยังไม่มีบัญชีผู้ใช้งาน?{" "}
          <a href="#" className="font-semibold text-cyan-400 hover:underline">
            ติดต่อผู้ดูแลระบบ
          </a>
        </p>

        <Link
          href="/"
          className="mt-3 block text-center text-xs text-slate-600 transition hover:text-cyan-400"
        >
          ← กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
