"use client";

// บัญชีทดสอบชั่วคราวสำหรับลองระบบ login ก่อนตั้งค่า Firebase Auth จริง
// ใช้ localStorage เก็บสถานะ ไม่ปลอดภัยสำหรับ production — ลบไฟล์นี้ทิ้งเมื่อเปลี่ยนไปใช้ Firebase Auth จริงแล้ว
export const DEMO_USERNAME = "admintest";
export const DEMO_PASSWORD = "admintest1234";

const STORAGE_KEY = "demo_auth_user";

export function demoLogin(username: string, password: string): boolean {
  if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, username);
    return true;
  }
  return false;
}

export function demoLogout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getDemoUser(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}
