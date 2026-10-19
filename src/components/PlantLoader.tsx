import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const LINES = [
  "Spinning up the mill",
  "Opening the gate",
  "Reading the coils",
  "Syncing the floor",
]

/**
 * YouTube / Linear style card skeleton with simulated content lines,
 * badges, and metadata rows with soft shimmer animation.
 */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading data">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-sm space-y-4"
        >
          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-3 w-32 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Body content lines */}
          <div className="rounded-xl border border-[#262e3f]/60 bg-[#161a25] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-56 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          </div>

          {/* Footer actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * YouTube / Data-table style table skeleton with columns & pulsing rows.
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b]" role="status" aria-label="Loading table">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-[#1f2636]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center justify-between px-5 py-4 gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className={c === 0 ? "flex-1 min-w-32" : c === cols - 1 ? "w-24 text-right" : "flex-1"}
              >
                <Skeleton
                  className={`h-4 rounded-md ${
                    c === 0
                      ? "w-3/4"
                      : c === cols - 1
                        ? "w-16 ml-auto"
                        : "w-1/2"
                  }`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * KPI Stat cards grid skeleton.
 */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="size-8 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/**
 * Modern replacement for component-level loading: renders native-looking
 * shimmer skeleton cards or tables so the layout stays stable and feels immediate.
 */
export function PageLoading({
  label = "Loading data",
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
      {variant === "table" ? (
        <TableSkeleton rows={count} cols={cols} />
      ) : variant === "stats" ? (
        <StatGridSkeleton count={count} />
      ) : (
        <CardListSkeleton count={count} />
      )}
    </div>
  )
}

/**
 * Non-intrusive modal/form busy indicator: frosted glass overlay with a sleek
 * top shimmer bar and centered spinner, keeping the underlying form visible.
 */
export function FormBusy({ show, label = "Saving changes..." }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-[#13161f]/80 backdrop-blur-xs transition-opacity duration-150">
      {/* Top progress bar */}
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-2xl bg-blue-950/40">
        <div className="h-full w-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 animate-[shimmer_1.5s_infinite]" />
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-[#2b3447] bg-[#1c2230] px-4 py-3 shadow-xl">
        <Loader2 className="size-4.5 animate-spin text-blue-400" />
        <span className="text-xs font-semibold text-slate-200 tracking-wide">{label}</span>
      </div>
    </div>
  )
}

/**
 * High-production brand loader: exclusively used for initial application boot.
 */
export function PlantLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative grid min-h-svh place-items-center overflow-hidden bg-[#040814] text-white"
    >
      <span className="sr-only">Loading Sai Daya Steel</span>
      <div className="plant-grid pointer-events-none absolute inset-0" />
      <div className="plant-glow-blue pointer-events-none absolute -top-32 left-[18%] size-[32rem] rounded-full bg-blue-600/25 blur-3xl" />
      <div className="plant-glow-amber pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="plant-scan pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative grid size-64 place-items-center">
          <span className="plant-spin absolute size-60 rounded-full border border-amber-300/25" />
          <span className="plant-spin-reverse absolute size-44 rounded-full border border-dashed border-blue-300/50" />
          <span className="plant-spin absolute size-28 rounded-full border-2 border-amber-200/80 shadow-[0_0_24px_rgba(251,191,36,0.25)]" />
          <span className="plant-orbit absolute size-60">
            <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_16px_#fde68a]" />
          </span>
          <span className="plant-core relative grid size-16 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-100 text-2xl font-black text-slate-950 shadow-[0_0_48px_rgba(251,191,36,0.45)]">
            S
          </span>
        </div>

        <p className="mt-8 text-[11px] font-bold tracking-[0.42em] text-amber-100/80">SAI DAYA STEEL</p>
        <div className="relative mt-3 h-6 w-72">
          {LINES.map((line, index) => (
            <p
              key={line}
              className="plant-phrase absolute inset-0 text-center text-sm text-slate-300"
              style={{ animationDelay: `${index * 1.5}s` }}
            >
              {line}
            </p>
          ))}
        </div>
        <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="plant-melt h-full w-2/5 rounded-full bg-gradient-to-r from-amber-600 via-amber-100 to-sky-400" />
        </div>
      </div>
    </div>
  )
}
