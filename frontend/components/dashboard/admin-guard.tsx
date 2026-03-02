"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "allowed" | "redirecting">("checking");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const data = await getMe();
        if (!active) return;
        const isAdmin = data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN";
        if (isAdmin) {
          setStatus("allowed");
          return;
        }
        setStatus("redirecting");
        router.replace("/app");
      } catch {
        if (!active) return;
        setStatus("redirecting");
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/auth/login${next}`);
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (status !== "allowed") return <div className="container py-12 text-sm text-muted-foreground">Checking access...</div>;
  return <>{children}</>;
}
