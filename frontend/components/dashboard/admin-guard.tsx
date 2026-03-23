"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function AdminGuard({
  children,
  requireSuperAdmin = false
}: {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

    async function check() {
      const first = await tryGetMe();
      const data = first
        ? first
        : await new Promise<Awaited<ReturnType<typeof getMe>> | null>((resolve) => {
            retryTimer = setTimeout(() => {
              void tryGetMe().then(resolve);
            }, 450);
          });

      if (!active) return;
      if (data) {
        setErrorMessage(null);
        if (!active) return;
        const isAdmin = data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN";
        const isAllowed = requireSuperAdmin ? data.user.role === "SUPER_ADMIN" : isAdmin;
        if (isAllowed) {
          setStatus("allowed");
          return;
        }
        setStatus("redirecting");
        router.replace("/app");
        return;
      }

      setErrorMessage("Could not validate session. Check your connection and retry.");
      setStatus("checking");
    }
    void check();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname, requireSuperAdmin, router]);

  if (status !== "allowed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Admin access</p>
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
