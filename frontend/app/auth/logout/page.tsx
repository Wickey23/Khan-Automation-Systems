"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authLogout } from "@/lib/api";

export default function AuthLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    void authLogout().finally(() => {
      router.replace("/");
    });
  }, [router]);

  return <div className="container py-12 text-sm text-muted-foreground">Signing out...</div>;
}
