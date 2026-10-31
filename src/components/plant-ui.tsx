import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { AlertCircle, CheckCircle2, ChevronDown, Info, Search, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { navForPath } from "@/lib/nav"
import { usePageChrome } from "@/lib/page-chrome"
import { cn } from "@/lib/utils"

export type PageGuideSection = { heading: string; items: { label: string; detail: string }[] }

export function PageTitle({
  title,
  hint,
  icon: Icon,
  badge,
  action,
  guide,
}: {
  title: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  badge?: ReactNode
  action?: ReactNode
  guide?: PageGuideSection[]
}) {
  const root = useRef<HTMLDivElement>(null)
  const guideBox = useRef<HTMLDivElement>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const { pathname } = useLocation()
  const chrome = usePageChrome()
  const nav = navForPath(pathname)
  const Mark = nav?.icon ?? Icon
  const iconBg = nav?.iconBg ?? "bg-green-600"
  const bar = nav?.bar ?? "border-l-green-600"
  const setChrome = chrome?.setChrome
  const scrolled = Boolean(chrome?.scrolled)

  useEffect(() => {
    if (!guideOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!guideBox.current?.contains(event.target as Node)) setGuideOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuideOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [guideOpen])

  useEffect(() => {
    if (!setChrome) return
    const page = root.current?.closest("[data-page]")?.getAttribute("data-page")
    if (page && page !== pathname) return
    setChrome(Mark ? { title, icon: Mark, iconBg } : null)
  }, [setChrome, pathname, title, Mark, iconBg])

  return (
    <div ref={root} className="mb-4 flex w-full min-w-0 flex-col justify-between gap-3 sm:mb-5 sm:flex-row sm:items-center">
      <div className={cn("flex min-w-0 flex-1 items-start gap-2.5 border-l-[3px] pl-3 sm:gap-3", bar)}>
        <div ref={guideBox} className="relative flex shrink-0 flex-col items-center gap-1">
          {Mark && !scrolled && (
            <div className={cn("grid size-9 place-items-center border border-black/30 text-white shadow-xs sm:size-10", iconBg)}>
              <Mark className="size-4 sm:size-5" />
            </div>
          )}
          {guide && guide.length > 0 ? (
            <>
              <button
                type="button"
                aria-label={`About ${title}`}
                aria-expanded={guideOpen}
                className="grid size-4 place-items-center rounded-full border border-gray-300/80 bg-white/70 text-gray-400 opacity-50 transition hover:opacity-100 hover:text-gray-600"
                onClick={() => setGuideOpen((open) => !open)}
              >
                <Info className="size-2.5" />
              </button>
              {guideOpen ? (
                <div className="absolute top-full left-0 z-30 mt-1.5 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-md">
                  <div className="space-y-3">
                    {guide.map((section) => (
                      <section key={section.heading}>
                        <h2 className="text-[10px] font-bold tracking-wide text-gray-400 uppercase">{section.heading}</h2>
                        <ul className="mt-1 space-y-1.5">
                          {section.items.map((item) => (
                            <li key={item.label} className="text-[11px] leading-snug text-gray-600">
                              <span className="font-semibold text-gray-800">{item.label}. </span>
                              {item.detail}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          {!scrolled && (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
              {badge && (
                <span className="inline-flex shrink-0 items-center rounded-none border border-black bg-white px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider text-gray-900 uppercase sm:px-2 sm:text-[10px]">
                  {badge}
                </span>
              )}
            </div>
          )}
          {hint && <p className="mt-0.5 text-xs font-medium text-gray-500 line-clamp-2 sm:line-clamp-none">{hint}</p>}
        </div>
      </div>
      {action && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{action}</div>}
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
        <span className="text-xs font-semibold text-gray-800 tracking-tight">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
        {hint && <span className="text-[11px] font-mono text-gray-400">{hint}</span>}
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
    error:   "border-l-4 border-l-red-600 border-black bg-red-50/70 text-red-900 [&_svg]:text-red-600",
    warning: "border-l-4 border-l-amber-600 border-black bg-amber-50/70 text-amber-900 [&_svg]:text-amber-600",
    info:    "border-l-4 border-l-blue-600 border-black bg-blue-50/70 text-blue-900 [&_svg]:text-blue-600",
    success: "border-l-4 border-l-green-600 border-black bg-emerald-50/70 text-emerald-900 [&_svg]:text-emerald-700",
  }
  const Icon = { error: AlertCircle, warning: AlertTriangle, info: Info, success: CheckCircle2 }[variant]

  return (
    <div role="alert" className={cn(
      "flex items-center gap-3 rounded-none border p-3.5 text-sm animate-fade-in shadow-2xs",
      styles[variant]
    )}>
      <Icon className="size-4.5 shrink-0" />
      <div className="flex-1 leading-relaxed text-xs sm:text-sm">{children}</div>
    </div>
  )
}

export type StatusType =
  | "pending" | "active" | "in_progress" | "running" | "completed" | "done"
  | "awaiting_approval" | "ordered" | "arrived" | "verified" | "dispatched"
  | "paid" | "unpaid" | "partial" | "cancelled" | "rejected" | "normal"
  | "low_stock" | "critical" | "manufactured" | "purchased" | "both" | string

export function StatusBadge({
  status, label, className,
}: { status: StatusType; label?: string; className?: string }) {
  const norm = (status || "").toLowerCase().trim()
  const display = label ?? norm.replaceAll("_", " ")

  const map: Record<string, { bg: string; dot: string }> = {
    completed:        { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    done:             { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    paid:             { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    verified:         { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    delivered:        { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    normal:           { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    active:           { bg: "bg-emerald-50 text-emerald-800 border-black", dot: "bg-emerald-600" },
    running:          { bg: "bg-blue-50 text-blue-800 border-black",       dot: "bg-blue-600" },
    in_progress:      { bg: "bg-blue-50 text-blue-800 border-black",       dot: "bg-blue-600" },
    dispatched:       { bg: "bg-blue-50 text-blue-800 border-black",       dot: "bg-blue-600" },
    manufactured:     { bg: "bg-blue-50 text-blue-800 border-black",       dot: "bg-blue-600" },
    initiated:       { bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    process:          { bg: "bg-blue-50 text-blue-800 border-black",       dot: "bg-blue-600" },
    in_delivery:      { bg: "bg-sky-50 text-sky-800 border-black",         dot: "bg-sky-600" },
    ordered:          { bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    awaiting_approval:{ bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    arrived:          { bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    partial:          { bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    both:             { bg: "bg-amber-50 text-amber-800 border-black",     dot: "bg-amber-600" },
    cancelled:        { bg: "bg-rose-50 text-rose-800 border-black",       dot: "bg-rose-600" },
    rejected:         { bg: "bg-rose-50 text-rose-800 border-black",       dot: "bg-rose-600" },
    low_stock:        { bg: "bg-rose-50 text-rose-800 border-black",       dot: "bg-rose-600" },
    critical:         { bg: "bg-rose-50 text-rose-800 border-black",       dot: "bg-rose-600" },
    unpaid:           { bg: "bg-rose-50 text-rose-800 border-black",       dot: "bg-rose-600" },
    purchased:        { bg: "bg-purple-50 text-purple-800 border-black",   dot: "bg-purple-600" },
  }

  const style = map[norm] ?? { bg: "bg-gray-50 text-gray-700 border-black", dot: "bg-gray-500" }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider shadow-2xs",
      style.bg, className
    )}>
      <span className={cn("size-1.5 shrink-0 rounded-none", style.dot)} />
      {display}
    </span>
  )
}

export function StatCard({
  label, value, hint, icon: Icon, trend,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ComponentType<{ className?: string }>
  color?: string
  trend?: { text: string; positive?: boolean }
}) {
  return (
    <div className="rounded-none border border-black bg-white p-3 sm:p-5 shadow-2xs hover:border-gray-800 transition-colors duration-150 animate-rise min-w-0 flex flex-col justify-between overflow-hidden">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-1 sm:gap-3">
          <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-600 truncate">{label}</p>
          {Icon && (
            <div className="grid size-6 sm:size-7 shrink-0 place-items-center rounded-none bg-gray-50 text-gray-800 border border-black shadow-2xs">
              <Icon className="size-3 sm:size-3.5" />
            </div>
          )}
        </div>
        <div className="mt-1.5 sm:mt-2.5 min-w-0">
          <span className="text-xl sm:text-3xl font-black text-gray-950 tabular-nums tracking-tight font-sans truncate block">{value}</span>
        </div>
      </div>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          {trend && (
            <span className={cn(
              "inline-flex items-center rounded-none border border-black px-1 sm:px-1.5 py-0.2 sm:py-0.5 text-[8.5px] sm:text-[10px] font-mono font-bold tracking-wider shrink-0",
              trend.positive
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            )}>
              {trend.positive ? "▲" : "▼"} {trend.text}
            </span>
          )}
          {hint && <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 truncate block min-w-0 flex-1">{hint}</span>}
        </div>
      )}
    </div>
  )
}

export function CategoryManager({
  categories, onAdd, onRemove,
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
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Categories</p>
          <p className="text-xs text-gray-500">
            {categories.length ? `${categories.length} categories` : "No categories yet"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(v => !v)}>
          {open ? "Done" : "Manage"}
        </Button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-gray-50 p-4 bg-gray-50/40 rounded-b-2xl animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <span className="text-sm text-gray-400">No categories yet.</span>
            ) : categories.map((cat) => (
              <span key={cat.id} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                {cat.name}
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500 font-bold transition-colors"
                  onClick={() => onRemove(cat.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="New category">
                <Input
                  value={name}
                  placeholder="e.g. Stainless coil"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
                />
              </Field>
            </div>
            <Button type="button" onClick={add} className="shrink-0">Add</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SearchSelect({
  label, options, value, onChange, placeholder = "Search…", required,
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
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ top: 0, left: 0, width: 0, maxHeight: 240, above: false })
  const selected = options.find((o) => o.id === value)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return options.filter((o) => !needle || o.label.toLowerCase().includes(needle)).slice(0, 30)
  }, [options, query])

  function updatePlace() {
    const node = anchorRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const above = spaceBelow < 160 && spaceAbove > spaceBelow
    setPlace({
      top: above ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(80, Math.min(240, above ? spaceAbove : spaceBelow)),
      above,
    })
  }

  useLayoutEffect(() => { if (open) updatePlace() }, [open, matches.length])

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!open) return
    const fn = () => updatePlace()
    window.addEventListener("scroll", fn, true)
    window.addEventListener("resize", fn)
    return () => { window.removeEventListener("scroll", fn, true); window.removeEventListener("resize", fn) }
  }, [open])

  const unbindMenu = useRef<(() => void) | null>(null)
  const bindMenu = useCallback((node: HTMLDivElement | null) => {
    unbindMenu.current?.()
    unbindMenu.current = null
    menuRef.current = node
    if (!node) return
    // The menu is portaled onto document.body. While a modal dialog is open it
    // turns pointer events off on the body, and React never hears clicks on that
    // portal, so the choice is taken with a DOM listener.
    const choose = (event: Event) => {
      const button = (event.target as Element | null)?.closest?.("[data-option-id]")
      if (!(button instanceof HTMLElement) || !node.contains(button)) return
      event.preventDefault()
      event.stopPropagation()
      onChangeRef.current(button.dataset.optionId || "")
      setOpen(false)
    }
    node.addEventListener("pointerdown", choose, true)
    node.addEventListener("click", choose, true)
    unbindMenu.current = () => {
      node.removeEventListener("pointerdown", choose, true)
      node.removeEventListener("click", choose, true)
    }
  }, [])

  return (
    <div className="relative grid gap-1.5 text-sm">
      <span className="text-xs font-semibold text-gray-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <div className="relative" ref={anchorRef}>
        <Input
          value={open ? query : selected?.label ?? ""}
          placeholder={placeholder}
          onFocus={() => { setQuery(""); setOpen(true) }}
          onClick={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => {
            setTimeout(() => {
              if (!anchorRef.current?.contains(document.activeElement) && !menuRef.current?.contains(document.activeElement)) setOpen(false)
            }, 180)
          }}
          className="pr-8"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
      </div>
      {open && createPortal(
        <div
          ref={bindMenu}
          style={{
            left: place.left, width: place.width, maxHeight: place.maxHeight,
            top: place.above ? undefined : place.top,
            bottom: place.above ? window.innerHeight - place.top : undefined,
          }}
          className="pointer-events-auto fixed z-[70] overflow-auto rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl animate-scale-in"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
          ) : matches.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-option-id={opt.id}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                opt.id === value
                  ? "bg-green-50 text-green-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <span>{opt.label}</span>
              {opt.id === value && <CheckCircle2 className="size-4 text-green-600 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export function EmptyState({
  title, description, icon: Icon = Search, action,
}: {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 p-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-gray-50 text-gray-400 border border-gray-100">
        <Icon className="size-7" />
      </div>
      <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
