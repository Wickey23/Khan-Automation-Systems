import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Khan Automation Systems."
};

export default function TermsPage() {
  return (
    <main className="container py-14 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-background/95 px-6 py-10 shadow-sm sm:px-10">
        <header className="space-y-4 border-b border-border/70 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Effective Date: March 11, 2026</p>
          </div>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Service Description</h2>
            <p>
              Khan Automation Systems provides tools that help businesses handle incoming calls, capture customer
              requests, log communication activity, and send follow-up communication.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">No Guarantee</h2>
            <p>
              The platform assists with call intake, messaging, and workflow automation, but it does not guarantee that
              all calls, messages, transcripts, recordings, or customer requests will be captured or processed without
              delay, interruption, or error.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">AI Disclosure</h2>
            <p>
              Automated systems and AI tools may be used to assist with communication, transcription, summaries, lead
              capture, and follow-up workflows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Emergency Services Disclaimer</h2>
            <p>
              The Khan Automation Systems platform is not a replacement for emergency services. The service is designed
              to assist businesses with handling customer inquiries and call intake and should not be relied upon for
              emergency communications.
            </p>
            <p>
              Users should not use the platform to contact emergency services such as police, fire departments, or
              medical responders. Khan Automation Systems makes no guarantees regarding the handling of emergency
              situations or urgent communications and is not responsible for damages or losses resulting from reliance
              on the service during emergencies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Call Recording and Transcription</h2>
            <p>
              The platform may record or transcribe calls in order to provide call summaries, transcripts, and
              analytics.
            </p>
            <p>
              Customers using the platform are responsible for complying with all applicable laws related to call
              recording, transcription, consent, and notification of callers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Customer Responsibilities</h2>
            <p>
              Customers must comply with applicable telecommunications, privacy, messaging, and recording laws and are
              responsible for the communications, workflows, and notices they configure through the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Khan Automation Systems will not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, business,
              goodwill, data, or customers arising from or related to use of the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Related Policies</h2>
            <p>
              Please also review our{" "}
              <Link href="/privacy" className="font-medium text-foreground underline decoration-border underline-offset-4">
                Privacy Policy
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
