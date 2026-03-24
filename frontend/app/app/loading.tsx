export default function DashboardLoading() {
  return (
    <div className="space-y-12 pb-12 animate-pulse">
      {/* Header Skeleton */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-4">
          <div className="h-3 w-32 bg-surface-container-high rounded-full"></div>
          <div className="h-12 w-64 bg-surface-container-high rounded-2xl"></div>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <div className="h-10 w-32 bg-surface-container-high rounded-xl"></div>
          <div className="h-10 w-40 bg-surface-container-high rounded-xl"></div>
        </div>
      </header>

      {/* Metric Grid Skeleton */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-surface-container-low rounded-2xl border border-white/20"></div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Primary Column Skeleton */}
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-6">
            <div className="h-6 w-32 bg-surface-container-high rounded-full"></div>
            <div className="h-[300px] bg-surface-container-low rounded-[2rem] border border-white/20"></div>
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-surface-container-low rounded-[2.5rem] border border-white/20"></div>
            <div className="h-48 bg-on-surface/10 rounded-[2.5rem] border border-white/20"></div>
          </div>
        </div>

        {/* Secondary Column Skeleton */}
        <div className="lg:col-span-4 space-y-8">
          <div className="h-64 bg-surface-container-low rounded-[2rem] border border-white/20"></div>
          <div className="space-y-6">
            <div className="h-4 w-32 bg-surface-container-high rounded-full"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-6 h-6 rounded-full bg-surface-container-high"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 bg-surface-container-high rounded-full"></div>
                  <div className="h-2 w-16 bg-surface-container-high rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
