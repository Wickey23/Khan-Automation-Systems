"use client";

type BulkAction = {
  key: string;
  label: string;
  disabled?: boolean;
  tone?: "default" | "warning";
  onClick: () => void;
};

type QueueBulkActionBarProps = {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
};

export function QueueBulkActionBar({ selectedCount, actions, onClear }: QueueBulkActionBarProps) {
  if (!selectedCount) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-700">{selectedCount} selected for action</p>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              action.tone === "warning"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
