type QueueEmptyStateProps = {
  title: string;
  description: string;
};

export function QueueEmptyState({ title, description }: QueueEmptyStateProps) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/75 px-6 py-8 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  );
}
