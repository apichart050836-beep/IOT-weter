"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";

// เปิด NEXT_PUBLIC_SKIP_AUTH=true ใน .env.local เพื่อซ่อนหน้า login ชั่วคราว
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checked } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!SKIP_AUTH && checked && !isAuthenticated) {
      router.replace("/login");
    }
  }, [checked, isAuthenticated, router]);

  if (!SKIP_AUTH && (!checked || !isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-500">
        กำลังโหลด...
      </div>
    );
  }

  return <>{children}</>;
}
