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
  // Shared state card for queue/list surfaces to avoid loading/empty/error drift.
  if (kind === "loading") {
    return (
      <div className={cn("flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-6 text-sm text-slate-600 shadow-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        <span className="font-medium">{message}</span>
      </div>
    );
  }

  const toneClassName = kind === "error" ? "border-red-200 bg-red-50/80 text-red-700" : "border-slate-200 bg-white text-slate-600";

  return (
    <div className={cn("rounded-2xl border p-4 text-sm shadow-sm", toneClassName, className)}>
      {title ? <p className="font-semibold leading-5 text-slate-900">{title}</p> : null}
      <p className={cn(title ? "mt-1" : "", kind === "error" ? "text-red-700" : "text-slate-600")}>{message}</p>
      {actionLabel ? (
        <div className="mt-3">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
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
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
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
      wrapper: "border-blue-200 bg-blue-50 text-blue-700"
    };
  }
  if (tone === "warning") {
    return {
      wrapper: "border-amber-200 bg-amber-50 text-amber-700"
    };
  }
  if (tone === "critical") {
    return {
      wrapper: "border-red-200 bg-red-50 text-red-700"
    };
  }
  return {
    wrapper: "border-slate-200 bg-white text-slate-700"
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
        "inline-flex items-center rounded-md border font-semibold transition-colors hover:brightness-[0.98]",
        size === "xs" ? "max-w-full px-2 py-1 text-xs leading-4" : "max-w-full px-3 py-1.5 text-sm",
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
        "inline-flex items-center rounded-md border font-semibold transition-colors hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        size === "xs" ? "max-w-full px-2 py-1 text-xs leading-4" : "max-w-full px-3 py-1.5 text-sm",
        toneClasses.wrapper,
        className
      )}
    >
      {children}
    </button>
  );
}
