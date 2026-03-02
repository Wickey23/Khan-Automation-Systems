import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="container max-w-4xl py-14">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        These billing terms are a summary. Final legal obligations are governed by your signed Master Services Agreement
        (MSA), Order Form, and any written amendments.
      </p>
      <div className="mt-8 space-y-6 text-sm text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">1. Plan Fees</h2>
          <p>Starter is billed at $297 per month. Pro is billed at $497 per month.</p>
          <p>Fees are charged in advance each monthly billing cycle unless otherwise stated in writing.</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">2. One-Time Setup Fee</h2>
          <p>
            A one-time setup fee is charged at initial activation to configure workflows, intake logic, and baseline
            provisioning: $199 for Starter, $299 for Pro.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">3. Included Usage</h2>
          <p>Starter includes up to 300 voice minutes per billing cycle.</p>
          <p>Pro includes up to 500 voice minutes and up to 1,000 SMS segments per billing cycle.</p>
          <p>Unused usage does not roll over unless explicitly listed in your signed agreement.</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">4. Overage Charges</h2>
          <p>
            Usage above included limits is billed at applicable carrier/provider pass-through rates plus Khan Automation
            Systems platform margin.
          </p>
          <p>
            Overage rates may vary by route, destination, and provider policy, and are reflected on billing statements or as
            defined in your order form.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">5. Messaging Compliance Fees</h2>
          <p>
            Customer is responsible for regulatory and carrier messaging compliance fees, including but not limited to A2P
            10DLC registration, campaign, and related recurring charges.
          </p>
          <p>
            Message filtering, throughput, and deliverability are subject to carrier rules and cannot be guaranteed by Khan
            Automation Systems.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">6. Payment Authorization and Failed Payment</h2>
          <p>
            By subscribing, you authorize recurring charges to your payment method for plan fees, overages, and applicable
            third-party pass-through charges.
          </p>
          <p>
            If payment fails, service may be downgraded, restricted, or suspended until account balance is cured.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">7. Plan Changes, Cancellation, and Renewal</h2>
          <p>
            Plan changes take effect according to Stripe billing cycle behavior unless your signed agreement specifies
            otherwise.
          </p>
          <p>
            Cancellation stops future renewals but does not waive accrued charges, overages, or prior commitments.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">8. Taxes and Third-Party Provider Charges</h2>
          <p>
            Taxes, governmental telecom surcharges, and third-party provider fees are billed where applicable and remain the
            customer&apos;s responsibility.
          </p>
        </section>
      </div>
    </div>
  );
}
