import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "Acceptable Use Policy for Khan Automation Systems."
};

export default function AcceptableUsePage() {
  return (
    <main className="container py-14 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-background/95 px-6 py-10 shadow-sm sm:px-10">
        <header className="space-y-4 border-b border-border/70 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Acceptable Use Policy
            </h1>
            <p className="text-sm text-muted-foreground">Effective Date: March 11, 2026</p>
          </div>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Prohibited Uses</h2>
            <p>You may not use Khan Automation Systems to:</p>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">Impersonate other people or businesses.</li>
              <li className="list-disc">Send spam, unsolicited messages, or abusive communications.</li>
              <li className="list-disc">Conduct fraudulent or deceptive activity.</li>
              <li className="list-disc">Violate telecommunications, privacy, or messaging laws.</li>
              <li className="list-disc">Abuse the platform or attempt to bypass platform safeguards or controls.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Enforcement</h2>
            <p>
              We may suspend, restrict, or terminate access to the platform if we believe an account is violating this
              policy, creating legal risk, or threatening the security or reliability of the service.
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
                href="/privacy"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
