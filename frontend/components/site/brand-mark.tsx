import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  iconOnly?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  iconTone?: "default" | "starter" | "pro";
};

const sizeClasses = {
  sm: {
    icon: "h-8 w-8",
    khan: "text-lg",
    systems: "text-[0.58rem] tracking-[0.22em]"
  },
  md: {
    icon: "h-10 w-10",
    khan: "text-2xl",
    systems: "text-[0.62rem] tracking-[0.24em]"
  },
  lg: {
    icon: "h-12 w-12",
    khan: "text-[1.85rem]",
    systems: "text-[0.7rem] tracking-[0.26em]"
  }
} as const;

function KIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect x="1.5" y="1.5" width="61" height="61" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M16 13 H26 V51 H16 Z"
        fill="currentColor"
      />
      <path
        d="M29.5 29.8 L46.5 13 H57 L38.8 30.7 L57 51 H46.2 L31.5 34.5 L29.5 36.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Lockup({
  size,
  className,
  iconTone = "default"
}: {
  size: keyof typeof sizeClasses;
  className?: string;
  iconTone?: "default" | "starter" | "pro";
}) {
  const iconToneClass =
    iconTone === "starter" ? "text-primary" : iconTone === "pro" ? "text-foreground" : "text-foreground";

  return (
    <span className={cn("inline-flex items-center gap-3 text-foreground", className)}>
      <KIcon className={cn(sizeClasses[size].icon, iconToneClass)} />
      <span className="inline-flex flex-col leading-none">
        <span className={cn("font-black uppercase tracking-[0.02em]", sizeClasses[size].khan)}>Khan</span>
        <span className={cn("mt-1 font-medium uppercase text-muted-foreground", sizeClasses[size].systems)}>Systems</span>
      </span>
    </span>
  );
}

export function BrandMark({ href, iconOnly = false, className, size = "md", iconTone = "default" }: BrandMarkProps) {
  const iconToneClass =
    iconTone === "starter" ? "text-primary" : iconTone === "pro" ? "text-foreground" : "text-foreground";

  if (!href) {
    return iconOnly ? (
      <KIcon className={cn(sizeClasses[size].icon, iconToneClass, className)} />
    ) : (
      <Lockup size={size} className={className} iconTone={iconTone} />
    );
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center", className)}
      aria-label="Khan Systems"
    >
      {iconOnly ? <KIcon className={cn(sizeClasses[size].icon, iconToneClass)} /> : <Lockup size={size} iconTone={iconTone} />}
    </Link>
  );
}
