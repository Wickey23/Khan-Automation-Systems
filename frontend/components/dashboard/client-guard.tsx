"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function ClientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"checking" | "allowed" | "redirecting">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function tryGetMe() {
      try {
        return await getMe();
      } catch {
        return null;
      }
    }

    async function load() {
      const first = await tryGetMe();
      const data = first
        ? first
        : await new Promise<Awaited<ReturnType<typeof getMe>> | null>((resolve) => {
            retryTimer = setTimeout(() => {
              void tryGetMe().then(resolve);
            }, 450);
          });

      if (!active) return;
      if (!data) {
        setErrorMessage("Could not verify session. Check your connection and retry.");
        setStatus("checking");
        return;
      }

      setErrorMessage(null);
      if (!["CLIENT", "CLIENT_ADMIN", "CLIENT_STAFF"].includes(data.user.role)) {
        setStatus("redirecting");
        router.replace("/auth/login");
        return;
      }
      setUser(data.user);
      setStatus("allowed");
    }
    void load();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname, router]);

  if (status !== "allowed" || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace access</p>
          <p className="mt-2 text-sm text-slate-700">{errorMessage || "Checking access..."}</p>
          {errorMessage ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setErrorMessage(null);
                setStatus("checking");
                const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
                router.replace(`/auth/login${next}`);
              }}
            >
              Go to login
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
