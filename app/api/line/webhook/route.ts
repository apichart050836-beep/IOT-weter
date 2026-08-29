import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { verifyLineSignature, replyLineMessage, QUICK_REPLY_MENU } from "@/lib/line";
import { thailandStartOfDay, thailandStartOfMonth, billingPeriodStart, now as dateNow } from "@/lib/dateRanges";
import { calculateWaterBill, DEFAULT_TIERS, DEFAULT_SERVICE_FEE } from "@/lib/billing";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

async function volumeSumBetween(deviceId: string, start: Date, end: Date): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("readings")
    .select("volume_liters")
    .eq("device_id", deviceId)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());
  return (data ?? []).reduce((sum, row) => sum + (row.volume_liters as number), 0);
}

async function handleTextQuery(deviceId: string, pipeSize: string, text: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  if (text === "ใช้น้ำวันนี้") {
    const liters = await volumeSumBetween(deviceId, thailandStartOfDay(), dateNow());
    return `ปริมาณน้ำที่ใช้วันนี้: ${liters.toFixed(1)} ลิตร`;
  }

  if (text === "ใช้น้ำเดือนนี้") {
    const liters = await volumeSumBetween(deviceId, thailandStartOfMonth(), dateNow());
    return `ปริมาณน้ำที่ใช้เดือนนี้: ${liters.toFixed(1)} ลิตร (${(liters / 1000).toFixed(2)} ลบ.ม.)`;
  }

  if (text === "บิลค่าน้ำปัจจุบัน") {
    const { data: settings } = await supabase.from("water_rate_settings").select("*").eq("id", 1).maybeSingle();
    const { data: tierRows } = await supabase
      .from("water_rate_tiers")
      .select("*")
      .order("tier_order", { ascending: true });

    const tiers =
      tierRows && tierRows.length > 0
        ? tierRows.map((r) => ({
            tierOrder: r.tier_order as number,
            label: r.label as string,
            unitLimit: (r.unit_limit as number) ?? null,
            ratePerUnit: r.rate_per_unit as number,
          }))
        : DEFAULT_TIERS;

    const cutoffDay = (settings?.billing_cutoff_day as number) ?? 1;
    const serviceFee =
      pipeSize === '1/2"'
        ? ((settings?.service_fee_half_inch as number) ?? DEFAULT_SERVICE_FEE)
        : ((settings?.service_fee as number) ?? DEFAULT_SERVICE_FEE);

    const liters = await volumeSumBetween(deviceId, billingPeriodStart(cutoffDay), dateNow());
    const bill = calculateWaterBill(liters / 1000, tiers, serviceFee);

    return [
      `บิลค่าน้ำรอบปัจจุบัน`,
      `ปริมาณน้ำสะสม: ${bill.volume.toFixed(2)} ลบ.ม.`,
      `ค่าน้ำ: ${bill.waterCost.toFixed(2)} บาท`,
      `ค่าบริการ: ${bill.serviceFee.toFixed(2)} บาท`,
      `ภาษีมูลค่าเพิ่ม (7%): ${bill.vat.toFixed(2)} บาท`,
      `รวมทั้งสิ้น: ${bill.grandTotal.toFixed(2)} บาท`,
    ].join("\n");
  }

  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const body = JSON.parse(rawBody) as { events: LineEvent[] };
  const supabase = getSupabaseAdmin();

  for (const event of body.events ?? []) {
    const lineUserId = event.source?.userId;
    if (!lineUserId || !event.replyToken) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (!profile) {
      await replyLineMessage(event.replyToken, [
        { type: "text", text: "ยังไม่พบบัญชีที่ผูกกับ LINE นี้ กรุณาเชื่อมต่อ LINE จากหน้าแดชบอร์ดก่อนครับ" },
      ]);
      continue;
    }

    const { data: device } = await supabase
      .from("devices")
      .select("id, pipe_size")
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (!device) {
      await replyLineMessage(event.replyToken, [
        { type: "text", text: "บัญชีนี้ยังไม่มีอุปกรณ์ผูกไว้ กรุณาติดต่อผู้ดูแลระบบครับ" },
      ]);
      continue;
    }

    if (event.type === "follow") {
      await replyLineMessage(event.replyToken, [
        { type: "text", text: "เชื่อมต่อสำเร็จ! รับแจ้งเตือนอัตโนมัติเมื่อพบน้ำไม่ไหลหรือน้ำไหลนานผิดปกติได้เลยครับ" },
        QUICK_REPLY_MENU,
      ]);
      continue;
    }

    if (event.type === "message" && event.message?.type === "text") {
      const answer = await handleTextQuery(device.id, (device.pipe_size as string) ?? '3/4"', event.message.text ?? "");
      if (answer) {
        await replyLineMessage(event.replyToken, [{ type: "text", text: answer }]);
      } else {
        await replyLineMessage(event.replyToken, [QUICK_REPLY_MENU]);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
