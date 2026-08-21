export default function FinancialReportDetailLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="h-7 w-64 animate-pulse rounded-lg bg-elevated" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}
