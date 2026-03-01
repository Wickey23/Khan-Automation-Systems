import Link from "next/link";
import { Button } from "@/components/ui/button";
import { navLinks, siteConfig } from "@/lib/config";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          {siteConfig.name} <span className="text-xs text-muted-foreground">v__</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/book">Book a 15-min Call</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
