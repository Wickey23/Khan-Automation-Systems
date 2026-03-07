import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Khan Automation Systems, including SMS messaging disclosures for appointment scheduling, service updates, and customer support."
};

const sections = [
  {
    heading: "Information We Collect",
    items: ["Name", "Phone number", "Email address", "Service request details", "Communication history"]
  },
  {
    heading: "How We Use Your Information",
    items: [
      "Respond to service requests",
      "Schedule appointments",
      "Provide customer support",
      "Send service notifications",
      "Improve our services"
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <main className="container py-14 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-background/95 px-6 py-10 shadow-sm sm:px-10">
        <header className="space-y-4 border-b border-border/70 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Effective Date: March 2026</p>
          </div>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Khan Automation Systems respects your privacy and is committed to protecting your personal information.
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
              <ul className="space-y-2 pl-5">
                {section.items.map((item) => (
                  <li key={item} className="list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">SMS Communication</h2>
            <p>If you provide your mobile phone number, you may receive SMS messages related to:</p>
            <ul className="space-y-2 pl-5">
              <li className="list-disc">appointment scheduling</li>
              <li className="list-disc">service updates</li>
              <li className="list-disc">customer support</li>
            </ul>
            <p>Message frequency varies. Message and data rates may apply.</p>
            <p>You may opt out at any time by replying STOP. For assistance reply HELP.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Information Sharing</h2>
            <p>
              We do not sell, rent, or share mobile phone numbers or personal information with third parties for
              marketing purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Data Security</h2>
            <p>We implement reasonable safeguards to protect personal information.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Contact</h2>
            <p>
              For questions regarding this policy contact:{" "}
              <a
                href="mailto:support@khanautomationsystems.com"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                support@khanautomationsystems.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
