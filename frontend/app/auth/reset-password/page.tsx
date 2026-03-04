"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
    <div className="container py-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-muted-foreground">
              This reset link is missing a token. Request a new link from the{" "}
              <Link href="/auth/forgot-password" className="font-medium text-primary">
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
  );
}
