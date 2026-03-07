import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Terms and Conditions for Khan Automation Systems, including SMS disclosures for appointment scheduling, service confirmations, and customer support."
};

export default function TermsPage() {
  return (
    <main className="container py-14 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-background/95 px-6 py-10 shadow-sm sm:px-10">
        <header className="space-y-4 border-b border-border/70 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Terms and Conditions</h1>
            <p className="text-sm text-muted-foreground">Effective Date: March 2026</p>
          </div>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Program Description</h2>
            <p>
              Khan Automation Systems provides automated messaging related to customer service and appointment
              scheduling.
            </p>
            <p>By providing your phone number and requesting service, you agree to receive SMS messages regarding:</p>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">appointment scheduling</li>
              <li className="list-disc">service confirmations</li>
              <li className="list-disc">customer support responses</li>
              <li className="list-disc">follow ups regarding service requests</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Message Frequency</h2>
            <p>Message frequency varies depending on service activity.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Message and Data Rates</h2>
            <p>Standard message and data rates may apply depending on your mobile carrier.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Opt-Out Instructions</h2>
            <p>You may opt out of SMS messages at any time by replying STOP.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Help</h2>
            <p>
              For assistance reply HELP or contact:{" "}
              <a
                href="mailto:support@khanautomationsystems.com"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                support@khanautomationsystems.com
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Privacy</h2>
            <p>
              Your information is handled according to our Privacy Policy:{" "}
              <a
                href="/privacy-policy"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                /privacy-policy
              </a>
            </p>
            <p>Mobile information will not be shared with third parties or affiliates for marketing purposes.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
