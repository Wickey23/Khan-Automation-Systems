"use client";

import { MoreHorizontal } from "lucide-react";

type RowAction = { label: string; href?: string; onClick?: () => void };

export function RowActionMenu({ actions }: { actions: RowAction[] }) {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {actions.map((action) =>
          action.href ? (
            <a key={action.label} href={action.href} className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
              {action.label}
            </a>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </details>
  );
}
