import { redirect } from "next/navigation";

export default function ResetPasswordAliasPage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  const token = String(searchParams?.token || "").trim();
  redirect(token ? `/auth/reset-password?token=${encodeURIComponent(token)}` : "/auth/reset-password");
}
