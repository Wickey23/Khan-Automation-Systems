import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";
import { siteConfig } from "@/lib/config";
import { siteContact } from "@/lib/site-contact";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/75 backdrop-blur">
      <div className="container grid gap-8 py-12 md:grid-cols-2">
        <div className="space-y-3">
          <BrandMark href="/" size="sm" />
          <p className="text-sm text-slate-600">Structured automation infrastructure for service operations.</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Automate - Intelligently - Scale</p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-slate-900">Legal & Contact</p>
          <p className="text-slate-600">{siteContact.generalEmail}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="text-slate-600 hover:text-slate-900">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-slate-600 hover:text-slate-900">
              Terms of Service
            </Link>
            <Link href="/acceptable-use" className="text-slate-600 hover:text-slate-900">
              Acceptable Use
            </Link>
          </div>
          <p className="pt-2 text-xs text-slate-500">(c) {new Date().getFullYear()} {siteConfig.name}</p>
        </div>
      </div>
    </footer>
  );
}
