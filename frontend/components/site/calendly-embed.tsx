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
        <h3 className="text-lg font-semibold">Booking link not configured</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Set <code>NEXT_PUBLIC_CALENDLY_URL</code> to your full Calendly booking URL (for example:
          <code> https://calendly.com/your-handle/15min</code>).
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
