import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"
import { departmentLabel } from "@/lib/labels"

type WageDay = { work_date: string; status: string }
type WagePerson = {
  worker_id: string
  name: string
  operation_name: string
  active: boolean
  wage_kind: string
  wage_amount: string
  present_days: number
  half_days: number
  absent_dates: string[]
  days: WageDay[]
  already_given: string
  owed: string
}
type WageMonth = { year: number; month: number; people: WagePerson[]; total_owed: string }

function indiaMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  return { year, month }
}

function indiaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month - 1 + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() + 1 }
}

const rupee = (value: string | number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function FloorPay() {
  const [month, setMonth] = useState(() => indiaMonth())
  const [selected, setSelected] = useState(() => indiaToday())
  const [data, setData] = useState<WageMonth | null>(null)
  const [error, setError] = useState("")
  const [given, setGiven] = useState<Record<string, string>>({})

  useEffect(() => {
    let live = true
    api<WageMonth>(`/api/wages?year=${month.year}&month=${month.month}`)
      .then((payload) => {
        if (!live) return
        setData(payload)
        setGiven(Object.fromEntries(payload.people.map((person) => [person.worker_id, person.already_given])))
        setError("")
      })
      .catch((caught) => {
        if (live) setError(errorMessage(caught))
      })
    return () => {
      live = false
    }
  }, [month.year, month.month])

  useEffect(() => {
    const prefix = `${month.year}-${String(month.month).padStart(2, "0")}`
    if (!selected.startsWith(prefix)) setSelected(`${prefix}-01`)
  }, [month.year, month.month, selected])

  const daysInMonth = new Date(month.year, month.month, 0).getDate()
  const firstWeekday = new Date(month.year, month.month - 1, 1).getDay()
  const label = new Date(month.year, month.month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })
  const people = data?.people ?? []

  async function saveMark(workerId: string, status: string) {
    setError("")
    try {
      const payload = await api<WageMonth>("/api/wages/days", {
        method: "PUT",
        body: JSON.stringify({
          worker_id: workerId,
          work_date: selected,
          status: status || null,
        }),
      })
      setData(payload)
      setGiven(Object.fromEntries(payload.people.map((person) => [person.worker_id, person.already_given])))
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function saveGiven(person: WagePerson) {
    const next = given[person.worker_id] ?? "0"
    if (Number(next) === Number(person.already_given)) return
    setError("")
    try {
      const payload = await api<WageMonth>("/api/wages/advances", {
        method: "PUT",
        body: JSON.stringify({
          worker_id: person.worker_id,
          year: month.year,
          month: month.month,
          already_given: next || "0",
        }),
      })
      setData(payload)
      setGiven(Object.fromEntries(payload.people.map((row) => [row.worker_id, row.already_given])))
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Floor pay</h2>
          <p className="text-xs text-gray-500">
            Mark who was in. Unmarked days are not present. Daily pay counts present and half days. Monthly pay is the full amount, and absences are only listed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMonth((current) => shiftMonth(current, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setMonth((current) => shiftMonth(current, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1
          const key = `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const marks = people.filter((person) => person.days.some((row) => row.work_date === key)).length
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`rounded-lg px-1 py-2 ${selected === key ? "bg-slate-900 text-white" : "bg-gray-50 text-gray-800 hover:bg-gray-100"}`}
            >
              <span className="block text-xs font-semibold">{day}</span>
              <span className={`block ${selected === key ? "text-white/70" : "text-gray-400"}`}>{marks || ""}</span>
            </button>
          )
        })}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Marks for {selected}</p>
        {people.length === 0 ? <p className="text-xs text-gray-500">No floor people for this month.</p> : null}
        {people.map((person) => {
          const dayStatus = person.days.find((row) => row.work_date === selected)?.status ?? ""
          return (
            <label key={person.worker_id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {person.name}
                <span className="text-xs text-gray-500"> · {departmentLabel(person.operation_name)}</span>
              </span>
              <select
                className="h-9 rounded-lg border border-gray-200 px-2 text-xs"
                value={dayStatus}
                onChange={(event) => void saveMark(person.worker_id, event.target.value)}
              >
                <option value="">Unmarked</option>
                <option value="present">Present</option>
                <option value="half">Half</option>
                <option value="absent">Absent</option>
              </select>
            </label>
          )
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Person</th>
              <th className="py-2 pr-3 font-medium">Pay</th>
              <th className="py-2 pr-3 font-medium">Days</th>
              <th className="py-2 pr-3 font-medium">Absent</th>
              <th className="py-2 pr-3 font-medium">Already given</th>
              <th className="py-2 font-medium">Owed</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.worker_id} className="border-t border-gray-100">
                <td className="py-2 pr-3">
                  {person.name}
                  {!person.active ? " (inactive)" : ""}
                  <span className="block text-gray-500">{departmentLabel(person.operation_name)}</span>
                </td>
                <td className="py-2 pr-3 capitalize">
                  {person.wage_kind} {rupee(person.wage_amount)}
                </td>
                <td className="py-2 pr-3">
                  {person.present_days} present{person.half_days ? `, ${person.half_days} half` : ""}
                </td>
                <td className="py-2 pr-3">{person.absent_dates.length ? person.absent_dates.join(", ") : "—"}</td>
                <td className="py-2 pr-3">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 w-28"
                    value={given[person.worker_id] ?? person.already_given}
                    onChange={(event) => setGiven({ ...given, [person.worker_id]: event.target.value })}
                    onBlur={() => void saveGiven(person)}
                  />
                </td>
                <td className="py-2 font-semibold">{rupee(person.owed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-semibold text-gray-900">Wage owed this month {rupee(data?.total_owed ?? 0)}</p>
    </section>
  )
}
