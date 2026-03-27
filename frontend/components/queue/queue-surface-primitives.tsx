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
      <div className={cn("flex flex-col items-center justify-center rounded-2xl glass-card p-10", className)}>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">{message}</span>
      </div>
    );
  }

  const toneClassName = kind === "error" ? "border-error/20 bg-error/5 text-error" : "glass-card";

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border p-10 text-center", toneClassName, className)}>
      <div className={cn("mb-6 flex h-12 w-12 items-center justify-center rounded-lg", kind === "error" ? "bg-error/10" : "bg-primary/5")}>
        <span className="material-symbols-outlined text-3xl">
          {kind === "error" ? "report" : "inbox"}
        </span>
      </div>
      {title ? <p className="mb-2 text-lg font-semibold tracking-tight text-on-surface">{title}</p> : null}
      <p className={cn("max-w-sm text-sm font-medium leading-relaxed", kind === "error" ? "text-error/80" : "text-on-surface-variant/70")}>{message}</p>
      {actionLabel ? (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center rounded-md bg-on-surface px-4 py-2 text-xs font-semibold text-white hover:bg-primary transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center rounded-md bg-on-surface px-4 py-2 text-xs font-semibold text-white hover:bg-primary transition-colors"
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
    <div className={cn("rounded-xl border border-outline-variant/10 bg-slate-50 px-4 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface">{title}</p>
          {description ? <p className="mt-1 text-xs text-on-surface-variant/70">{description}</p> : null}
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
        "inline-flex items-center rounded-md border font-semibold transition-colors active:scale-95",
        size === "xs" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs",
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
        "inline-flex items-center rounded-md border font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        size === "xs" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs",
        toneClasses.wrapper,
        className
      )}
    >
      {children}
    </button>
  );
}
