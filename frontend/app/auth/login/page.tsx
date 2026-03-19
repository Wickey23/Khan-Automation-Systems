import { LoginForm } from "@/components/site/login-form";
import { PublicNav } from "@/components/site/public-nav";
import { PublicFooter } from "@/components/site/public-footer";

export default function AuthLoginPage({
  searchParams
}: {
  searchParams?: { email?: string };
}) {
  return (
    <div className="min-h-screen bg-[#f5f7f8] flex flex-col font-sans text-slate-900 selection:bg-sky-100 selection:text-sky-700">
      <PublicNav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-32">
        <div className="w-full max-w-md">
          <LoginForm defaultEmail={searchParams?.email ?? ""} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
