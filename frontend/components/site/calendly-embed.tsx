import { siteConfig } from "@/lib/config";

export function CalendlyEmbed() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <iframe
        src={siteConfig.calendlyUrl}
        title="Book Discovery Call"
        className="h-[700px] w-full border-0"
        loading="lazy"
      />
    </div>
  );
}
