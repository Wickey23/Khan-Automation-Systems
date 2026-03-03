import { siteConfig } from "@/lib/config";

function getValidCalendlyUrl(raw: string) {
  if (!raw || raw.includes("CALENDLY_LINK_HERE")) return null;
  try {
    const parsed = new URL(raw);
    const isCalendlyHost =
      parsed.hostname === "calendly.com" ||
      parsed.hostname.endsWith(".calendly.com") ||
      parsed.hostname === "calendly.page.link";
    return isCalendlyHost ? raw : null;
  } catch {
    return null;
  }
}

export function CalendlyEmbed() {
  const calendlyUrl = getValidCalendlyUrl(siteConfig.calendlyUrl);

  if (!calendlyUrl) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold">Direct scheduling is currently handled by our team</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Submit your details using the request form and we will reach out to confirm a time within one business day.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          If your request is urgent, include that in the message and preferred contact method.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <iframe
        src={calendlyUrl}
        title="Book Discovery Call"
        className="h-[700px] w-full border-0"
        loading="lazy"
      />
    </div>
  );
}
