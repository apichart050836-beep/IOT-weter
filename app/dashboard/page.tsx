"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getPrimaryDeviceId,
  subscribeLatestReadings,
  subscribeDevice,
  subscribeReadingsChanged,
  getVolumeSum,
  getDailyVolumeTotals,
  getDevice,
  setDeviceCommand,
  getRateTiers,
  subscribeWaterRate,
  setBillingCutoffDay,
  setOtherCharges,
  getLineStatus,
} from "@/lib/supabase/queries";
import { billingPeriodStart, now as dateNow } from "@/lib/dateRanges";
import { calculateWaterBill, DEFAULT_TIERS, DEFAULT_SERVICE_FEE } from "@/lib/billing";
import type { Reading, RateTier, Device, PipeSize, DailyVolume, LineStatus } from "@/lib/supabase/types";
import { useSession } from "@/lib/useSession";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const BASE_FLOW_LPM = 25.0;
const VALVE_DELAY_MS = 5000;
const CHART_LABELS = ["60s", "50s", "40s", "30s", "20s", "10s", "5s", "Now"];

type Toast = { message: string; tone: "success" | "error" };

export default function DashboardPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [clock, setClock] = useState("--:--:--");

  const [masterChecked, setMasterChecked] = useState(true);
  const [actualValveOpen, setActualValveOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [flowPercent, setFlowPercent] = useState(100);

  const [chartData, setChartData] = useState<number[]>([12, 19, 15, 17, 14, 18.5, 20, 25.0]);
  const [volume, setVolume] = useState(25.4);

  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineStatus, setLineStatus] = useState<LineStatus | null>(null);
  const [lineConnecting, setLineConnecting] = useState(false);
  const [lineTesting, setLineTesting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // ข้อมูลจริงจาก Supabase (ใช้เมื่อ isSupabaseConfigured เท่านั้น) — ไม่งั้น fallback ไปโหมดจำลองทั้งหมด
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceLookupDone, setDeviceLookupDone] = useState(false);
  const [dbReadings, setDbReadings] = useState<Reading[]>([]);
  const [dbVolumeThisMonthLiters, setDbVolumeThisMonthLiters] = useState<number | null>(null);
  const [dailyVolumeTotals, setDailyVolumeTotals] = useState<DailyVolume[]>([]);
  const [rateTiers, setRateTiers] = useState<RateTier[]>(DEFAULT_TIERS);
  const [deviceInfo, setDeviceInfo] = useState<Device | null>(null);
  const [billingPipeSize, setBillingPipeSize] = useState<PipeSize>('3/4"');
  const [billingCutoffDay, setBillingCutoffDayState] = useState(1);
  const [serviceFee, setServiceFee] = useState(DEFAULT_SERVICE_FEE);
  const [serviceFeeHalfInch, setServiceFeeHalfInch] = useState(DEFAULT_SERVICE_FEE);
  const [otherCharges, setOtherChargesState] = useState(0);
  const [otherChargesHalfInch, setOtherChargesHalfInchState] = useState(0);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [cutoffDayDraft, setCutoffDayDraft] = useState("1");
  const [otherChargesHalfInchDraft, setOtherChargesHalfInchDraft] = useState("0");
  const [otherChargesThreeQuarterDraft, setOtherChargesThreeQuarterDraft] = useState("0");

  const { signOut } = useSession();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localStorage.getItem("theme") === "light") setTheme("light");
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    async function loadLineStatus() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      setLineStatus(await getLineStatus(userId));
    }
    loadLineStatus();
  }, []);

  // รับ redirect กลับจาก LINE Login (?code=...&state=...) แล้วผูกบัญชี LINE กับผู้ใช้ที่ login อยู่
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code) return;

    const expectedState = sessionStorage.getItem("line_login_state");
    window.history.replaceState(null, "", window.location.pathname);
    if (!state || state !== expectedState) return;
    sessionStorage.removeItem("line_login_state");

    (async () => {
      setLineConnecting(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const userId = sessionData.session?.user.id;
        if (!accessToken || !userId) throw new Error("no session");

        const res = await fetch("/api/line/link", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ code, redirectUri: `${window.location.origin}/dashboard` }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "link failed");

        showToast(`เชื่อมต่อ LINE สำเร็จ (${result.displayName})`, "success");
        setLineStatus(await getLineStatus(userId));
      } catch (err) {
        showToast(err instanceof Error ? err.message : "เชื่อมต่อ LINE ไม่สำเร็จ", "error");
      } finally {
        setLineConnecting(false);
      }
    })();
  }, []);

  useEffect(() => {
    function tick() {
      setClock(new Date().toLocaleTimeString("th-TH", { hour12: false }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getPrimaryDeviceId().then((id) => {
      setDeviceId(id);
      setDeviceLookupDone(true);
    });
    getRateTiers().then((tiers) => {
      if (tiers.length > 0) setRateTiers(tiers);
    });
  }, []);

  // โหลดคำสั่งวาล์วล่าสุดที่เคยตั้งไว้ (ครั้งเดียวตอนเปิดหน้า) ให้ toggle/slider ตรงกับสถานะจริง
  useEffect(() => {
    if (!isSupabaseConfigured || !deviceId) return;
    getDevice(deviceId).then((device) => {
      if (!device) return;
      setMasterChecked(device.valveOpen);
      setActualValveOpen(device.valveOpen);
      setFlowPercent(device.targetFlowPercent);
      setBillingPipeSize(device.pipeSize);
    });
  }, [deviceId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !deviceId) return;
    return subscribeLatestReadings(deviceId, 40, setDbReadings);
  }, [deviceId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !deviceId) return;
    return subscribeDevice(deviceId, setDeviceInfo);
  }, [deviceId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    return subscribeWaterRate((settings) => {
      setBillingCutoffDayState(settings.billingCutoffDay);
      setCutoffDayDraft(String(settings.billingCutoffDay));
      setServiceFee(settings.serviceFee);
      setServiceFeeHalfInch(settings.serviceFeeHalfInch);
      setOtherChargesState(settings.otherCharges);
      setOtherChargesHalfInchState(settings.otherChargesHalfInch);
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !deviceId) return;
    let cancelled = false;
    async function load() {
      const [periodTotal, dailyTotals] = await Promise.all([
        getVolumeSum(deviceId as string, billingPeriodStart(billingCutoffDay), dateNow()),
        getDailyVolumeTotals(deviceId as string, dateNow().getDate()),
      ]);
      if (!cancelled) {
        setDbVolumeThisMonthLiters(periodTotal);
        setDailyVolumeTotals(dailyTotals);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    const unsubscribe = subscribeReadingsChanged(deviceId, load);
    return () => {
      cancelled = true;
      clearInterval(id);
      unsubscribe();
    };
  }, [deviceId, billingCutoffDay]);

  const sliderFactor = flowPercent / 100;
  const currentFlow = actualValveOpen ? Number((BASE_FLOW_LPM * sliderFactor).toFixed(1)) : 0;

  const hasDbReadings = isSupabaseConfigured && dbReadings.length > 0;
  const displayFlow = hasDbReadings ? dbReadings[dbReadings.length - 1].flowRateLpm : currentFlow;
  const percentage = Math.min(100, Math.round((displayFlow / BASE_FLOW_LPM) * 100));

  const volumeForBilling =
    isSupabaseConfigured && dbVolumeThisMonthLiters !== null ? dbVolumeThisMonthLiters / 1000 : volume;
  const volumeMonthLiters =
    isSupabaseConfigured && dbVolumeThisMonthLiters !== null ? dbVolumeThisMonthLiters : 0;
  const effectiveServiceFee = billingPipeSize === '1/2"' ? serviceFeeHalfInch : serviceFee;
  const effectiveOtherCharges = billingPipeSize === '1/2"' ? otherChargesHalfInch : otherCharges;
  const daysInPeriod = Math.max(
    1,
    Math.ceil((dateNow().getTime() - billingPeriodStart(billingCutoffDay).getTime()) / 86_400_000)
  );
  const billing = useMemo(
    () => calculateWaterBill(volumeForBilling, rateTiers, effectiveServiceFee, daysInPeriod, effectiveOtherCharges),
    [volumeForBilling, rateTiers, effectiveServiceFee, daysInPeriod, effectiveOtherCharges]
  );

  useEffect(() => {
    if (isSupabaseConfigured) return; // ใช้ข้อมูลจริงจาก Supabase แทน ไม่ต้องจำลองเพิ่ม
    const id = setInterval(() => {
      setChartData((prev) => {
        const randomVar = currentFlow > 0 ? Math.random() * 1.5 - 0.75 : 0;
        const next = Math.max(0, currentFlow + randomVar);
        return [...prev.slice(1), Number(next.toFixed(1))];
      });
      if (currentFlow > 0) {
        setVolume((v) => v + (currentFlow * 0.001) / 20);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [currentFlow]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function showToast(message: string, tone: Toast["tone"] = "success") {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, tone });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  }

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  }

  function handleMasterToggle(checked: boolean) {
    setMasterChecked(checked);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    setPending(true);
    setCountdown(5);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPending(false);
      setActualValveOpen(checked);
      if (isSupabaseConfigured && deviceId) {
        setDeviceCommand(deviceId, { valveOpen: checked }).catch(() =>
          showToast("บันทึกคำสั่งวาล์วไม่สำเร็จ", "error")
        );
      }
    }, VALVE_DELAY_MS);
  }

  function connectLine() {
    const channelId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID;
    if (!channelId) {
      showToast("ยังไม่ได้ตั้งค่า LINE Login บนระบบ", "error");
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem("line_login_state", state);
    const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", channelId);
    url.searchParams.set("redirect_uri", `${window.location.origin}/dashboard`);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "profile openid");
    url.searchParams.set("bot_prompt", "aggressive");
    window.location.href = url.toString();
  }

  async function toggleNotifyPref(key: "notifyNoFlow" | "notifyLongFlow", value: boolean) {
    if (!lineStatus) return;
    const previous = lineStatus;
    setLineStatus({ ...lineStatus, [key]: value });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("no session");
      const res = await fetch("/api/line/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(key === "notifyNoFlow" ? { notifyNoFlow: value } : { notifyLongFlow: value }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "update failed");
    } catch (err) {
      setLineStatus(previous);
      showToast(err instanceof Error ? err.message : "บันทึกการตั้งค่าไม่สำเร็จ", "error");
    }
  }

  async function sendTestLineMessage() {
    setLineTesting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("no session");
      const res = await fetch("/api/line/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "test failed");
      showToast("ส่งข้อความทดสอบไปยัง LINE แล้ว", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "ส่งข้อความทดสอบไม่สำเร็จ", "error");
    } finally {
      setLineTesting(false);
    }
  }

  async function saveBillingCutoffDay() {
    const day = Math.min(28, Math.max(1, Number(cutoffDayDraft) || 1));
    const halfInchCharge = Math.max(0, Number(otherChargesHalfInchDraft) || 0);
    const threeQuarterCharge = Math.max(0, Number(otherChargesThreeQuarterDraft) || 0);
    if (!isSupabaseConfigured) {
      showToast("ต้องตั้งค่า Supabase ก่อนถึงจะบันทึกได้", "error");
      return;
    }
    try {
      await Promise.all([setBillingCutoffDay(day), setOtherCharges(halfInchCharge, threeQuarterCharge)]);
      showToast(`ตั้งวันตัดรอบบิลเป็นวันที่ ${day} ของทุกเดือนแล้ว`, "success");
      setSettingsModalOpen(false);
    } catch {
      showToast("บันทึกไม่สำเร็จ", "error");
    }
  }

  const statusLog = pending
    ? {
        message: `[WAIT] กำลังดำเนินการ ${masterChecked ? "เปิด" : "ปิด"} วาล์วหลักใน ${countdown} วินาที...`,
        color: "text-amber-400",
        dot: "bg-amber-500 animate-ping",
        badge: `DELAY: ${countdown}s`,
        badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
      }
    : actualValveOpen
      ? {
          message: "[SYS] วาล์วหลักเปิดอยู่ น้ำกำลังไหลตามปกติ",
          color: "text-emerald-400",
          dot: "bg-emerald-500 animate-pulse",
          badge: "READY",
          badgeClass: "bg-slate-800 text-slate-400",
        }
      : {
          message: "[SYS] วาล์วหลักปิดอยู่ หยุดการไหลของน้ำ",
          color: "text-red-400",
          dot: "bg-red-500",
          badge: "READY",
          badgeClass: "bg-slate-800 text-slate-400",
        };

  const flowing = actualValveOpen && flowPercent > 0;
  const ledColor = flowing ? "#10b981" : actualValveOpen ? "#f59e0b" : "#ef4444";
  const activeStroke = theme === "dark" ? "#00f2fe" : "#0ea5e9";
  const disabledStroke = theme === "dark" ? "#1e293b" : "#cbd5e1";
  const waterStroke = actualValveOpen ? activeStroke : disabledStroke;
  const animSpeed = Math.max(0.1, 0.8 - sliderFactor * 0.65);
  const animState: React.CSSProperties = flowing
    ? { animationPlayState: "running", animationDuration: `${animSpeed}s` }
    : { animationPlayState: "paused" };

  const hasDailyData = isSupabaseConfigured && dailyVolumeTotals.length > 0;

  const chartLabels = hasDailyData
    ? dailyVolumeTotals.map((d) => {
        const [y, m, day] = d.date.split("-").map(Number);
        return new Date(y, m - 1, day).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      })
    : hasDbReadings
    ? dbReadings.map((r) =>
        new Date(r.recordedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
      )
    : CHART_LABELS;
  const chartValues = hasDailyData
    ? dailyVolumeTotals.map((d) => Number(d.totalLiters.toFixed(1)))
    : hasDbReadings
    ? dbReadings.map((r) => r.flowRateLpm)
    : chartData;

  const chart = {
    labels: chartLabels,
    datasets: [
      {
        label: hasDailyData ? "ปริมาณน้ำต่อวัน (ลิตร)" : "Flow Rate (L/min)",
        data: chartValues,
        borderColor: "#00F2FE",
        backgroundColor: "rgba(0, 242, 254, 0.15)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#00F2FE",
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { color: "#64748B", font: { family: "var(--font-orbitron)", size: 10 } },
      },
      y: {
        min: 0,
        ...(hasDailyData ? {} : { max: 30 }),
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { color: "#64748B", font: { family: "var(--font-orbitron)", size: 10 } },
      },
    },
  };

  if (isSupabaseConfigured && deviceLookupDone && !deviceId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-4 text-center text-slate-100">
        <i className="fa-solid fa-droplet text-3xl text-cyan-500" />
        <h1 className="text-lg font-bold">ยังไม่มีอุปกรณ์ผูกกับบัญชีนี้</h1>
        <p className="max-w-sm text-sm text-slate-400">
          กรุณาติดต่อผู้ดูแลระบบเพื่อผูกอุปกรณ์ ESP32 เข้ากับบัญชีนี้
        </p>
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="dashboard-bg min-h-screen font-[family-name:var(--font-sarabun)] p-4 antialiased md:p-6 text-slate-800 dark:text-slate-100">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* HEADER */}
          <header className="glass-panel flex flex-col items-center justify-between gap-4 rounded-2xl border-cyan-500/30 p-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-500 dark:text-cyan-400">
                <i className="fa-solid fa-droplet animate-pulse text-2xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide text-slate-800 md:text-2xl dark:text-white">
                  ระบบ IoT ติดตามการไหลของน้ำ{" "}
                  <span className="ml-2 font-[family-name:var(--font-orbitron)] text-xs font-normal text-cyan-600 md:text-sm dark:text-cyan-400">
                    (IoT Water Flow Monitoring)
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ศูนย์ควบคุมและตรวจสอบสถานะการทำงานแบบเรียลไทม์ (ระบบท่อต่อตรงประปา)
                </p>
                {deviceInfo && (
                  <p className="mt-0.5 text-xs font-medium text-cyan-600 dark:text-cyan-400">
                    <i className="fa-solid fa-location-dot mr-1" />
                    {deviceInfo.name}
                    {deviceInfo.location ? ` • ${deviceInfo.location}` : ""}
                    {` • ท่อ ${deviceInfo.pipeSize}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => {
                  setCutoffDayDraft(String(billingCutoffDay));
                  setOtherChargesHalfInchDraft(String(otherChargesHalfInch));
                  setOtherChargesThreeQuarterDraft(String(otherCharges));
                  setSettingsModalOpen(true);
                }}
                title="ตั้งค่าวันตัดรอบบิล"
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-slate-700 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <i className="fa-solid fa-file-invoice text-base" />
                <span className="hidden sm:inline">ตั้งค่ารอบบิล</span>
              </button>

              <div className="rounded-xl border border-slate-300 bg-slate-200 px-3 py-1.5 font-[family-name:var(--font-orbitron)] text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                {clock}
              </div>

              <button
                onClick={() => setLineModalOpen(true)}
                title="ตั้งค่า LINE Notify"
                className="flex items-center justify-center rounded-xl bg-emerald-500 p-2 text-white shadow-sm transition hover:bg-emerald-600"
              >
                <i className="fa-brands fa-line text-lg" />
              </button>

              <button
                onClick={toggleTheme}
                className="rounded-xl border border-slate-300 bg-slate-200 p-2 text-slate-700 transition dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400"
              >
                <i className={`fa-solid ${theme === "dark" ? "fa-moon" : "fa-sun"} text-base`} />
              </button>

              <button
                onClick={signOut}
                title="ออกจากระบบ"
                className="rounded-xl border border-red-300 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                <i className="fa-solid fa-right-from-bracket text-base" />
              </button>
            </div>
          </header>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* DIGITAL GAUGE */}
            <div className="space-y-6 lg:col-span-7">
              <div className="glass-panel overflow-hidden rounded-2xl">
                <div className="glass-panel-header flex items-center justify-between px-5 py-3">
                  <span className="flex items-center gap-2 font-bold text-cyan-600 dark:text-cyan-300">
                    <i className="fa-solid fa-gauge-high" /> Digital Gauge
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
                      อัตราการไหลปัจจุบัน (Current Flow Rate)
                    </span>
                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                      <span>Online</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
                    <div className="card-sub-bg flex flex-col items-center justify-center rounded-2xl p-4 md:col-span-7">
                      <span className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                        สะสมทั้งเดือน (Monthly Total)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-[family-name:var(--font-orbitron)] text-5xl font-extrabold text-cyan-500 dark:text-cyan-400">
                          {volumeMonthLiters.toFixed(1)}
                        </span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">ลิตร</span>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <i className="fa-solid fa-gauge-high text-cyan-500" />
                        อัตราการไหลขณะนี้ {displayFlow.toFixed(1)} L/min
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-300 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center md:col-span-5">
                      <div className="relative flex h-36 w-36 items-center justify-center">
                        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                          <path
                            className="text-slate-300 dark:text-slate-800"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-cyan-500 transition-all duration-500 dark:text-cyan-400"
                            strokeDasharray={`${percentage}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-slate-800 dark:text-white">
                            {percentage}%
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            ของความจุท่อ
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        <i className="fa-solid fa-chart-line mr-1 text-cyan-500" />{" "}
                        {hasDailyData
                          ? "ประวัติการใช้น้ำรายวัน (จากฐานข้อมูล)"
                          : hasDbReadings
                          ? "ประวัติล่าสุดจากฐานข้อมูล"
                          : "กราฟแสดงผล 60 วินาทีย้อนหลัง"}
                      </span>
                      <span className="font-[family-name:var(--font-orbitron)] text-cyan-500">
                        Live Updates
                      </span>
                    </div>
                    <div className="h-44 w-full">
                      <Line data={chart} options={chartOptions} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* VALVE CONTROL */}
            <div className="space-y-6 lg:col-span-5">
              <div className="glass-panel overflow-hidden rounded-2xl border border-slate-200 shadow-[0_10px_30px_rgba(6,182,212,0.12)] dark:border-cyan-500/30">
                <div className="glass-panel-header flex items-center justify-between px-5 py-3.5">
                  <span className="flex items-center gap-2 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-cyan-600 dark:text-cyan-400">
                    <i className="fa-solid fa-microchip animate-pulse text-cyan-500" /> การควบคุมวาล์ว
                    (Valve Control)
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-[family-name:var(--font-orbitron)] text-xs text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <i className="fa-solid fa-circle animate-ping text-[8px]" /> ปกติ
                  </span>
                </div>

                <div className="relative space-y-4 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-5">
                  <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" />
                  <div className="pointer-events-none absolute -bottom-16 -right-16 h-60 w-60 rounded-full bg-teal-400/15 blur-3xl dark:bg-blue-600/10" />

                  <div className="relative mx-auto max-w-[500px] space-y-3 py-2">
                    <svg
                      className="h-auto w-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
                      viewBox="0 0 600 240"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient id="cyberMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" className="[--stop-1:#f8fafc] dark:[--stop-1:#334155]" stopColor="var(--stop-1)" />
                          <stop offset="40%" className="[--stop-2:#e2e8f0] dark:[--stop-2:#1e293b]" stopColor="var(--stop-2)" />
                          <stop offset="70%" className="[--stop-3:#cbd5e1] dark:[--stop-3:#0f172a]" stopColor="var(--stop-3)" />
                          <stop offset="100%" className="[--stop-4:#94a3b8] dark:[--stop-4:#020617]" stopColor="var(--stop-4)" />
                        </linearGradient>
                        <linearGradient id="brassLinear" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="30%" stopColor="#d97706" />
                          <stop offset="60%" stopColor="#fef3c7" />
                          <stop offset="85%" stopColor="#b45309" />
                          <stop offset="100%" stopColor="#78350f" />
                        </linearGradient>
                        <linearGradient id="glassReflection" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                          <stop offset="20%" stopColor="#ffffff" stopOpacity="0.15" />
                          <stop offset="80%" stopColor="#38bdf8" stopOpacity="0.1" />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
                        </linearGradient>
                        <linearGradient id="waterFluidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#0284c7" />
                          <stop offset="100%" stopColor="#0369a1" />
                        </linearGradient>
                        <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      <rect x="40" y="120" width="520" height="48" rx="24" className="fill-slate-200 dark:fill-slate-950" />

                      <g>
                        <rect x="36" y="124" width="230" height="40" rx="20" fill="url(#waterFluidGrad)" />
                        <rect x="334" y="124" width="230" height="40" rx="20" fill="url(#waterFluidGrad)" />

                        <g filter="url(#neonGlow)">
                          <path d="M 45 144 L 265 144" stroke="#0284c7" strokeWidth="18" opacity={flowing ? 0.4 : 0.05 + sliderFactor * 0.35} strokeLinecap="round" />
                          <path d="M 335 144 L 555 144" stroke="#0284c7" strokeWidth="18" opacity={flowing ? 0.05 + sliderFactor * 0.35 : 0.05} strokeLinecap="round" />

                          <path
                            d="M 45 144 L 265 144"
                            stroke={waterStroke}
                            strokeWidth="14"
                            strokeLinecap="round"
                            className="water-anim"
                            style={{ ...animState, opacity: actualValveOpen ? (flowing ? 1 : 0.8) : 0.15 }}
                          />
                          <path
                            d="M 335 144 L 555 144"
                            stroke={waterStroke}
                            strokeWidth="14"
                            strokeLinecap="round"
                            className="water-anim"
                            style={{ ...animState, opacity: actualValveOpen ? (flowing ? 0.2 + sliderFactor * 0.8 : 0) : 0.05 }}
                          />

                          <path
                            d="M 45 138 L 265 138"
                            stroke="#ffffff"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className="water-anim-core"
                            style={{ ...animState, opacity: actualValveOpen ? (flowing ? 0.9 : 0.4) : 0 }}
                          />
                          <path
                            d="M 335 138 L 555 138"
                            stroke="#ffffff"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className="water-anim-core"
                            style={{ ...animState, opacity: actualValveOpen && flowing ? 0.1 + sliderFactor * 0.8 : 0 }}
                          />
                        </g>
                      </g>

                      <rect x="40" y="120" width="520" height="48" rx="24" fill="url(#glassReflection)" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.8" />
                      <rect x="38" y="118" width="524" height="52" rx="26" fill="none" stroke="#0284c7" strokeWidth="1" opacity="0.4" />
                      <path d="M 50 123 L 550 123" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

                      <rect x="26" y="110" width="18" height="68" rx="4" fill="url(#cyberMetal)" stroke="#0284c7" strokeWidth="1.5" />
                      <rect x="556" y="110" width="18" height="68" rx="4" fill="url(#cyberMetal)" stroke="#0284c7" strokeWidth="1.5" />

                      <text x="50" y="102" className="fill-cyan-600 dark:fill-cyan-400" fontSize="12" fontFamily="monospace" fontWeight="bold">
                        INLET (IN)
                      </text>
                      <text x="480" y="102" className="fill-cyan-600 dark:fill-cyan-400" fontSize="12" fontFamily="monospace" fontWeight="bold">
                        OUTLET (OUT)
                      </text>

                      <g>
                        <rect x="265" y="112" width="70" height="64" rx="6" fill="url(#brassLinear)" stroke="#78350f" strokeWidth="1.5" />
                        <rect x="260" y="108" width="80" height="12" rx="3" fill="url(#brassLinear)" />
                        <rect x="260" y="168" width="80" height="12" rx="3" fill="url(#brassLinear)" />
                        <rect x="285" y="88" width="30" height="24" fill="url(#brassLinear)" />
                      </g>

                      <g>
                        <rect x="265" y="15" width="70" height="75" rx="8" fill="url(#cyberMetal)" stroke="#0284c7" strokeWidth="1.5" />
                        <rect x="272" y="23" width="56" height="22" rx="4" className="fill-slate-100 stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700" />
                        <rect x="260" y="80" width="80" height="12" rx="3" className="fill-slate-200 stroke-slate-400 dark:fill-slate-800 dark:stroke-slate-600" />
                        <circle cx="300" cy="15" r="10" fill="url(#cyberMetal)" stroke="#0284c7" />
                        <circle
                          cx="300"
                          cy="34"
                          r="5"
                          fill={ledColor}
                          style={{ filter: `drop-shadow(0 0 8px ${ledColor})` }}
                        />
                      </g>
                    </svg>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs shadow-inner">
                      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-400">
                          <span className={`h-2 w-2 rounded-full ${statusLog.dot}`} />
                          Master Valve Status Log
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusLog.badgeClass}`}>
                          {statusLog.badge}
                        </span>
                      </div>
                      <div className={`min-h-[1.25rem] font-semibold transition-all ${statusLog.color}`}>
                        {statusLog.message}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="card-sub-bg flex items-center justify-between rounded-xl border border-slate-200 p-3.5 transition-all dark:border-slate-800">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 sm:text-sm dark:text-white">
                          เปิด/ปิดวาล์วหลัก (Master Valve)
                        </h3>
                        <p
                          className={`mt-0.5 text-[11px] ${
                            pending
                              ? "animate-pulse font-semibold text-amber-500"
                              : actualValveOpen
                                ? "text-slate-500 dark:text-slate-400"
                                : "font-semibold text-red-500"
                          }`}
                        >
                          {pending
                            ? `สถานะ: กำลังส่งคำสั่ง... (${countdown}s)`
                            : `สถานะ: ${actualValveOpen ? "เปิดใช้งาน (ON)" : "ปิดใช้งาน (OFF)"}`}
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={masterChecked}
                          onChange={(e) => handleMasterToggle(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-12 rounded-full border border-slate-300 bg-slate-300 shadow-inner after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-slate-600 dark:bg-slate-800" />
                      </label>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BILLING */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="glass-panel-header flex items-center justify-between px-5 py-3">
              <span className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <i className="fa-solid fa-file-invoice-dollar" /> ส่วนประมวลผลและคำนวณค่าน้ำ (Billing &
                Payments)
              </span>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {billingCutoffDay === 1
                  ? "รอบบิลปัจจุบัน (เดือนนี้)"
                  : `รอบบิลปัจจุบัน (ตัดทุกวันที่ ${billingCutoffDay})`}
              </span>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ขนาดมาตรวัดน้ำ (มีผลกับค่าบริการทั่วไป):
                </span>
                <div className="flex gap-1 rounded-xl bg-slate-200 p-1 text-xs font-semibold dark:bg-slate-800">
                  {(['1/2"', '3/4"'] as PipeSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setBillingPipeSize(size)}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        billingPipeSize === size
                          ? "bg-emerald-500 text-slate-950"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {size === '1/2"' ? "1/2 นิ้ว" : "3/4 นิ้ว"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="card-sub-bg flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xl text-cyan-600 dark:text-cyan-400">
                    <i className="fa-solid fa-faucet-drip" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ปริมาณน้ำสะสม (Total Volume)
                    </span>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-slate-800 dark:text-white">
                        {billing.volume.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">ลบ.ม. (m³)</span>
                    </div>
                  </div>
                </div>

                <div className="card-sub-bg flex items-center gap-4 rounded-xl border border-emerald-500/30 p-4">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xl text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-baht-sign" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ประมาณการค่าน้ำสะสม
                    </span>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {billing.grandTotal.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">บาท</span>
                    </div>
                  </div>
                </div>

                <div className="card-sub-bg flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xl text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-calendar-day" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ค่าน้ำเฉลี่ยต่อวัน (ใช้น้ำมา {daysInPeriod} วัน)
                    </span>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-slate-800 dark:text-white">
                        {billing.dailyAvg.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">บาท/วัน</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    รายละเอียดการคำนวณอัตราก้าวหน้า (Progressive Rate Breakdown)
                  </span>
                  <span className="font-[family-name:var(--font-orbitron)] text-slate-500 dark:text-slate-400">
                    อัตราค่าน้ำประเภทที่ 1 (ที่อยู่อาศัย)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="border-b border-slate-200 bg-slate-50 font-[family-name:var(--font-orbitron)] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">ช่วงปริมาณน้ำ (ลบ.ม.)</th>
                        <th className="px-4 py-3">อัตรา/หน่วย (บาท)</th>
                        <th className="px-4 py-3">หน่วยที่ใช้จริง</th>
                        <th className="px-4 py-3 text-right">รวมเป็นเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-[family-name:var(--font-orbitron)] dark:divide-slate-800">
                      {rateTiers.map((tier, i) => (
                        <tr key={tier.label} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-2.5">{tier.label}</td>
                          <td className="px-4 py-2.5">{tier.ratePerUnit.toFixed(2)}</td>
                          <td className="px-4 py-2.5 font-semibold text-cyan-600 dark:text-cyan-400">
                            {billing.tierUsages[i].toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {billing.tierCosts[i].toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50 font-[family-name:var(--font-sarabun)] dark:border-slate-700 dark:bg-slate-950/80">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">
                          รวมค่าน้ำตามอัตราก้าวหน้า:
                        </td>
                        <td className="px-4 py-2 text-right font-[family-name:var(--font-orbitron)] font-semibold text-slate-800 dark:text-white">
                          {billing.waterCost.toFixed(2)} บาท
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">
                          ค่าบริการรายเดือน (ถาวร):
                        </td>
                        <td className="px-4 py-1.5 text-right font-[family-name:var(--font-orbitron)] font-semibold text-slate-800 dark:text-white">
                          {billing.serviceFee.toFixed(2)} บาท
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">
                          ภาษีมูลค่าเพิ่ม VAT (7%):
                        </td>
                        <td className="px-4 py-1.5 text-right font-[family-name:var(--font-orbitron)] font-semibold text-slate-800 dark:text-white">
                          {billing.vat.toFixed(2)} บาท
                        </td>
                      </tr>
                      {billing.otherCharges > 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-1.5 text-right text-slate-500 dark:text-slate-400">
                            ค่าใช้จ่ายอื่นๆ:
                          </td>
                          <td className="px-4 py-1.5 text-right font-[family-name:var(--font-orbitron)] font-semibold text-slate-800 dark:text-white">
                            {billing.otherCharges.toFixed(2)} บาท
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-emerald-300 bg-emerald-50 text-sm font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <td colSpan={3} className="px-4 py-3 text-right">
                          ยอดรวมสุทธิที่ต้องชำระทั้งสิ้น:
                        </td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-orbitron)] text-lg">
                          {billing.grandTotal.toFixed(2)} บาท
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LINE MODAL */}
        {lineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-md space-y-4 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                  <i className="fa-brands fa-line text-xl" /> การแจ้งเตือนผ่าน LINE
                </h3>
                <button
                  onClick={() => setLineModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>

              {lineStatus?.lineUserId ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-circle-check" />
                    เชื่อมต่อ LINE แล้ว{lineStatus.lineDisplayName ? ` (${lineStatus.lineDisplayName})` : ""}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกรับแจ้งเตือนแบบ push message ทาง LINE ได้เลย —
                    หรือพิมพ์คุยกับ LINE OA เพื่อดูใช้น้ำวันนี้/เดือนนี้/บิลปัจจุบัน
                  </p>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={lineStatus.notifyNoFlow}
                        onChange={(e) => toggleNotifyPref("notifyNoFlow", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-0 dark:border-slate-700"
                      />
                      แจ้งเตือนน้ำไม่ไหล
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={lineStatus.notifyLongFlow}
                        onChange={(e) => toggleNotifyPref("notifyLongFlow", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-0 dark:border-slate-700"
                      />
                      แจ้งเตือนน้ำไหลนานเกิน 1 ชม. (เฝ้าระวังน้ำรั่ว)
                    </label>
                  </div>

                  <button
                    onClick={sendTestLineMessage}
                    disabled={lineTesting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <i className="fa-solid fa-paper-plane" />
                    {lineTesting ? "กำลังส่ง..." : "ทดสอบส่ง"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เชื่อมต่อบัญชี LINE ของคุณเพื่อรับแจ้งเตือนแบบ push message
                    และพิมพ์คุยกับ LINE OA เพื่อดูใช้น้ำวันนี้/เดือนนี้/บิลปัจจุบันได้ทันที
                  </p>
                  <button
                    onClick={connectLine}
                    disabled={lineConnecting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <i className="fa-brands fa-line text-lg" />
                    {lineConnecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อบัญชี LINE"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS MODAL */}
        {settingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-md space-y-4 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="flex items-center gap-2 font-bold text-cyan-600 dark:text-cyan-400">
                  <i className="fa-solid fa-file-invoice text-xl" /> ตั้งค่ารอบบิล
                </h3>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                กำหนดวันที่ตัดรอบบิลของทุกเดือน เช่น ตั้งเป็น 5 → รอบบิลจะเริ่มนับใหม่ทุกวันที่ 5
                ของเดือน (แทนที่จะเริ่มวันที่ 1 เสมอ) ระบบจะรีเซตยอดสะสมให้อัตโนมัติทุกเดือนตามวันนี้
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ตัดรอบบิลทุกวันที่ (1-28)
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={cutoffDayDraft}
                  onChange={(e) => setCutoffDayDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ค่าใช้จ่ายอื่นๆ (บาท) — ท่อ 1/2 นิ้ว
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={otherChargesHalfInchDraft}
                  onChange={(e) => setOtherChargesHalfInchDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ค่าใช้จ่ายอื่นๆ (บาท) — ท่อ 3/4 นิ้ว
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={otherChargesThreeQuarterDraft}
                  onChange={(e) => setOtherChargesThreeQuarterDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={saveBillingCutoffDay}
                  className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div
            className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-emerald-950 text-emerald-300"
                : "border-red-500/30 bg-red-950 text-red-300"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
