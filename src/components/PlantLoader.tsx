import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm animate-rise stagger-${Math.min(i + 1, 5)}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" role="status">
      <div className="flex items-center gap-4 border-b border-gray-50 bg-gray-50/80 px-4 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={`h-3.5 ${c === 0 ? "w-32" : "w-20"}`} />
        ))}
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-3.5 ${c === 0 ? "w-40" : c === cols - 1 ? "w-16 ml-auto" : "w-24"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border border-gray-100 bg-white p-5 space-y-3 shadow-sm animate-rise stagger-${Math.min(i + 1, 5)}`}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function PageLoading({
  label = "Loading",
  variant = "cards",
  count = 4,
  cols = 5,
}: {
  label?: string
  variant?: "cards" | "table" | "stats"
  count?: number
  cols?: number
}) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {variant === "table"  ? <TableSkeleton rows={count} cols={cols} /> :
       variant === "stats"  ? <StatGridSkeleton count={count} /> :
                              <CardListSkeleton count={count} />}
    </div>
  )
}

export function FormBusy({ show, label = "Saving…" }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-2xs animate-fade-in">
      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg">
        <Loader2 className="size-4 animate-spin text-green-600" />
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
    </div>
  )
}

export function PlantLoader() {
  return (
    <div role="status" className="fixed inset-0 grid place-items-center bg-[#f4f5f7] animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="grid size-14 place-items-center rounded-2xl bg-green-600 text-white font-bold text-2xl shadow-md shadow-green-600/30">
            S
          </div>
          <span className="absolute -bottom-1 -right-1 size-4 grid place-items-center rounded-full bg-white shadow">
            <span className="size-2.5 rounded-full bg-green-500 animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-green-600" />
          <span className="text-sm font-medium text-gray-600">Loading workspace…</span>
        </div>
      </div>
    </div>
  )
}
