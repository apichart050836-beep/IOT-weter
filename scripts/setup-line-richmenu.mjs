// สคริปต์ครั้งเดียว (รันซ้ำได้ปลอดภัย): สร้าง LINE Rich Menu แบบ 3 ปุ่ม (ใช้น้ำวันนี้ / ใช้น้ำเดือนนี้ / บิลค่าน้ำปัจจุบัน)
// แล้วตั้งเป็นเมนูเริ่มต้นให้ทุกคนที่แอด LINE OA
// ต้องมี LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ใน .env.local ก่อน (คนละตัวกับ LINE Login)
// รัน: node scripts/setup-line-richmenu.mjs
import fs from "fs";
import sharp from "sharp";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const ACCESS_TOKEN = env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error("ขาด LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ใน .env.local");
  process.exit(1);
}

const WIDTH = 2500;
const HEIGHT = 843;
const COLS = 3;
const COL_WIDTH = WIDTH / COLS;

const buttons = [
  { icon: "💧", label: "ใช้น้ำวันนี้", text: "ใช้น้ำวันนี้" },
  { icon: "📅", label: "ใช้น้ำเดือนนี้", text: "ใช้น้ำเดือนนี้" },
  { icon: "🧾", label: "บิลค่าน้ำปัจจุบัน", text: "บิลค่าน้ำปัจจุบัน" },
];

function buildSvg() {
  const btnMarginX = 40;
  const btnHeight = HEIGHT - 120;
  const btnY = 60;

  const rects = buttons
    .map((b, i) => {
      const x = i * COL_WIDTH + btnMarginX;
      const w = COL_WIDTH - btnMarginX * 2;
      const cx = x + w / 2;
      return `
        <rect x="${x}" y="${btnY}" width="${w}" height="${btnHeight}" rx="48"
          fill="#0f172a" stroke="#22d3ee" stroke-width="4" />
        <text x="${cx}" y="${btnY + btnHeight / 2 - 40}" font-size="140" text-anchor="middle" dominant-baseline="middle">${b.icon}</text>
        <text x="${cx}" y="${btnY + btnHeight / 2 + 140}" font-size="64" font-family="'Noto Sans Thai','Sarabun',sans-serif" font-weight="700" fill="#e2e8f0" text-anchor="middle" dominant-baseline="middle">${b.label}</text>
      `;
    })
    .join("\n");

  const dividers = [1, 2]
    .map((i) => `<line x1="${i * COL_WIDTH}" y1="80" x2="${i * COL_WIDTH}" y2="${HEIGHT - 80}" stroke="#1e293b" stroke-width="2" />`)
    .join("\n");

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#020617" />
      ${dividers}
      ${rects}
    </svg>
  `;
}

async function main() {
  console.log("กำลังสร้างรูปภาพ Rich Menu...");
  const pngBuffer = await sharp(Buffer.from(buildSvg())).png().toBuffer();

  console.log("กำลังสร้าง Rich Menu definition...");
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({
      size: { width: WIDTH, height: HEIGHT },
      selected: true,
      name: "AQUA-X main menu",
      chatBarText: "เมนู",
      areas: buttons.map((b, i) => ({
        bounds: { x: i * COL_WIDTH, y: 0, width: COL_WIDTH, height: HEIGHT },
        action: { type: "message", label: b.label, text: b.text },
      })),
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    console.error("สร้าง Rich Menu ไม่สำเร็จ:", created);
    process.exit(1);
  }
  const richMenuId = created.richMenuId;
  console.log("สร้างแล้ว richMenuId =", richMenuId);

  console.log("กำลังอัปโหลดรูปภาพ...");
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "Content-Type": "image/png", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: pngBuffer,
  });
  if (!uploadRes.ok) {
    console.error("อัปโหลดรูปไม่สำเร็จ:", await uploadRes.text());
    process.exit(1);
  }
  console.log("อัปโหลดรูปสำเร็จ");

  console.log("กำลังตั้งเป็นเมนูเริ่มต้นสำหรับทุกคน...");
  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!defaultRes.ok) {
    console.error("ตั้งเป็นเมนูเริ่มต้นไม่สำเร็จ:", await defaultRes.text());
    process.exit(1);
  }

  console.log("\nเสร็จแล้ว! ทุกคนที่แชทกับ LINE OA จะเห็นเมนู 3 ปุ่มนี้ที่แถบล่างของแชททันที");
}

main();
