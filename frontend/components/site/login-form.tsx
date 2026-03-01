"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authLogin, authResendLoginOtp, authVerifyLoginOtp } from "@/lib/api";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validation";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: defaultEmail, password: "" }
  });

  async function onSubmit(values: AdminLoginInput) {
    try {
      const data = await authLogin(values.email, values.password);
      if (data.requiresTwoFactor) {
        setChallengeId(data.challengeId);
        setMaskedEmail(data.email);
        setStep("otp");
        showToast({ title: "Verification required", description: "Enter the 6-digit code sent to your email." });
        return;
      }

      showToast({ title: "Logged in" });
      if (data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN") {
        router.push("/admin/orgs");
      } else {
        router.push("/app");
      }
    } catch (error) {
      showToast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "error"
      });
    }
  }

  async function onVerifyOtp() {
    setOtpLoading(true);
    try {
      const email = getValues("email");
      const data = await authVerifyLoginOtp(email, challengeId, otpCode);
      showToast({ title: "Logged in" });
      if (data.user.role === "SUPER_ADMIN" || data.user.role === "ADMIN") {
        router.push("/admin/orgs");
      } else {
        router.push("/app");
      }
    } catch (error) {
      showToast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Invalid code.",
        variant: "error"
      });
    } finally {
      setOtpLoading(false);
    }
  }

  async function onResendOtp() {
    setResendLoading(true);
    try {
      const email = getValues("email");
      const data = await authResendLoginOtp(email, challengeId);
      setChallengeId(data.challengeId);
      setMaskedEmail(data.email);
      showToast({ title: "New code sent", description: "Check your email for the latest verification code." });
    } catch (error) {
      showToast({
        title: "Resend failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        {step === "credentials" ? (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {maskedEmail}.</p>
            <div className="space-y-1.5">
              <Label htmlFor="otpCode">Verification code</Label>
              <Input id="otpCode" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <Button className="w-full" onClick={onVerifyOtp} disabled={otpLoading || otpCode.length !== 6}>
              {otpLoading ? "Verifying..." : "Verify code"}
            </Button>
            <Button variant="outline" className="w-full" onClick={onResendOtp} disabled={resendLoading}>
              {resendLoading ? "Sending..." : "Resend code"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("credentials");
                setOtpCode("");
                setChallengeId("");
              }}
            >
              Back to login
            </Button>
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
