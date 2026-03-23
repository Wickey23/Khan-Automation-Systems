import { LoginForm } from "@/components/site/login-form";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { email?: string };
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_52%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <PublicNav />
      <main className="container py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(0,430px)] lg:items-center">
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operator access</p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">Front Desk OS Login</h1>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              Sign in to manage live calls, approvals, follow-up queues, and customer communication from one control plane.
            </p>
          </section>
          <LoginForm defaultEmail={searchParams?.email ?? ""} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
