"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
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
    <div className="container py-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
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
            <p className="mt-4 text-sm text-muted-foreground">
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
  );
}
