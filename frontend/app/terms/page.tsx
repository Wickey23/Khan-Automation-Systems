import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="container max-w-4xl py-14">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">
        <p>
          By using this site and submitting forms, you consent to communication regarding requested services and implementation planning.
        </p>
        <p>Service proposals, pricing, and scope are finalized in signed agreements.</p>
        <p>All product names and integrations listed are placeholders unless explicitly contracted.</p>
      </div>
    </div>
  );
}
