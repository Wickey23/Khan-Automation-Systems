"use client";

import { useEffect } from "react";
import { authLogout } from "@/lib/api";

export default function AuthLogoutPage() {
  useEffect(() => {
    void authLogout().finally(() => {
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    });
  }, []);

  return <div className="container py-12 text-sm text-muted-foreground">Signing out...</div>;
}
