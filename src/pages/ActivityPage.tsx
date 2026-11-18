import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { History } from "lucide-react"

import { PageLoading } from "@/components/PlantLoader"
import { DateSort, FilterPanel, Notice, PageTitle } from "@/components/plant-ui"
import { api, errorMessage, type Page } from "@/lib/api"
import { departmentLabel } from "@/lib/labels"

type EventRow = {
  id: string
  occurred_at: string
  kind: string
  summary: string
  link: string | null
}

const ACTIVITIES = [
  { id: "", label: "All" },
  { id: "sold_goods", label: "Sold goods" },
  { id: "purchases", label: "Purchases" },
  { id: "payments", label: "Payments" },
  { id: "job_approvals", label: "Job approvals" },
  { id: "dispatches", label: "Dispatches" },
  { id: "attendance", label: "Attendance" },
  { id: "floor", label: "Floor log" },
]

type SortChoice = { id: string; label: string }

function isoDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${value.getFullYear()}-${month}-${day}`
}

function startOfDay(value: Date) {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfWeek(value: Date) {
  const copy = startOfDay(value)
  const weekday = copy.getDay()
  copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1))
  return copy
}

function monthName(month: number) {
  return new Date(2026, month, 1).toLocaleString("en-IN", { month: "long" })
}

function sortChoices(now: Date, rows: EventRow[]): SortChoice[] {
  const choices: SortChoice[] = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
  ]
  for (let month = now.getMonth() - 1; month >= 0; month -= 1) {
    choices.push({ id: `month:${month}`, label: monthName(month) })
  }
  const years = new Set<number>([now.getFullYear() - 1])
  for (const row of rows) {
    const year = new Date(row.occurred_at).getFullYear()
    if (year < now.getFullYear()) years.add(year)
  }
  ;[...years].sort((left, right) => right - left).forEach((year) => {
    choices.push({ id: `year:${year}`, label: String(year) })
  })
  return choices
}

function matchesSort(when: Date, sort: string, now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const week = startOfWeek(now)
  const day = startOfDay(when)
  if (sort === "all") return true
  if (sort === "today") return day.getTime() === today.getTime()
  if (sort === "yesterday") return day.getTime() === yesterday.getTime()
  if (sort === "week") return day >= week && day <= today
  if (sort === "month") return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()
  if (sort.startsWith("month:")) {
    const month = Number(sort.slice(6))
    return when.getFullYear() === now.getFullYear() && when.getMonth() === month
  }
  if (sort.startsWith("year:")) return when.getFullYear() === Number(sort.slice(5))
  if (sort.startsWith("range:")) {
    const [, from, to] = sort.split(":")
    const start = startOfDay(new Date(`${from}T00:00:00`))
    const end = startOfDay(new Date(`${to}T00:00:00`))
    return day >= start && day <= end
  }
  return true
}

function chosenLabel(sort: string, choices: SortChoice[]) {
  if (sort.startsWith("range:")) {
    const [, from, to] = sort.split(":")
    const stamp = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    return `${stamp(from)} – ${stamp(to)}`
  }
  return choices.find((item) => item.id === sort)?.label ?? "Activity"
}

function headingFor(label: string, now: Date) {
  const date = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const month = now.toLocaleDateString("en-IN", { month: "long" })
  if (label === "Today") return `Today · ${date}`
  if (label === "This month") return `This month · ${month}`
  return label
}

function groupLabel(when: Date, now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const week = startOfWeek(now)
  const day = startOfDay(when)
  if (day.getTime() === today.getTime()) return "Today"
  if (day.getTime() === yesterday.getTime()) return "Yesterday"
  if (day >= week && day < today) return "This week"
  if (when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()) return "This month"
  if (when.getFullYear() === now.getFullYear()) return monthName(when.getMonth())
  return String(when.getFullYear())
}

function destination(row: EventRow, departments: Map<string, string>) {
  const link = row.link ?? ""
  const department = link.match(/^\/departments\/([^/]+)\/now$/)
  if (department) {
    const name = departments.get(department[1])
    return { to: link, label: name ? `Open ${departmentLabel(name)}` : "Open Department" }
  }
  if (link.startsWith("/sales")) return { to: link, label: "Open Sales" }
  if (link.startsWith("/purchases")) return { to: link, label: "Open Purchases" }
  if (link.startsWith("/accountant/jobs")) return { to: link, label: "Open Job approval" }
  if (link.startsWith("/accountant/payments")) return { to: link, label: "Open Payment approval" }
  if (row.kind === "attendance" || link.startsWith("/activity")) return { to: "/users", label: "Open Personnel" }
  return link ? { to: link, label: "Open" } : null
}

export function ActivityPage() {
  const [activities, setActivities] = useState<string[]>([])
  const [sort, setSort] = useState("all")
  const [rows, setRows] = useState<EventRow[]>([])
  const [departments, setDepartments] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    const from = `${now.getFullYear() - 5}-01-01`
    setLoading(true)
    Promise.all([
      api<EventRow[]>(`/api/activity?from=${from}&to=${isoDate(now)}`),
      api<Page<{ id: string; name: string }>>("/api/operations?page=1&page_size=100"),
    ])
      .then(([events, operations]) => {
        setRows(events)
        setDepartments(new Map(operations.items.map((item) => [item.id, item.name])))
      })
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [now])

  const choices = useMemo(() => sortChoices(now, rows), [now, rows])
  const quickSorts = choices.filter((item) => ["all", "today", "yesterday", "week", "month"].includes(item.id))
  const visible = useMemo(
    () => rows.filter((row) => (activities.length === 0 || activities.includes(row.kind)) && matchesSort(new Date(row.occurred_at), sort, now)),
    [activities, now, rows, sort],
  )

  function toggleActivity(id: string) {
    if (!id) {
      setActivities([])
      return
    }
    setActivities((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      const kinds = ACTIVITIES.filter((item) => item.id).map((item) => item.id)
      if (next.length === 0 || next.length === kinds.length) return []
      return next
    })
  }
  const groups = useMemo(() => {
    const order: string[] = []
    const buckets = new Map<string, EventRow[]>()
    for (const row of visible) {
      const label = sort === "all" ? groupLabel(new Date(row.occurred_at), now) : chosenLabel(sort, choices)
      if (!buckets.has(label)) {
        buckets.set(label, [])
        order.push(label)
      }
      buckets.get(label)?.push(row)
    }
    return order.map((label) => ({ label, rows: buckets.get(label) ?? [] }))
  }, [choices, now, sort, visible])

  return (
    <div className="space-y-6">
      <PageTitle
        title="Activity log"
        hint="Every dispatch, payment, approval, purchase, floor entry, and attendance mark, grouped by when it happened."
        icon={History}
        badge={`${visible.length} Events`}
      />
      {error ? <Notice variant="error">{error}</Notice> : null}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.75fr)_minmax(11rem,0.65fr)]">
        <DateSort quick={quickSorts} value={sort} onChange={setSort} />
        <FilterPanel title="Activity">
          {ACTIVITIES.map((item) => {
            const selected = item.id ? activities.includes(item.id) : activities.length === 0
            return (
              <button
                key={item.id || "all"}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleActivity(item.id)}
                className={`h-10 px-2 text-sm font-medium ${selected ? "text-[var(--scheme)]" : "text-[var(--ink-soft)]"}`}
              >
                {item.label}
              </button>
            )
          })}
        </FilterPanel>
      </div>
      {loading ? <PageLoading label="Loading the log" /> : visible.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">Nothing in this range.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              <h2 className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs font-medium tracking-[0.4px] text-[var(--ink-soft)]">{headingFor(group.label, now)}</h2>
              {group.rows.map((row) => {
                const place = destination(row, departments)
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-[var(--ink)]">{row.summary}</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">
                        {new Date(row.occurred_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {ACTIVITIES.find((item) => item.id === row.kind)?.label ?? row.kind}
                      </p>
                    </div>
                    {place ? <Link className="text-xs font-semibold text-[var(--scheme)]" to={place.to}>{place.label}</Link> : null}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
