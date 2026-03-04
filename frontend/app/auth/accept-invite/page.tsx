"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { acceptTeamInvite } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AcceptInvitePage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
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
      await acceptTeamInvite({ token, password });
      showToast({ title: "Invite accepted", description: "You can now log in to your workspace." });
      router.push("/auth/login");
    } catch (error) {
      showToast({
        title: "Could not accept invite",
        description: error instanceof Error ? error.message : "Try again.",
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
          <CardTitle>Accept team invite</CardTitle>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-muted-foreground">Invite token is missing. Ask your admin to resend the invite.</p>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="password">Create password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Accepting..." : "Accept invite"}
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
