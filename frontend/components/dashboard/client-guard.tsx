"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export function ClientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"checking" | "allowed" | "redirecting">("checking");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getMe();
        if (!active) return;
        if (!["CLIENT", "CLIENT_ADMIN", "CLIENT_STAFF"].includes(data.user.role)) {
          setStatus("redirecting");
          router.replace("/auth/login");
          return;
        }
        setUser(data.user);
        setStatus("allowed");
      } catch {
        if (!active) return;
        setStatus("redirecting");
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/auth/login${next}`);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (status !== "allowed" || !user) return <div className="container py-12 text-sm text-muted-foreground">Checking access...</div>;

  return <>{children}</>;
}
