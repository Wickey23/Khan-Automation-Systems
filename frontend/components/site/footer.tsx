import Link from "next/link";
import { siteConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container grid gap-6 py-10 md:grid-cols-2">
        <div>
          <p className="text-base font-semibold">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Engineering-focused automation systems for service businesses.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Contact</p>
          <p className="text-muted-foreground">hello@khanautomationsystems.com</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <a href="#" className="text-muted-foreground hover:text-foreground">
              LinkedIn Placeholder
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
