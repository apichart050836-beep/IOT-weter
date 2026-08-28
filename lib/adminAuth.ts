import "server-only";

// รายชื่ออีเมลแอดมิน คั่นด้วย comma ใน .env.local เช่น ADMIN_EMAILS=a@x.com,b@y.com
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
