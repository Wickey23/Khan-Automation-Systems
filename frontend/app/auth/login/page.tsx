import { LoginForm } from "@/components/site/login-form";

export default function AuthLoginPage({
  searchParams
}: {
  searchParams?: { email?: string };
}) {
  return (
    <div className="container py-16">
      <LoginForm defaultEmail={searchParams?.email ?? ""} />
    </div>
  );
}
