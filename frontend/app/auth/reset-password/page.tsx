"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { resetPasswordWithToken } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setToken(String(params.get("token") || "").trim());
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      showToast({ title: "Invalid link", description: "Missing reset token.", variant: "error" });
      return;
    }
    if (password.length < 8) {
      showToast({ title: "Password too short", description: "Use at least 8 characters.", variant: "error" });
      return;
    }
    if (password !== confirmPassword) {
      showToast({ title: "Passwords do not match", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, password);
      showToast({ title: "Password reset", description: "You can now sign in with your new password." });
      router.push("/auth/login");
    } catch (error) {
      showToast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Could not reset password.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.13),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/auth/login" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,430px)] lg:items-start">
          <section className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white/70 p-6 shadow-[0_24px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Secure recovery</p>
            <h1 className="text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">Set a new password</h1>
            <p className="text-sm leading-7 text-slate-600">
              Choose a new password for this account. Once saved, use the new password for all future sign-ins.
            </p>
          </section>
          <Card className="mx-auto w-full max-w-md border-slate-200/90 bg-white/95 shadow-[0_28px_56px_-34px_rgba(15,23,42,0.45)]">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-500" />
                Reset password
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!token ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This reset link is missing a token. Request a new link from the{" "}
                  <Link href="/auth/forgot-password" className="font-medium text-amber-800 underline underline-offset-2">
                    forgot password page
                  </Link>
                  .
                </p>
              ) : (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Saving..." : "Reset password"}
                  </Button>
                </form>
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                Back to{" "}
                <Link href="/auth/login" className="font-medium text-primary">
                  login
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
