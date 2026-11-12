import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { UserRound } from "lucide-react"

import { DateRangeBar } from "@/components/floor/DateRangeBar"
import { istToday, shiftDate } from "@/components/floor/dates"
import { amount, dayLabel, totals, type UnitTotal } from "@/components/floor/format"
import { PageLoading } from "@/components/PlantLoader"
import { PageTitle } from "@/components/plant-ui"
import { api, errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type Person = { id: string; name: string; operation_name?: string; employment_type?: string }

type Timeline = {
  worker_id: string
  name: string
  active: boolean
  employment_type: string
  phone: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  operation_id: string
  operation_name: string
  history: { operation_id: string; operation_name: string; started_on: string; ended_on: string | null }[]
  now: { department: string | null; last_entry_at: string | null; today_entries: number; open_jobs_in_department: number }
  output: UnitTotal[]
  scrap: UnitTotal[]
  scrap_pct: { unit: string; percent: string | null }[]
  active_days: number
  avg_per_active_day: UnitTotal[]
  shared_entries: number
  department_avg_per_worker_day: UnitTotal[]
  daily: { date: string; unit: string; output: string; scrap: string; entries: number }[]
  items: { name: string; unit: string; output: string; scrap: string; entries: number }[]
  feed: { at: string; kind: "entry" | "move"; title: string; detail: string; shared_with: string[] }[]
}

const METRICS = [
  { id: "output", label: "Made" },
  { id: "scrap", label: "Scrap" },
  { id: "pct", label: "Scrap %" },
  { id: "entries", label: "Lines" },
] as const

const COLORS: Record<string, string> = {
  cutting: "#1e293b",
  shaping: "#0ea5e9",
  assembly: "#d946ef",
  polishing: "#f97316",
  coloring: "#10b981",
  packaging: "#a78bfa",
}

export function WorkerTimelinePage() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = istToday()
  const from = params.get("from") || shiftDate(today, -6)
  const to = params.get("to") || today
  const [people, setPeople] = useState<Person[]>([])
  const [query, setQuery] = useState("")
  const [data, setData] = useState<Timeline | null>(null)
  const [loadedKey, setLoadedKey] = useState("")
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("output")
  const [unit, setUnit] = useState("")
  const [error, setError] = useState("")
  const requestKey = `${workerId ?? ""}|${from}|${to}`
  const loading = Boolean(workerId) && loadedKey !== requestKey

  useEffect(() => {
    api<Person[]>("/api/departments/workers").then(setPeople).catch(() => {})
  }, [])

  useEffect(() => {
    if (!workerId) return
    let alive = true
    const key = `${workerId}|${from}|${to}`
    api<Timeline>(`/api/floor/workers/${workerId}/timeline?date_from=${from}&date_to=${to}`)
      .then((row) => {
        if (!alive) return
        setData(row)
        setUnit((current) => current || row.output[0]?.unit || row.daily[0]?.unit || "")
        setError("")
        setLoadedKey(key)
      })
      .catch((caught) => {
        if (!alive) return
        setError(errorMessage(caught))
        setLoadedKey(key)
      })
    return () => {
      alive = false
    }
  }, [workerId, from, to])

  const units = useMemo(() => {
    const found = new Set<string>()
    data?.daily.forEach((row) => found.add(row.unit))
    data?.output.forEach((row) => found.add(row.unit))
    return [...found]
  }, [data])

  const chart = useMemo(() => {
    const chosen = unit || units[0] || ""
    const average = Number(data?.department_avg_per_worker_day.find((row) => row.unit === chosen)?.quantity ?? 0)
    return (data?.daily ?? [])
      .filter((row) => !chosen || row.unit === chosen)
      .map((row) => {
        const made = Number(row.output)
        const scrap = Number(row.scrap)
        const pct = made > 0 ? Math.round((scrap / made) * 1000) / 10 : 0
        return {
          date: dayLabel(row.date),
          value: metric === "scrap" ? scrap : metric === "pct" ? pct : metric === "entries" ? row.entries : made,
          average,
        }
      })
  }, [data, metric, unit, units])

  function setRange(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params)
    next.set("from", nextFrom)
    next.set("to", nextTo)
    setParams(next, { replace: true })
  }

  const needle = query.trim().toLowerCase()
  const matches = people.filter((person) => !needle || person.name.toLowerCase().includes(needle))

  return (
    <div className="space-y-5">
      <PageTitle title={data?.name ?? "People"} hint="What a person made, scrapped, and which department they were in." icon={UserRound} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800"
          value={workerId ?? ""}
          onChange={(event) => {
            if (event.target.value) navigate(`/people/${event.target.value}?from=${from}&to=${to}`)
          }}
        >
          <option value="">Choose a person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.name}{person.operation_name ? ` · ${person.operation_name}` : ""}</option>
          ))}
        </select>
        <DateRangeBar from={from} to={to} onChange={setRange} />
      </div>
      {!workerId ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li className="sm:col-span-2 lg:col-span-3">
            <input className="h-9 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-3 text-sm" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </li>
          {matches.map((person) => (
            <li key={person.id}>
              <Link to={`/people/${person.id}?from=${from}&to=${to}`} className="block rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50">
                <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                <p className="text-xs text-gray-500">{person.operation_name ?? "Department"}{person.employment_type === "temporary" ? " · Temporary" : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {loading ? <PageLoading label="Loading timeline" variant="cards" count={2} /> : null}
      {workerId && data && loadedKey === requestKey ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{data.name}</h2>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", data.employment_type === "temporary" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                  {data.employment_type === "temporary" ? "Temporary" : "Permanent"}
                </span>
                <span className="text-xs text-gray-500">{data.operation_name}</span>
              </div>
              <dl className="mt-3 grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
                <div>Phone <strong>{data.phone || "—"}</strong></div>
                <div>Address <strong>{data.address || "—"}</strong></div>
                <div>Emergency <strong>{[data.emergency_contact_name, data.emergency_contact_phone].filter(Boolean).join(" · ") || "—"}</strong></div>
                <div>Active days <strong>{data.active_days}</strong> · shared lines <strong>{data.shared_entries}</strong></div>
                <div>Made <strong>{totals(data.output)}</strong></div>
                <div>Per active day <strong>{totals(data.avg_per_active_day)}</strong></div>
              </dl>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Right now</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{data.now.department ?? "No department"}</p>
              <p className="mt-1 text-xs text-gray-600">{data.now.today_entries} lines today · {data.now.open_jobs_in_department} open jobs in this department</p>
              <p className="mt-1 text-xs text-gray-500">Last line {data.now.last_entry_at ? new Date(data.now.last_entry_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
            </section>
          </div>
          <HistoryStrip history={data.history} from={from} to={to} />
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {METRICS.map((item) => (
                <button key={item.id} type="button" className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", metric === item.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")} onClick={() => setMetric(item.id)}>
                  {item.label}
                </button>
              ))}
              {units.length > 1 ? (
                <select className="h-8 rounded-xl border border-gray-200 px-2 text-xs" value={unit || units[0]} onChange={(event) => setUnit(event.target.value)}>
                  {units.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : null}
              <span className="text-[11px] text-gray-400">Department average {totals(data.department_avg_per_worker_day)}</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" radius={4} />
                  {metric === "output" && chart[0]?.average ? (
                    <ReferenceLine y={chart[0].average} stroke="#f97316" strokeDasharray="4 4" label={{ value: "Dept avg", fontSize: 10, fill: "#c2410c" }} />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</p>
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="py-1 font-bold">Item</th>
                    <th className="py-1 font-bold">Made</th>
                    <th className="py-1 font-bold">Scrap</th>
                    <th className="py-1 font-bold">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? <tr><td colSpan={4} className="py-3 text-gray-400">Nothing in this range.</td></tr> : null}
                  {data.items.map((item) => (
                    <tr key={`${item.name}-${item.unit}`} className="border-t border-gray-100">
                      <td className="py-1.5">{item.name}</td>
                      <td className="py-1.5">{amount(item.output)} {item.unit}</td>
                      <td className="py-1.5">{amount(item.scrap)} {item.unit}</td>
                      <td className="py-1.5">{item.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Activity</p>
              <ul className="mt-2 space-y-3">
                {groupFeed(data.feed).map((group) => (
                  <li key={group.day}>
                    <p className="text-[11px] font-bold text-gray-500">{group.day}</p>
                    <ul className="mt-1 space-y-1.5">
                      {group.items.map((item, index) => (
                        <li key={`${item.at}-${index}`} className="text-xs text-gray-800">
                          <span className="font-semibold">{item.kind === "move" ? "Department" : "Work"}</span> · {item.title}
                          {item.shared_with.length > 0 ? ` · shared with ${item.shared_with.join(", ")}` : ""}
                          {item.detail ? <span className="block text-gray-500">{item.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}

function HistoryStrip({ history, from, to }: { history: Timeline["history"]; from: string; to: string }) {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const span = Math.max(end - start, 1)
  const slices = history
    .map((row) => {
      const began = Date.parse(`${row.started_on}T00:00:00Z`)
      const ended = row.ended_on ? Date.parse(`${row.ended_on}T00:00:00Z`) : end
      const left = Math.max(began, start)
      const right = Math.min(ended, end)
      if (right < start || left > end) return null
      return { ...row, left: ((left - start) / span) * 100, width: Math.max(((right - left) / span) * 100, 4) }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
  if (slices.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Departments in this range</p>
      <div className="relative h-8 rounded-full bg-gray-100">
        {slices.map((row) => (
          <span
            key={`${row.operation_id}-${row.started_on}`}
            className="absolute top-1 flex h-6 items-center overflow-hidden rounded-full px-2 text-[10px] font-semibold text-white"
            style={{ left: `${row.left}%`, width: `${row.width}%`, background: COLORS[row.operation_name.toLowerCase()] ?? "#64748b" }}
            title={row.operation_name}
          >
            {row.operation_name}
          </span>
        ))}
      </div>
    </div>
  )
}

function groupFeed(feed: Timeline["feed"]) {
  const groups: { day: string; items: Timeline["feed"] }[] = []
  for (const item of feed) {
    const day = new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    const last = groups[groups.length - 1]
    if (!last || last.day !== day) groups.push({ day, items: [item] })
    else last.items.push(item)
  }
  return groups
}
