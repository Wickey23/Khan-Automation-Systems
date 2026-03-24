"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type QueueSurfaceStateCardProps = {
  kind: "loading" | "empty" | "error";
  message: string;
  title?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
};

export function QueueSurfaceStateCard({ kind, message, title, actionLabel, actionHref, onAction, className }: QueueSurfaceStateCardProps) {
  if (kind === "loading") {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 rounded-[2rem] glass-card inner-glow animate-pulse", className)}>
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{message}</span>
      </div>
    );
  }

  const toneClassName = kind === "error" ? "border-error/20 bg-error/5 text-error" : "glass-card";

  return (
    <div className={cn("rounded-[2rem] border p-12 text-center flex flex-col items-center justify-center inner-glow shadow-sm", toneClassName, className)}>
      <div className={cn("w-16 h-16 rounded-3xl mb-8 flex items-center justify-center shadow-md", kind === "error" ? "bg-error/10" : "bg-primary/5")}>
        <span className="material-symbols-outlined text-3xl">
          {kind === "error" ? "report" : "inbox"}
        </span>
      </div>
      {title ? <p className="text-xl font-black font-headline tracking-tighter text-on-surface mb-2">{title}</p> : null}
      <p className={cn("max-w-sm text-sm font-medium leading-relaxed", kind === "error" ? "text-error/80" : "text-on-surface-variant/70")}>{message}</p>
      {actionLabel ? (
        <div className="mt-8">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center rounded-xl bg-on-surface text-white px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg active:scale-95"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center rounded-xl bg-on-surface text-white px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg active:scale-95"
            >
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

type QueueSectionHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
};

export function QueueSectionHeader({ title, description, className, actions }: QueueSectionHeaderProps) {
  return (
    <div className={cn("rounded-2xl border border-outline-variant/10 bg-on-surface/5 px-6 py-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black font-label uppercase tracking-[0.2em] text-on-surface">{title}</p>
          {description ? <p className="mt-1 text-xs font-medium text-on-surface-variant/60">{description}</p> : null}
        </div>
        {actions}
      </div>
    </div>
  );
}

type QueueActionTone = "default" | "primary" | "warning" | "critical";

type QueueActionClassName = {
  wrapper: string;
  disabled?: string;
};

function queueActionToneClassName(tone: QueueActionTone): QueueActionClassName {
  if (tone === "primary") {
    return {
      wrapper: "border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white"
    };
  }
  if (tone === "warning") {
    return {
      wrapper: "border-amber-500/20 bg-amber-500/5 text-amber-700 hover:bg-amber-500 hover:text-white"
    };
  }
  if (tone === "critical") {
    return {
      wrapper: "border-error/20 bg-error/5 text-error hover:bg-error hover:text-white"
    };
  }
  return {
    wrapper: "border-outline-variant/20 bg-white text-on-surface hover:bg-on-surface hover:text-white"
  };
}

type QueueActionLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  tone?: QueueActionTone;
  size?: "xs" | "sm";
};

export function QueueActionLink({ href, children, className, tone = "default", size = "xs" }: QueueActionLinkProps) {
  const toneClasses = queueActionToneClassName(tone);
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-xl border font-black uppercase tracking-widest transition-all shadow-sm inner-glow active:scale-95",
        size === "xs" ? "px-3 py-1.5 text-[10px]" : "px-4 py-2 text-[11px]",
        toneClasses.wrapper,
        className
      )}
    >
      {children}
    </Link>
  );
}

type QueueActionButtonProps = {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  tone?: QueueActionTone;
  size?: "xs" | "sm";
  children: ReactNode;
};

export function QueueActionButton({
  type = "button",
  onClick,
  disabled,
  className,
  tone = "default",
  size = "xs",
  children
}: QueueActionButtonProps) {
  const toneClasses = queueActionToneClassName(tone);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center rounded-xl border font-black uppercase tracking-widest transition-all shadow-sm inner-glow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        size === "xs" ? "px-3 py-1.5 text-[10px]" : "px-4 py-2 text-[11px]",
        toneClasses.wrapper,
        className
      )}
    >
      {children}
    </button>
  );
}
