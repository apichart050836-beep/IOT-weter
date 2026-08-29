import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const LOGIN_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID;
const LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET;
const MESSAGING_CHANNEL_SECRET = process.env.LINE_MESSAGING_CHANNEL_SECRET;
const MESSAGING_ACCESS_TOKEN = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

export const isLineLoginConfigured = Boolean(LOGIN_CHANNEL_ID && LOGIN_CHANNEL_SECRET);
export const isLineMessagingConfigured = Boolean(MESSAGING_CHANNEL_SECRET && MESSAGING_ACCESS_TOKEN);

interface LineTokenResponse {
  access_token: string;
  id_token?: string;
}

export async function exchangeLineLoginCode(code: string, redirectUri: string): Promise<LineTokenResponse> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LOGIN_CHANNEL_ID ?? "",
      client_secret: LOGIN_CHANNEL_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${await res.text()}`);
  }
  return res.json();
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LINE profile fetch failed: ${await res.text()}`);
  }
  return res.json();
}

export async function pushLineMessage(toUserId: string, text: string): Promise<void> {
  if (!isLineMessagingConfigured) return;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MESSAGING_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: toUserId, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    console.error("LINE push failed:", await res.text());
  }
}

export async function replyLineMessage(replyToken: string, messages: unknown[]): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MESSAGING_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error("LINE reply failed:", await res.text());
  }
}

// ตรวจลายเซ็น webhook ตามสเปค LINE (HMAC-SHA256 ของ raw body ด้วย Channel Secret, เทียบแบบ base64)
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !MESSAGING_CHANNEL_SECRET) return false;
  const expected = createHmac("sha256", MESSAGING_CHANNEL_SECRET).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const QUICK_REPLY_MENU = {
  type: "text" as const,
  text: "เลือกดูข้อมูลได้เลยครับ 💧",
  quickReply: {
    items: [
      { type: "action", action: { type: "message", label: "ใช้น้ำวันนี้", text: "ใช้น้ำวันนี้" } },
      { type: "action", action: { type: "message", label: "ใช้น้ำเดือนนี้", text: "ใช้น้ำเดือนนี้" } },
      { type: "action", action: { type: "message", label: "บิลค่าน้ำปัจจุบัน", text: "บิลค่าน้ำปัจจุบัน" } },
    ],
  },
};
