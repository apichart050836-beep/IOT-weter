import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ข้าม initialize จริงตอน SSR/build หรือถ้ายังไม่ได้ตั้งค่า .env.local
// เพราะ getAuth() จะ throw ทันทีถ้า apiKey ว่าง/ไม่ครบ
// ทุกจุดที่ใช้ auth/db เป็นโค้ดฝั่ง client เท่านั้น (useEffect, event handler)
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);
const canInit = typeof window !== "undefined" && isFirebaseConfigured;

export const firebaseApp: FirebaseApp | undefined = canInit
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : undefined;

export const auth: Auth = firebaseApp ? getAuth(firebaseApp) : ({} as Auth);
export const db: Firestore = firebaseApp ? getFirestore(firebaseApp) : ({} as Firestore);
