export default function FinancialReportLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-elevated" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
