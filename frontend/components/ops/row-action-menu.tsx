"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

type RowAction = { label: string; href?: string; onClick?: () => void };

export function RowActionMenu({ actions, triggerLabel }: { actions: RowAction[]; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useRef(`row-action-menu-${Math.random().toString(36).slice(2)}`);

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (!restoreFocus) return;
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      closeMenu(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu(true);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel || "More actions"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId.current}
        onClick={() => setOpen((current) => !current)}
        className="list-none cursor-pointer rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
      <div id={menuId.current} role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={() => closeMenu(true)}
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                action.onClick?.();
                closeMenu(true);
              }}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {action.label}
            </button>
          )
        )}
      </div>
      ) : null}
    </div>
  );
}
