// สคริปต์ครั้งเดียว: สร้างมิเตอร์ 1 ตัว + ข้อมูล readings จำลองย้อนหลัง 24 ชม. ลง Supabase
// รัน: node scripts/seed-demo-data.mjs (ต้องมี env vars โหลดไว้ก่อน ดู README)
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("ขาด NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ในตัวแปรแวดล้อม");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const DEVICE_KEY = "demo-device-key-001"; // เปลี่ยนได้ตามต้องการ ใช้คู่กับ x-device-key ตอนยิงเข้า /api/ingest จริง
const DEVICE_KEY_HASH = createHash("sha256").update(DEVICE_KEY).digest("hex");

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// อัตราการไหลจำลองตามช่วงเวลาในหนึ่งวัน (สูงตอนเช้า/เย็น ต่ำตอนดึก)
function expectedFlowForHour(hour) {
  if (hour >= 6 && hour < 9) return randomInRange(8, 18); // เช้า
  if (hour >= 11 && hour < 13) return randomInRange(4, 10); // เที่ยง
  if (hour >= 17 && hour < 21) return randomInRange(10, 22); // เย็น
  if (hour >= 0 && hour < 5) return randomInRange(0, 1); // ดึก แทบไม่ใช้น้ำ
  return randomInRange(1, 5); // ช่วงอื่น
}

async function main() {
  console.log("กำลังสร้าง/หา device...");
  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("device_key_hash", DEVICE_KEY_HASH)
    .maybeSingle();

  let deviceId = existing?.id;

  if (!deviceId) {
    const { data: inserted, error: insertDeviceError } = await supabase
      .from("devices")
      .insert({
        name: "มิเตอร์น้ำหลัก (ทดสอบ)",
        device_key_hash: DEVICE_KEY_HASH,
        location: "หน้าบ้าน",
        firmware_version: "sim-1.0.0",
      })
      .select("id")
      .single();

    if (insertDeviceError) {
      console.error("สร้าง device ไม่สำเร็จ:", insertDeviceError.message);
      process.exit(1);
    }
    deviceId = inserted.id;
    console.log("สร้าง device ใหม่:", deviceId);
  } else {
    console.log("ใช้ device เดิมที่มีอยู่แล้ว:", deviceId);
    await supabase.from("readings").delete().eq("device_id", deviceId);
    console.log("ล้างข้อมูล readings เก่าของ device นี้แล้ว");
  }

  console.log("กำลังสร้างข้อมูล readings ย้อนหลัง 24 ชั่วโมง (ทุก 15 นาที)...");

  const now = new Date();
  const intervalMinutes = 15;
  const points = (24 * 60) / intervalMinutes; // 96 จุด
  const rows = [];

  for (let i = points; i >= 0; i--) {
    const recordedAt = new Date(now.getTime() - i * intervalMinutes * 60_000);
    const hour = recordedAt.getHours();
    const flowRateLpm = Number(expectedFlowForHour(hour).toFixed(2));
    const volumeLiters = Number((flowRateLpm * intervalMinutes).toFixed(2));

    rows.push({
      device_id: deviceId,
      recorded_at: recordedAt.toISOString(),
      flow_rate_lpm: flowRateLpm,
      volume_liters: volumeLiters,
      wifi_rssi: Math.round(randomInRange(-70, -45)),
      battery_percent: null,
    });
  }

  const { error: insertReadingsError } = await supabase.from("readings").insert(rows);
  if (insertReadingsError) {
    console.error("เพิ่ม readings ไม่สำเร็จ:", insertReadingsError.message);
    process.exit(1);
  }
  console.log(`เพิ่ม readings สำเร็จ ${rows.length} แถว`);

  const last = rows[rows.length - 1];
  await supabase
    .from("devices")
    .update({
      last_seen_at: last.recorded_at,
      last_flow_rate_lpm: last.flow_rate_lpm,
      last_wifi_rssi: last.wifi_rssi,
      last_battery_percent: last.battery_percent,
    })
    .eq("id", deviceId);

  console.log("อัปเดตสถานะล่าสุดของ device แล้ว");
  console.log("\nเสร็จแล้ว! device_id =", deviceId);
  console.log("device key (สำหรับทดสอบยิงข้อมูลจริงผ่าน /api/ingest):", DEVICE_KEY);
}

main();
