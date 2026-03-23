import { SignupForm } from "@/components/site/signup-form";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_52%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] text-slate-900">
      <PublicNav />
      <main className="container py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(0,520px)] lg:items-center">
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace setup</p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">Create Your Front Desk OS Workspace</h1>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              Set up your account and launch a production-ready receptionist workflow across calls, texts, bookings, and follow-up.
            </p>
          </section>
          <SignupForm />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
