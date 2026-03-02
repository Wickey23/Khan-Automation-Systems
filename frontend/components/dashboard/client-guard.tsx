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
      <div className="container py-12 text-sm text-muted-foreground">
        <p>{errorMessage || "Checking access..."}</p>
        {errorMessage ? (
          <button
            type="button"
            className="mt-3 rounded border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => {
              setErrorMessage(null);
              setStatus("checking");
              const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
              router.replace(`/auth/login${next}`);
            }}
          >
            Go to login
          </button>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
