import type { Metadata } from "next";
import { Eye, FileText, Lock, Shield } from "lucide-react";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Front Desk OS by Khan Systems."
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900">
      <PublicNav />
      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">
              <Shield size={12} />
              Privacy Policy
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Your privacy is our <span className="font-serif italic text-[#3caff6]">operational priority.</span>
            </h1>
            <p className="text-xl leading-relaxed text-slate-500">
              Front Desk OS by Khan Systems handles call data, transcripts, messages, and customer records as part of front-desk operations.
              This policy explains what we collect, how it is used, and how we protect it.
            </p>
          </div>

          <div className="space-y-12">
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <FileText className="text-[#3caff6]" size={24} />
                1. Information We Collect
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We collect the information needed to provide Front Desk OS, including:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li><strong>Account Information:</strong> Name, email, business address, and billing details.</li>
                  <li><strong>Call Data:</strong> Audio recordings, automated transcripts, summaries, and operational metadata.</li>
                  <li><strong>Messaging Data:</strong> SMS and text-based communications sent through missed-call recovery or follow-up flows.</li>
                  <li><strong>Customer Information:</strong> Contact details, intent, urgency, and booking requests captured during calls.</li>
                  <li><strong>Technical Data:</strong> IP addresses, browser types, and diagnostic logs used to maintain the service.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Eye className="text-[#3caff6]" size={24} />
                2. How We Use Data
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>Your data is used to operate and improve Front Desk OS.</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Provide AI receptionist coverage and call handling.</li>
                  <li>Generate summaries, lead records, and booking requests for your team.</li>
                  <li>Support scheduling workflows and calendar-related logic.</li>
                  <li>Deliver analytics, diagnostics, and operational reporting.</li>
                  <li>Improve platform performance using de-identified data where appropriate.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Lock className="text-[#3caff6]" size={24} />
                3. Data Security &amp; Retention
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We use administrative, technical, and organizational safeguards to protect customer information.</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li><strong>Encryption:</strong> Data is protected in transit and at rest using standard security controls.</li>
                  <li><strong>Access Control:</strong> Internal access is restricted to authorized personnel for support and operational needs.</li>
                  <li><strong>Retention:</strong> Call recordings and transcripts are retained according to subscription needs, legal requirements, and deletion requests where applicable.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">4. Third-Party Providers</h2>
              <p className="leading-relaxed text-slate-600">
                We rely on trusted providers such as AWS, Twilio, Stripe, and model providers to deliver infrastructure, billing, and AI capabilities.
                These providers are used only as needed to operate the service.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">5. Your Rights</h2>
              <p className="leading-relaxed text-slate-600">
                You may request access, correction, or deletion of certain personal and business information. Some data can be managed through your workspace,
                and additional requests can be directed to our team.
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Contact Privacy Team</h2>
              <p className="mb-4 text-slate-600">Questions about privacy or data handling can be sent to our privacy contact.</p>
              <p className="font-bold text-[#3caff6]">privacy@khansystems.com</p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
