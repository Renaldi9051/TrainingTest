import { Skeleton } from "@/components/admin/ui/skeleton";

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

// Placeholder tabel saat data dimuat (blok --bg-muted, bukan spinner).
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="Memuat data" className="w-full">
      <div className="flex gap-4 border-b border-border py-3">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-b border-border py-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className="h-4 flex-1"
              style={{ maxWidth: column === 0 ? "40%" : undefined }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Memuat data...</span>
    </div>
  );
}
