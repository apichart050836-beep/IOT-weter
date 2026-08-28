"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useSession } from "@/lib/useSession";

type PipeSize = '1/2"' | '3/4"';

interface AdminUserDevice {
  id: string;
  name: string;
  location: string | null;
  lastSeenAt: string | null;
  pipeSize: PipeSize;
}

interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  device: AdminUserDevice | null;
}

type Toast = { message: string; tone: "success" | "error" };

function LinkDeviceModal({
  targetEmail,
  keyDraft,
  setKeyDraft,
  nameDraft,
  setNameDraft,
  locationDraft,
  setLocationDraft,
  pipeSizeDraft,
  setPipeSizeDraft,
  loading,
  onClose,
  onSubmit,
}: {
  targetEmail: string;
  keyDraft: string;
  setKeyDraft: (v: string) => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  locationDraft: string;
  setLocationDraft: (v: string) => void;
  pipeSizeDraft: PipeSize;
  setPipeSizeDraft: (v: PipeSize) => void;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="flex items-center gap-2 font-bold text-cyan-400">
            <i className="fa-solid fa-microchip text-xl" /> ผูกอุปกรณ์ ESP
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          ผูกอุปกรณ์ให้บัญชี <span className="font-semibold text-cyan-400">{targetEmail}</span> —
          กรอกรหัสลับ (device key) ที่ตั้งไว้ในเฟิร์มแวร์ ESP32 ระบบจะคำนวณ hash ให้เองฝั่งเซิร์ฟเวอร์
          ถ้ายังไม่เคยลงทะเบียนอุปกรณ์นี้มาก่อน ระบบจะสร้างให้ใหม่และผูกกับบัญชีนี้ทันที
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              รหัสลับอุปกรณ์ (device key) *
            </label>
            <input
              type="text"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="เช่น YOUR_SECRET_KEY"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">ชื่ออุปกรณ์ (ถ้ามี)</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="เช่น มิเตอร์น้ำหลัก"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">ตำแหน่งติดตั้ง (ถ้ามี)</label>
            <input
              type="text"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="เช่น หน้าบ้าน"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              ขนาดท่อ (มีผลกับค่าบริการที่คำนวณบิล)
            </label>
            <select
              value={pipeSizeDraft}
              onChange={(e) => setPipeSizeDraft(e.target.value as PipeSize)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value='1/2"'>1/2 นิ้ว</option>
              <option value='3/4"'>3/4 นิ้ว</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "กำลังผูก..." : "ผูกอุปกรณ์"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { signOut } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [linkTarget, setLinkTarget] = useState<AdminUser | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [pipeSizeDraft, setPipeSizeDraft] = useState<PipeSize>('3/4"');
  const [linkLoading, setLinkLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(message: string, tone: Toast["tone"]) {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadUsers() {
    if (!isSupabaseConfigured) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const result = await res.json();
    if (!res.ok) {
      setLoadError(result.error || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      return;
    }
    setUsers(result.users);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, []);

  function openLinkModal(user: AdminUser) {
    setLinkTarget(user);
    setKeyDraft("");
    setNameDraft("");
    setLocationDraft("");
    setPipeSizeDraft(user.device?.pipeSize ?? '3/4"');
  }

  async function handleLinkDevice() {
    if (!linkTarget) return;
    if (!keyDraft.trim()) {
      showToast("กรอกรหัสลับของอุปกรณ์ก่อน", "error");
      return;
    }
    setLinkLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("no session");

      const res = await fetch("/api/admin/devices/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: linkTarget.id,
          deviceKey: keyDraft.trim(),
          name: nameDraft.trim() || undefined,
          location: locationDraft.trim() || undefined,
          pipeSize: pipeSizeDraft,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "link failed");

      showToast(
        result.created ? "ลงทะเบียนอุปกรณ์ใหม่และผูกกับบัญชีนี้แล้ว" : "ผูกอุปกรณ์กับบัญชีนี้แล้ว",
        "success"
      );
      setLinkTarget(null);
      loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "ผูกอุปกรณ์ไม่สำเร็จ", "error");
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-lg font-bold shadow-lg shadow-cyan-500/30">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold">หน้าแอดมิน</h1>
              <p className="text-xs text-slate-400">จัดการผู้ใช้และผูกอุปกรณ์ ESP</p>
            </div>
          </div>
          <div className="flex gap-3">
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
        </header>

        {forbidden && (
          <div className="rounded-2xl border border-red-800/50 bg-red-950/30 p-6 text-center text-sm text-red-300">
            บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าแอดมิน
          </div>
        )}

        {!forbidden && loadError && (
          <div className="rounded-2xl border border-red-800/50 bg-red-950/30 p-6 text-center text-sm text-red-300">
            {loadError}
          </div>
        )}

        {!forbidden && !loadError && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-3 text-sm font-bold text-cyan-400">
              รายชื่อผู้ใช้ ({users?.length ?? 0})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">อีเมล</th>
                    <th className="px-5 py-3">อุปกรณ์ที่ผูกไว้</th>
                    <th className="px-5 py-3">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {users === null && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                        กำลังโหลด...
                      </td>
                    </tr>
                  )}
                  {users?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                        ยังไม่มีผู้สมัครในระบบ
                      </td>
                    </tr>
                  )}
                  {users?.map((user) => (
                    <tr key={user.id} className="border-t border-slate-800">
                      <td className="px-5 py-3 font-medium">{user.email}</td>
                      <td className="px-5 py-3 text-slate-300">
                        {user.device ? (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <i className="fa-solid fa-microchip" />
                            {user.device.name}
                            {user.device.location ? ` • ${user.device.location}` : ""}
                            {` • ท่อ ${user.device.pipeSize}`}
                          </span>
                        ) : (
                          <span className="text-slate-500">ยังไม่ผูกอุปกรณ์</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openLinkModal(user)}
                          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 transition hover:bg-cyan-500/20"
                        >
                          <i className="fa-solid fa-microchip" />
                          {user.device ? "เปลี่ยนอุปกรณ์" : "ผูกอุปกรณ์ ESP"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {linkTarget && (
        <LinkDeviceModal
          targetEmail={linkTarget.email}
          keyDraft={keyDraft}
          setKeyDraft={setKeyDraft}
          nameDraft={nameDraft}
          setNameDraft={setNameDraft}
          locationDraft={locationDraft}
          setLocationDraft={setLocationDraft}
          pipeSizeDraft={pipeSizeDraft}
          setPipeSizeDraft={setPipeSizeDraft}
          loading={linkLoading}
          onClose={() => setLinkTarget(null)}
          onSubmit={handleLinkDevice}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl ${
            toast.tone === "success" ? "bg-emerald-500 text-slate-950" : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
