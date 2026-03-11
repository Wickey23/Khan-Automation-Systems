import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";
import { siteConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container grid gap-6 py-10 md:grid-cols-2">
        <div className="space-y-3">
          <BrandMark href="/" size="sm" />
          <p className="text-sm text-muted-foreground">Structured automation infrastructure for service operations.</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Automate - Intelligently - Scale</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Legal & Contact</p>
          <p className="text-muted-foreground">hello@khanautomationsystems.com</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/acceptable-use" className="text-muted-foreground hover:text-foreground">
              Acceptable Use
            </Link>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">(c) {new Date().getFullYear()} {siteConfig.name}</p>
        </div>
      </div>
    </footer>
  );
}
