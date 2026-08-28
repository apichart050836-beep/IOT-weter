"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase/client";
import { getDemoUser, demoLogout } from "./demoAuth";

export interface Session {
  isAuthenticated: boolean;
  checked: boolean;
  displayName: string | null;
  signOut: () => void;
}

// รวมสถานะ login ไว้ที่เดียว: ใช้ Firebase Auth จริงถ้าตั้งค่าไว้แล้ว
// ไม่งั้น fallback ไปที่บัญชีทดสอบใน lib/demoAuth.ts
export function useSession(): Session {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isFirebaseConfigured) {
      return onAuthStateChanged(auth, (u) => {
        setFirebaseUser(u);
        setChecked(true);
      });
    }
    setDemoUser(getDemoUser());
    setChecked(true);
  }, []);

  const isAuthenticated = isFirebaseConfigured ? !!firebaseUser : !!demoUser;
  const displayName = isFirebaseConfigured ? (firebaseUser?.email ?? null) : demoUser;

  function signOut() {
    if (isFirebaseConfigured) {
      firebaseSignOut(auth);
    } else {
      demoLogout();
      setDemoUser(null);
    }
  }

  return { isAuthenticated, checked, displayName, signOut };
}
