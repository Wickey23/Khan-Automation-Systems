"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { authLogin } from "@/lib/api";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validation";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" }
  });

  async function onSubmit(values: AdminLoginInput) {
    try {
      const data = await authLogin(values.email, values.password);
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

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
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
