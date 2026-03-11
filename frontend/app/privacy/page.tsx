import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Khan Automation Systems."
};

export default function PrivacyPage() {
  return (
    <main className="container py-14 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-background/95 px-6 py-10 shadow-sm sm:px-10">
        <header className="space-y-4 border-b border-border/70 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Effective Date: March 11, 2026</p>
          </div>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">What We Collect</h2>
            <p>
              Khan Automation Systems collects information needed to operate the platform and support customer
              communication workflows.
            </p>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">Business account information such as company details, user accounts, and login information.</li>
              <li className="list-disc">Phone numbers and contact details used for calls, messaging, lead routing, and follow-up.</li>
              <li className="list-disc">Call recordings, call transcripts, summaries, and related call metadata.</li>
              <li className="list-disc">Messages sent through the system, including operational SMS history and replies.</li>
              <li className="list-disc">Customer leads, appointment requests, and intake information captured through the platform.</li>
              <li className="list-disc">Analytics, usage, and performance data used to operate and improve the service.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">How We Use Information</h2>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">Provide account access, communications workflows, lead capture, and reporting.</li>
              <li className="list-disc">Monitor reliability, secure the platform, investigate errors, and prevent misuse.</li>
              <li className="list-disc">Support billing, onboarding, support requests, and product improvements.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Third-Party Services</h2>
            <p>
              We use third-party providers to deliver core parts of the service. These providers may process data as
              needed to provide their infrastructure and services.
            </p>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">Twilio for communications infrastructure, including calls and messaging.</li>
              <li className="list-disc">Stripe for billing, subscription management, and payment processing.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Data Security</h2>
            <p>
              We use reasonable administrative, technical, and organizational safeguards designed to protect customer
              data. No system can guarantee absolute security, but access is restricted and monitored.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">User Responsibilities</h2>
            <p>
              Customers are responsible for complying with applicable laws governing privacy, telecommunications,
              messaging, call recording, and call transcription.
            </p>
            <p>
              If calls may be recorded or transcribed, the business using the platform is responsible for informing
              callers and obtaining any required consent under applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Related Policies</h2>
            <p>
              Please also review our{" "}
              <Link href="/terms" className="font-medium text-foreground underline decoration-border underline-offset-4">
                Terms of Service
              </Link>
              {" "}and{" "}
              <Link
                href="/acceptable-use"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                Acceptable Use Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
