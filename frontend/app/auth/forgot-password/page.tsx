"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { requestPasswordReset } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
      showToast({
        title: "Check your email",
        description: "If the account exists, a reset link was sent."
      });
    } catch (error) {
      showToast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Could not request password reset.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/auth/login" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,430px)] lg:items-start">
          <section className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white/70 p-6 shadow-[0_24px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Credential recovery</p>
            <h1 className="text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">Reset your password</h1>
            <p className="text-sm leading-7 text-slate-600">
              Enter your account email and we&apos;ll send a secure reset link. For security, we show the same response whether or not the account exists.
            </p>
          </section>
          <Card className="mx-auto w-full max-w-md border-slate-200/90 bg-white/95 shadow-[0_28px_56px_-34px_rgba(15,23,42,0.45)]">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-slate-500" />
                Forgot password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Sending..." : "Send reset link"}
                </Button>
              </form>
              {submitted ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  If the email is registered, you will receive a reset link shortly.
                </p>
              ) : null}
              <p className="mt-4 text-sm text-muted-foreground">
                Remembered your password?{" "}
                <Link href="/auth/login" className="font-medium text-primary">
                  Back to login
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
