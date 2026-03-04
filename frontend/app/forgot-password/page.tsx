import { redirect } from "next/navigation";

export default function ForgotPasswordAliasPage() {
  redirect("/auth/forgot-password");
}
