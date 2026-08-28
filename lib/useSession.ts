"use client";

import { useEffect, useState } from "react";
import type { Session as SupabaseAuthSession } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase/client";
import { getDemoUser, demoLogout } from "./demoAuth";

export interface Session {
  isAuthenticated: boolean;
  checked: boolean;
  displayName: string | null;
  signOut: () => void;
}

// รวมสถานะ login ไว้ที่เดียว: ใช้ Supabase Auth จริงถ้าตั้งค่าไว้แล้ว
// ไม่งั้น fallback ไปที่บัญชีทดสอบใน lib/demoAuth.ts
export function useSession(): Session {
  const [authSession, setAuthSession] = useState<SupabaseAuthSession | null>(null);
  const [demoUser, setDemoUser] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        setAuthSession(data.session);
        setChecked(true);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthSession(session);
      });
      return () => subscription.unsubscribe();
    }
    setDemoUser(getDemoUser());
    setChecked(true);
  }, []);

  const isAuthenticated = isSupabaseConfigured ? !!authSession : !!demoUser;
  const displayName = isSupabaseConfigured ? (authSession?.user.email ?? null) : demoUser;

  function signOut() {
    if (isSupabaseConfigured) {
      supabase.auth.signOut();
    } else {
      demoLogout();
      setDemoUser(null);
    }
  }

  return { isAuthenticated, checked, displayName, signOut };
}
