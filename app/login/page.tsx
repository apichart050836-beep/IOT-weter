"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { demoLogin } from "@/lib/demoAuth";

// ตรงกับ SKIP_AUTH ใน app/dashboard/layout.tsx — ปิดหน้า login ชั่วคราวเมื่อ bypass auth อยู่
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

type Mode = "login" | "signup" | "admin";

function describeSignUpError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("invalid")) {
    return "อีเมลนี้ใช้ไม่ได้ (ระบบไม่รับโดเมนอีเมลทดสอบ เช่น example.com) ลองใช้อีเมลจริง";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน";
  }
  if (message.includes("password")) {
    return "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";
  }
  return "สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง";
}

const PENDING_APPROVAL = "PENDING_APPROVAL";

const MODE_LABEL: Record<Mode, string> = {
  login: "เข้าสู่ระบบ",
  signup: "สมัครสมาชิก",
  admin: "เข้าสู่ระบบผู้ดูแลระบบ",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (SKIP_AUTH) router.replace("/dashboard");
  }, [router]);

  // หน้า login เริ่มต้นด้วยธีมสว่างเสมอ แต่ถ้าเคยตั้งค่าธีมไว้จากหน้าแดชบอร์ด (key เดียวกัน) จะใช้ค่านั้นแทน
  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") setTheme("dark");
  }, []);

  if (SKIP_AUTH) return null;

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function attemptSignIn(username: string, pass: string, redirectTo: string) {
    if (isSupabaseConfigured) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: username,
        password: pass,
      });
      if (signInError) throw signInError;

      const userId = signInData.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_approved")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.is_approved === false) {
          await supabase.auth.signOut();
          throw new Error(PENDING_APPROVAL);
        }
      }
    } else {
      if (!demoLogin(username, pass)) {
        throw new Error("invalid demo credentials");
      }
    }
    router.push(redirectTo);
  }

  async function attemptSignUp(username: string, pass: string) {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase ยังไม่ได้ตั้งค่า สมัครสมาชิกได้เฉพาะโหมดใช้งานจริงเท่านั้น");
    }
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password: pass }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "signup failed");

    setInfo("สมัครสมาชิกสำเร็จ — กรุณารอแอดมินอนุมัติบัญชีก่อนเข้าสู่ระบบ");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await attemptSignIn(email, password, "/dashboard");
      } else if (mode === "admin") {
        await attemptSignIn(email, password, "/admin");
      } else {
        await attemptSignUp(email, password);
      }
    } catch (err) {
      if (mode === "signup") {
        setError(describeSignUpError(err));
      } else if (err instanceof Error && err.message === PENDING_APPROVAL) {
        setError("บัญชีนี้ยังไม่ได้รับการอนุมัติจากแอดมิน กรุณารอการอนุมัติก่อนเข้าสู่ระบบ");
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <button
          onClick={toggleTheme}
          className="fixed right-4 top-4 z-20 rounded-xl border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400"
          title="สลับธีม"
        >
          <i className={`fa-solid ${theme === "dark" ? "fa-moon" : "fa-sun"} text-base`} />
        </button>

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/30">
              A
            </div>
            <h1 className="text-2xl font-bold tracking-wide text-slate-900 dark:text-white">
              AQUA<span className="text-cyan-600 dark:text-cyan-400">CONTROL</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              กรอกข้อมูลผู้ใช้งานเพื่อเข้าสู่ระบบควบคุมวาล์ว
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-950">
              {(["login", "signup", "admin"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`rounded-lg py-2 transition ${
                    mode === m
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {m === "login" ? "เข้าสู่ระบบ" : m === "signup" ? "สมัครสมาชิก" : "Admin"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  ชื่อผู้ใช้ / อีเมล
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aquacontrol.com"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    รหัสผ่าน
                  </label>
                  {mode === "login" && (
                    <a href="#" className="text-xs text-cyan-600 hover:underline dark:text-cyan-400">
                      ลืมรหัสผ่าน?
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600"
                />
              </div>

              {mode !== "signup" && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    defaultChecked
                    className="h-4 w-4 rounded border-slate-300 bg-slate-50 text-cyan-500 focus:ring-0 focus:ring-offset-0 dark:border-slate-800 dark:bg-slate-950"
                  />
                  <label htmlFor="remember" className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
                    จดจำการเข้าสู่ระบบในเครื่องนี้
                  </label>
                </div>
              )}

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  <span>{MODE_LABEL[mode]}</span>
                )}
              </button>
            </form>
          </div>

          <Link
            href="/"
            className="mt-6 block text-center text-xs text-slate-400 transition hover:text-cyan-600 dark:text-slate-600 dark:hover:text-cyan-400"
          >
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}
