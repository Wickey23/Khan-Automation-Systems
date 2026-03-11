"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { authSignup } from "@/lib/api";
import { signupSchema, type SignupInput } from "@/lib/validation";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      businessName: "",
      email: "",
      password: "",
      industry: "",
      agreeToLegal: false
    }
  });

  async function onSubmit(values: SignupInput) {
    try {
      await authSignup({
        name: values.name,
        businessName: values.businessName,
        email: values.email,
        password: values.password,
        industry: values.industry
      });
      showToast({ title: "Account created" });
      router.push("/app/onboarding");
    } catch (error) {
      showToast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Create your workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business">Business</Label>
              <Input id="business" {...register("businessName")} />
              {errors.businessName ? <p className="text-xs text-red-600">{errors.businessName.message}</p> : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" {...register("industry")} placeholder="Truck Repair / HVAC / Auto Repair..." />
          </div>
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
          <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/25 px-4 py-3">
            <label className="flex items-start gap-3 text-sm text-foreground/88">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border border-input"
                {...register("agreeToLegal")}
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agreeToLegal ? <p className="text-xs text-red-600">{errors.agreeToLegal.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
