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
  isApproved: boolean;
  device: AdminUserDevice | null;
}

type Toast = { message: string; tone: "success" | "error" };

interface UnlinkedDevice {
  id: string;
  name: string;
  deviceKeyHash: string;
  createdAt: string;
  lastSeenAt: string | null;
}

function LinkDeviceModal({
  targetEmail,
  unlinkedDevices,
  deviceIdDraft,
  setDeviceIdDraft,
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
  unlinkedDevices: UnlinkedDevice[];
  deviceIdDraft: string;
  setDeviceIdDraft: (v: string) => void;
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
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 font-bold text-cyan-600 dark:text-cyan-400">
            <i className="fa-solid fa-microchip text-xl" /> ผูกอุปกรณ์ ESP
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          ผูกอุปกรณ์ให้บัญชี <span className="font-semibold text-cyan-600 dark:text-cyan-400">{targetEmail}</span> —
          เลือกจากอุปกรณ์ที่ยิงข้อมูลเข้าระบบแล้วแต่ยังไม่ได้ผูกกับบัญชีใด
          (อุปกรณ์จะลงทะเบียนตัวเองอัตโนมัติตอนส่งข้อมูลเข้า /api/ingest ครั้งแรก)
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              อุปกรณ์ที่ยังไม่ได้ผูก *
            </label>
            {unlinkedDevices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                ยังไม่มีอุปกรณ์ที่รอผูกบัญชี — รอให้อุปกรณ์ส่งข้อมูลเข้าระบบก่อน
              </p>
            ) : (
              <select
                value={deviceIdDraft}
                onChange={(e) => setDeviceIdDraft(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">-- เลือกอุปกรณ์ --</option>
                {unlinkedDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} • hash {d.deviceKeyHash.slice(0, 12)}…
                    {d.lastSeenAt ? ` • เห็นล่าสุด ${new Date(d.lastSeenAt).toLocaleString("th-TH")}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              ชื่ออุปกรณ์ (ถ้ามี)
            </label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="เช่น มิเตอร์น้ำหลัก"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              ตำแหน่งติดตั้ง (ถ้ามี)
            </label>
            <input
              type="text"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="เช่น หน้าบ้าน"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              ขนาดท่อ (มีผลกับค่าบริการที่คำนวณบิล)
            </label>
            <select
              value={pipeSizeDraft}
              onChange={(e) => setPipeSizeDraft(e.target.value as PipeSize)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value='1/2"'>1/2 นิ้ว</option>
              <option value='3/4"'>3/4 นิ้ว</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !deviceIdDraft}
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [unlinkedDevices, setUnlinkedDevices] = useState<UnlinkedDevice[]>([]);
  const [linkTarget, setLinkTarget] = useState<AdminUser | null>(null);
  const [deviceIdDraft, setDeviceIdDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [pipeSizeDraft, setPipeSizeDraft] = useState<PipeSize>('3/4"');
  const [linkLoading, setLinkLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    // ใช้ localStorage key เดียวกับหน้า dashboard/login เพื่อให้ธีมตรงกันทั้งระบบ
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem("theme") === "dark") setTheme("dark");
  }, []);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  }

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

  async function loadUnlinkedDevices() {
    if (!isSupabaseConfigured) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;

    const res = await fetch("/api/admin/devices", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const result = await res.json();
    setUnlinkedDevices(result.devices ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
    loadUnlinkedDevices();
  }, []);

  function openLinkModal(user: AdminUser) {
    setLinkTarget(user);
    setDeviceIdDraft("");
    setNameDraft("");
    setLocationDraft("");
    setPipeSizeDraft(user.device?.pipeSize ?? '3/4"');
  }

  async function handleLinkDevice() {
    if (!linkTarget) return;
    if (!deviceIdDraft) {
      showToast("เลือกอุปกรณ์ก่อน", "error");
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
          deviceId: deviceIdDraft,
          name: nameDraft.trim() || undefined,
          location: locationDraft.trim() || undefined,
          pipeSize: pipeSizeDraft,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "link failed");

      showToast("ผูกอุปกรณ์กับบัญชีนี้แล้ว", "success");
      setLinkTarget(null);
      loadUsers();
      loadUnlinkedDevices();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "ผูกอุปกรณ์ไม่สำเร็จ", "error");
    } finally {
      setLinkLoading(false);
    }
  }

  async function approveUser(user: AdminUser) {
    setApprovingId(user.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("no session");

      const res = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "approve failed");

      showToast(`อนุมัติบัญชี ${user.email} แล้ว`, "success");
      loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "อนุมัติไม่สำเร็จ", "error");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-lg font-bold text-white shadow-lg shadow-cyan-500/30">
                A
              </div>
              <div>
                <h1 className="text-lg font-bold">หน้าแอดมิน</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">จัดการผู้ใช้และผูกอุปกรณ์ ESP</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleTheme}
                title="สลับธีม"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400"
              >
                <i className={`fa-solid ${theme === "dark" ? "fa-moon" : "fa-sun"} text-base`} />
              </button>
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ไปหน้าแดชบอร์ด
              </Link>
              <button
                onClick={signOut}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-600 transition hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                ออกจากระบบ
              </button>
            </div>
          </header>

          {forbidden && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
              บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าแอดมิน
            </div>
          )}

          {!forbidden && loadError && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
              {loadError}
            </div>
          )}

          {!forbidden && !loadError && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-cyan-600 dark:border-slate-800 dark:text-cyan-400">
                รายชื่อผู้ใช้ ({users?.length ?? 0})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50">
                    <tr>
                      <th className="px-5 py-3">อีเมล</th>
                      <th className="px-5 py-3">สถานะ</th>
                      <th className="px-5 py-3">อุปกรณ์ที่ผูกไว้</th>
                      <th className="px-5 py-3">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users === null && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                          กำลังโหลด...
                        </td>
                      </tr>
                    )}
                    {users?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                          ยังไม่มีผู้สมัครในระบบ
                        </td>
                      </tr>
                    )}
                    {users?.map((user) => (
                      <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-5 py-3 font-medium">{user.email}</td>
                        <td className="px-5 py-3">
                          {user.isApproved ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <i className="fa-solid fa-circle-check" /> อนุมัติแล้ว
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                              <i className="fa-solid fa-clock" /> รออนุมัติ
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {user.device ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <i className="fa-solid fa-microchip" />
                              {user.device.name}
                              {user.device.location ? ` • ${user.device.location}` : ""}
                              {` • ท่อ ${user.device.pipeSize}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">ยังไม่ผูกอุปกรณ์</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {!user.isApproved && (
                              <button
                                onClick={() => approveUser(user)}
                                disabled={approvingId === user.id}
                                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
                              >
                                <i className="fa-solid fa-check" />
                                {approvingId === user.id ? "กำลังอนุมัติ..." : "อนุมัติ"}
                              </button>
                            )}
                            <button
                              onClick={() => openLinkModal(user)}
                              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-600 transition hover:bg-cyan-500/20 dark:text-cyan-400"
                            >
                              <i className="fa-solid fa-microchip" />
                              {user.device ? "เปลี่ยนอุปกรณ์" : "ผูกอุปกรณ์ ESP"}
                            </button>
                          </div>
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
            unlinkedDevices={unlinkedDevices}
            deviceIdDraft={deviceIdDraft}
            setDeviceIdDraft={setDeviceIdDraft}
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
    </div>
  );
}
