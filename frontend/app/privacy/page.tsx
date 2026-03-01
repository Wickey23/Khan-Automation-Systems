import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-4xl py-14">
      <h1 className="text-4xl font-bold">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">
        <p>
          Khan Automation Systems collects submitted lead data to respond to service inquiries and deliver requested demos.
        </p>
        <p>We do not sell lead data. Access is restricted to authorized operators and service providers.</p>
        <p>To request data updates or deletion, contact: owner@khanautomationsystems.com.</p>
      </div>
    </div>
  );
}
