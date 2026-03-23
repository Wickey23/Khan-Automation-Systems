import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Gavel, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "Acceptable Use Policy for Khan Automation Systems."
};

export default function AcceptableUsePage() {
  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_52%),linear-gradient(180deg,#f8fafc_0%,#fffbeb_100%)] py-14 sm:py-16">
      <div className="container">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="rounded-[28px] border border-slate-200/90 bg-white/92 px-6 py-8 shadow-[0_26px_50px_-34px_rgba(15,23,42,0.45)] sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Legal</p>
            <div className="mt-3 space-y-3">
              <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Acceptable Use Policy
              </h1>
              <p className="text-sm text-slate-500">Effective Date: March 11, 2026</p>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This policy defines prohibited behavior on Front Desk OS and explains how enforcement decisions protect customers, operators, and platform reliability.
            </p>
          </header>

          <div className="grid gap-4">
            <section className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                <Ban className="h-5 w-5 text-amber-600" />
                Prohibited Uses
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">You may not use Khan Automation Systems to:</p>
              <ul className="mt-2 space-y-2 pl-5 text-sm leading-7 text-slate-600">
                <li className="list-disc">Impersonate other people or businesses.</li>
                <li className="list-disc">Send spam, unsolicited messages, or abusive communications.</li>
                <li className="list-disc">Conduct fraudulent or deceptive activity.</li>
                <li className="list-disc">Violate telecommunications, privacy, or messaging laws.</li>
                <li className="list-disc">Abuse the platform or attempt to bypass platform safeguards or controls.</li>
              </ul>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                <Gavel className="h-5 w-5 text-slate-600" />
                Enforcement
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                We may suspend, restrict, or terminate access to the platform if we believe an account is violating this
                policy, creating legal risk, or threatening the security or reliability of the service.
              </p>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                <Scale className="h-5 w-5 text-slate-600" />
                Related Policies
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Please also review our{" "}
                <Link href="/terms" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
