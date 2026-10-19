import { useMemo, useState, type ReactNode, type ComponentType } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, Info, Search, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function PageTitle({
  title,
  hint,
  icon: Icon,
  badge,
  action,
}: {
  title: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  badge?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#242c3d] pb-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/10">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
            {badge ? (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/25">
                {badge}
              </span>
            ) : null}
          </div>
          {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function Field({
  label,
  children,
  required,
  hint,
  className,
}: {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
  className?: string
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-200">
          {label}
          {required ? <span className="ml-1 text-rose-400">*</span> : null}
        </span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}

export function Notice({
  children,
  variant = "error",
}: {
  children: ReactNode
  variant?: "error" | "warning" | "info" | "success"
}) {
  const styles = {
    error: "border-rose-900/60 bg-rose-950/40 text-rose-200 [&_svg]:text-rose-400 shadow-sm",
    warning: "border-amber-900/60 bg-amber-950/40 text-amber-200 [&_svg]:text-amber-400 shadow-sm",
    info: "border-sky-900/60 bg-sky-950/40 text-sky-200 [&_svg]:text-sky-400 shadow-sm",
    success: "border-emerald-900/60 bg-emerald-950/40 text-emerald-200 [&_svg]:text-emerald-400 shadow-sm",
  }

  const Icon = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  }[variant]

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-center gap-2.5 rounded-xl border p-3.5 text-sm shadow-xs transition-all",
        styles[variant],
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <div className="flex-1 font-medium leading-relaxed">{children}</div>
    </div>
  )
}

export type StatusType =
  | "pending"
  | "active"
  | "in_progress"
  | "running"
  | "completed"
  | "done"
  | "awaiting_approval"
  | "ordered"
  | "arrived"
  | "verified"
  | "dispatched"
  | "paid"
  | "unpaid"
  | "partial"
  | "cancelled"
  | "rejected"
  | "normal"
  | "low_stock"
  | "critical"
  | "manufactured"
  | "purchased"
  | "both"
  | string

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusType
  label?: string
  className?: string
}) {
  const norm = (status || "").toLowerCase().trim()
  const displayLabel = label ?? norm.replaceAll("_", " ")

  let style = "bg-slate-800/80 text-slate-300 border-slate-700/60"
  let dotColor = "bg-slate-400"

  if (["completed", "done", "paid", "verified", "delivered", "normal", "active"].includes(norm)) {
    style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-xs"
    dotColor = "bg-emerald-400 shadow-xs shadow-emerald-400"
  } else if (["running", "in_progress", "process", "in_delivery", "dispatched", "manufactured"].includes(norm)) {
    style = "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-xs"
    dotColor = "bg-blue-400 animate-pulse shadow-xs shadow-blue-400"
  } else if (["pending", "ordered", "initiated", "awaiting_approval", "both", "arrived", "partial"].includes(norm)) {
    style = "bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-xs"
    dotColor = "bg-amber-400"
  } else if (["cancelled", "rejected", "low_stock", "critical", "unpaid"].includes(norm)) {
    style = "bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-xs"
    dotColor = "bg-rose-400 shadow-xs shadow-rose-400"
  } else if (["purchased"].includes(norm)) {
    style = "bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-xs"
    dotColor = "bg-purple-400"
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize tracking-wide transition-colors",
        style,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
      {displayLabel}
    </span>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "blue",
  trend,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ComponentType<{ className?: string }>
  color?: "blue" | "emerald" | "amber" | "rose" | "indigo" | "purple" | "cyan"
  trend?: { text: string; positive?: boolean }
}) {
  const colorMap = {
    blue: {
      accent: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      ring: "group-hover:border-blue-500/40",
    },
    emerald: {
      accent: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      ring: "group-hover:border-emerald-500/40",
    },
    amber: {
      accent: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      ring: "group-hover:border-amber-500/40",
    },
    rose: {
      accent: "from-rose-500 to-red-600",
      bgLight: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      ring: "group-hover:border-rose-500/40",
    },
    indigo: {
      accent: "from-indigo-500 to-purple-600",
      bgLight: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      ring: "group-hover:border-indigo-500/40",
    },
    purple: {
      accent: "from-purple-500 to-pink-600",
      bgLight: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      ring: "group-hover:border-purple-500/40",
    },
    cyan: {
      accent: "from-cyan-500 to-blue-600",
      bgLight: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      ring: "group-hover:border-cyan-500/40",
    },
  }[color]

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f2535] hover:shadow-md",
        colorMap.ring,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", colorMap.accent)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {Icon ? (
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
              colorMap.bgLight,
            )}
          >
            <Icon className="size-4.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-bold tracking-tight text-slate-100">{value}</div>
      </div>
      {hint || trend ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center font-medium",
                trend.positive ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {trend.text}
            </span>
          ) : null}
          {hint ? <span className="truncate">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export function CategoryManager({
  categories,
  onAdd,
  onRemove,
}: {
  categories: { id: string; name: string }[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)

  function add() {
    const next = name.trim()
    if (!next) return
    onAdd(next)
    setName("")
  }

  return (
    <div className="rounded-2xl border border-[#262e3f] bg-[#121826]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">Categories</p>
          <p className="text-xs text-slate-400">
            {categories.length ? `${categories.length} available` : "Add one before you save an item"}
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide categories" : "Add or remove"}
        </Button>
      </div>
      {open ? (
        <div className="space-y-4 border-t border-[#262e3f] p-4">
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <span className="text-sm text-slate-500">No categories yet.</span>
            ) : (
              categories.map((category) => (
                <span
                  key={category.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2b3447] bg-[#1a1f2b] px-3 py-2 text-sm text-slate-100"
                >
                  {category.name}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-300"
                    aria-label={`Remove ${category.name}`}
                    onClick={() => onRemove(category.id)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="New category name">
                <Input
                  value={name}
                  placeholder="e.g. Stainless coil"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      add()
                    }
                  }}
                />
              </Field>
            </div>
            <Button type="button" className="rounded-xl" onClick={add}>
              Save category
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Type to search",
  required,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  required?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return options
      .filter((option) => !needle || option.label.toLowerCase().includes(needle))
      .slice(0, 30)
  }, [options, query])

  return (
    <div className="relative grid gap-1.5 text-sm">
      <span className="font-medium text-slate-300">
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      <div className="relative">
        <Input
          value={open ? query : selected?.label ?? ""}
          placeholder={placeholder}
          className="pr-8 bg-[#151924] border-[#2b3447] text-slate-200 placeholder:text-slate-500 focus-visible:border-blue-500/80"
          onFocus={() => {
            setOpen(true)
            setQuery("")
          }}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open ? (
        <div className="absolute top-full z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#2c364b] bg-[#1c2230] p-1.5 shadow-2xl ring-1 ring-white/5 animate-in fade-in-50 zoom-in-95 duration-150">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No matches found</p>
          ) : (
            matches.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  option.id === value
                    ? "bg-blue-600/20 font-medium text-blue-300 ring-1 ring-blue-500/30"
                    : "text-slate-300 hover:bg-[#252c3d] hover:text-slate-100",
                )}
                onMouseDown={() => {
                  onChange(option.id)
                  setQuery("")
                  setOpen(false)
                }}
              >
                <span>{option.label}</span>
                {option.id === value ? <CheckCircle2 className="size-4 text-blue-400" /> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon: Icon = Search,
  action,
}: {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2b3447] bg-[#1a1f2b]/60 p-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-[#151924] text-slate-400 border border-[#2b3447]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-200">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
