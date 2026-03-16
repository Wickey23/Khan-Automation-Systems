import type { Metadata } from "next";
import { AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";
import { siteContact } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for Front Desk OS by Khan Systems."
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900">
      <PublicNav />
      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">
              <FileText size={12} />
              Terms of Service
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Clear terms for <span className="font-serif italic text-[#3caff6]">reliable operations.</span>
            </h1>
            <p className="text-xl leading-relaxed text-slate-500">
              These terms govern use of Front Desk OS by Khan Systems. They are designed to reflect how the product is actually deployed:
              with structured onboarding, setup fees, and operational safeguards.
            </p>
          </div>

          <div className="space-y-12">
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <CheckCircle2 className="text-[#3caff6]" size={24} />
                1. Service Overview
              </h2>
              <p className="leading-relaxed text-slate-600">
                Front Desk OS is an AI-powered receptionist platform used to handle inbound calls, qualify leads, assist with appointment requests,
                support message follow-up, and provide operators and administrators with operational visibility.
              </p>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Clock className="text-[#3caff6]" size={24} />
                2. Implementation &amp; Onboarding
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>New accounts go through a structured onboarding process before live production use.</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li><strong>Setup Fees:</strong> One-time setup fees cover AI configuration, workflow review, and rollout preparation.</li>
                  <li><strong>Go-Live:</strong> Activation occurs only after workflows are verified for your business logic and routing model.</li>
                  <li><strong>Number Ownership:</strong> You may forward calls or port numbers while retaining ownership of your business number.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <AlertCircle className="text-[#3caff6]" size={24} />
                3. Billing &amp; Subscriptions
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>The billing structure is tied to implementation quality and operational partnership.</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li><strong>Subscription Fees:</strong> Monthly fees are billed in advance.</li>
                  <li><strong>Commitment Terms:</strong> Some plans include 6- or 12-month terms, while others may be month-to-month or shorter-term.</li>
                  <li><strong>Usage Costs:</strong> Separate carrier or provider usage costs may apply depending on telephony and messaging volume.</li>
                  <li><strong>Price Lock:</strong> Founding Partner plans include a fixed early pricing period from activation.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">4. Acceptable Use</h2>
              <p className="leading-relaxed text-slate-600">
                The service may only be used for lawful business communications. Telemarketing spam, abusive messaging, fraudulent use,
                or workflows that violate applicable communications laws are prohibited.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">5. Limitation of Liability</h2>
              <p className="leading-relaxed text-slate-600">
                Front Desk OS includes AI-generated transcripts, summaries, and routing logic that may occasionally contain errors.
                Khan Systems is not responsible for indirect damages, business losses, or lost opportunities arising from service interruptions,
                misinterpretations, or customer misuse of the platform.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">6. Termination</h2>
              <p className="leading-relaxed text-slate-600">
                Subscriptions may be cancelled according to plan-specific commitment terms. After termination, you will have a limited export window
                for operational records before production data is removed under retention policies.
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Legal Inquiries</h2>
              <p className="mb-4 text-slate-600">Formal legal questions about these terms may be sent to our legal contact.</p>
              <p className="font-bold text-[#3caff6]">{siteContact.legalEmail}</p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
