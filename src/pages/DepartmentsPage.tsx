import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Building2 } from "lucide-react"

import { DateRangeBar } from "@/components/floor/DateRangeBar"
import { istToday, shiftDate } from "@/components/floor/dates"
import { amount, totals, type UnitTotal } from "@/components/floor/format"
import { PageLoading } from "@/components/PlantLoader"
import { Field, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useRefreshWhenShown } from "@/lib/visible"

type Worker = {
  id: string
  name: string
  phone: string | null
  employment_type: string
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  operation_id: string
}
type InputRow = { item_name: string; planned_quantity: string }
type ActiveJob = {
  job_id: string
  product_name: string | null
  quantity: string
  inputs: InputRow[]
}
type Recent = {
  worker_name: string | null
  product_name: string | null
  quantity: string
  unit: string | null
  completed_at: string | null
  shared: boolean
}
type Department = {
  operation_id: string
  name: string
  workers: Worker[]
  active: ActiveJob[]
  recent: Recent[]
  per_worker: { worker_id: string | null; name: string; stages: number; made: UnitTotal[] }[]
  output: UnitTotal[]
}

const COLORS: Record<string, string> = {
  cutting: "#1e293b",
  shaping: "#0ea5e9",
  assembly: "#d946ef",
  polishing: "#f97316",
  coloring: "#10b981",
  packaging: "#a78bfa",
}

const emptyPerson = {
  name: "",
  phone: "",
  employment_type: "permanent",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  operation_id: "",
}

export function DepartmentsPage() {
  const [params, setParams] = useSearchParams()
  const today = istToday()
  const from = params.get("from") || shiftDate(today, -6)
  const to = params.get("to") || today
  const dept = params.get("dept") || "all"
  const employment = params.get("type") || "all"
  const [rows, setRows] = useState<Department[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<"add" | "edit" | "move" | null>(null)
  const [person, setPerson] = useState(emptyPerson)
  const [editingId, setEditingId] = useState<string | null>(null)

  function setQuery(partial: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(partial)) next.set(key, value)
    setParams(next, { replace: true })
  }

  async function load() {
    try {
      setRows(await api<Department[]>(`/api/departments?date_from=${from}&date_to=${to}`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    api<Department[]>(`/api/departments?date_from=${from}&date_to=${to}`)
      .then((next) => {
        if (!alive) return
        setRows(next)
        setLoading(false)
      })
      .catch((caught) => {
        if (alive) setError(errorMessage(caught))
      })
    return () => {
      alive = false
    }
  }, [from, to])
  useRefreshWhenShown("/departments", load, (caught) => setError(errorMessage(caught)))

  const visible = rows.filter((row) => dept === "all" || row.operation_id === dept)

  function openAdd(operationId = "") {
    setEditingId(null)
    setPerson({ ...emptyPerson, operation_id: operationId || rows[0]?.operation_id || "" })
    setDialog("add")
  }

  function openEdit(department: Department, worker: Worker) {
    setEditingId(worker.id)
    setPerson({
      name: worker.name,
      phone: worker.phone ?? "",
      employment_type: worker.employment_type || "permanent",
      address: worker.address ?? "",
      emergency_contact_name: worker.emergency_contact_name ?? "",
      emergency_contact_phone: worker.emergency_contact_phone ?? "",
      operation_id: department.operation_id,
    })
    setDialog("edit")
  }

  function openMove(worker: Worker) {
    setEditingId(worker.id)
    setPerson({ ...emptyPerson, name: worker.name, operation_id: worker.operation_id })
    setDialog("move")
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError("")
    const profile = {
      name: person.name.trim(),
      phone: person.phone.trim() || null,
      employment_type: person.employment_type,
      address: person.address.trim() || null,
      emergency_contact_name: person.emergency_contact_name.trim() || null,
      emergency_contact_phone: person.emergency_contact_phone.trim() || null,
    }
    try {
      if (dialog === "add") {
        await api(`/api/departments/${person.operation_id}/workers`, { method: "POST", body: JSON.stringify(profile) })
      } else if (dialog === "move" && editingId) {
        await api(`/api/departments/workers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ operation_id: person.operation_id }),
        })
      } else if (editingId) {
        await api(`/api/departments/workers/${editingId}`, { method: "PATCH", body: JSON.stringify(profile) })
      }
      setDialog(null)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removePerson(worker: Worker) {
    setError("")
    try {
      await api(`/api/departments/workers/${worker.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Departments"
        hint="Who works each stage, and what they logged in the selected dates."
        icon={Building2}
        action={<Button type="button" className="rounded-xl bg-green-600 text-white" onClick={() => openAdd(dept === "all" ? "" : dept)}>Add person</Button>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={dept === "all"} onClick={() => setQuery({ dept: "all" })}>All</Chip>
          {rows.map((row) => (
            <Chip key={row.operation_id} on={dept === row.operation_id} onClick={() => setQuery({ dept: row.operation_id })}>
              <span className="size-1.5 rounded-full" style={{ background: COLORS[row.name.toLowerCase()] ?? "#64748b" }} />
              {row.name}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "permanent", "temporary"] as const).map((value) => (
            <Chip key={value} on={employment === value} onClick={() => setQuery({ type: value })}>
              {value === "all" ? "All types" : value === "permanent" ? "Permanent" : "Temporary"}
            </Chip>
          ))}
        </div>
      </div>
      <DateRangeBar from={from} to={to} onChange={(nextFrom, nextTo) => setQuery({ from: nextFrom, to: nextTo })} />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {loading ? <PageLoading label="Loading departments" variant="cards" count={3} /> : null}
      <div className="grid gap-4">
        {visible.map((department) => {
          const color = COLORS[department.name.toLowerCase()] ?? "#64748b"
          const people = department.workers.filter((worker) => employment === "all" || worker.employment_type === employment)
          const madeBy = Object.fromEntries(department.per_worker.map((row) => [row.worker_id ?? row.name, row.made]))
          return (
            <article key={department.operation_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: color }} />
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">{department.name}</h2>
                </div>
                <p className="text-xs text-gray-500">Made {totals(department.output)} in this range</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Working now</p>
                  {department.active.length === 0 ? <p className="mt-2 text-xs text-gray-400">Nothing in this department.</p> : null}
                  <ul className="mt-2 space-y-2">
                    {department.active.map((job) => (
                      <li key={job.job_id} className="rounded-xl border border-gray-100 p-2 text-xs">
                        <Link to="/production" className="font-semibold text-gray-900 hover:underline">
                          {job.product_name ?? "Job"} · {amount(job.quantity)}
                        </Link>
                        <p className="text-gray-500">{job.inputs.map((item) => `${item.item_name} ${amount(item.planned_quantity)}`).join(", ") || "No materials listed"}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recently logged</p>
                  {department.recent.length === 0 ? <p className="mt-2 text-xs text-gray-400">No lines in this range.</p> : null}
                  <ul className="mt-2 space-y-2">
                    {department.recent.map((row, index) => (
                      <li key={`${row.completed_at}-${index}`} className="text-xs text-gray-700">
                        <span className="font-semibold">{row.worker_name ?? "Unnamed"}</span> made {amount(row.quantity)} {row.unit ?? ""} {row.product_name ?? ""}
                        {row.shared ? " · shared" : ""}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">People</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="py-1 pr-2 font-bold">Name</th>
                          <th className="py-1 pr-2 font-bold">Phone</th>
                          <th className="py-1 pr-2 font-bold">Type</th>
                          <th className="py-1 pr-2 font-bold">Made</th>
                          <th className="py-1 font-bold" />
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((worker) => (
                          <tr key={worker.id} className="border-t border-gray-100">
                            <td className="py-1.5 pr-2">
                              <Link to={`/people/${worker.id}?from=${from}&to=${to}`} className="font-semibold text-gray-900 hover:underline">{worker.name}</Link>
                            </td>
                            <td className="py-1.5 pr-2 text-gray-600">{worker.phone || "—"}</td>
                            <td className="py-1.5 pr-2">
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", worker.employment_type === "temporary" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                                {worker.employment_type === "temporary" ? "Temporary" : "Permanent"}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2">{totals(madeBy[worker.id])}</td>
                            <td className="py-1.5 text-right">
                              <button type="button" className="mr-2 text-gray-600" onClick={() => openEdit(department, worker)}>Edit</button>
                              <button type="button" className="mr-2 text-gray-600" onClick={() => openMove(worker)}>Move</button>
                              <button type="button" className="text-rose-700" onClick={() => void removePerson(worker)}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </article>
          )
        })}
      </div>
      <Dialog open={dialog != null} onOpenChange={(open) => { if (!open) setDialog(null) }}>
        <DialogContent className="border-gray-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {dialog === "move" ? `Move ${person.name}` : dialog === "edit" ? "Edit person" : "Add person"}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(event) => void save(event)}>
            {dialog === "move" ? (
              <Field label="Department" required>
                <select className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" value={person.operation_id} onChange={(event) => setPerson({ ...person, operation_id: event.target.value })}>
                  {rows.map((row) => <option key={row.operation_id} value={row.operation_id}>{row.name}</option>)}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Name" required>
                  <Input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} required />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone">
                    <Input value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} />
                  </Field>
                  <Field label="Employment">
                    <select className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" value={person.employment_type} onChange={(event) => setPerson({ ...person, employment_type: event.target.value })}>
                      <option value="permanent">Permanent</option>
                      <option value="temporary">Temporary</option>
                    </select>
                  </Field>
                </div>
                {dialog === "add" ? (
                  <Field label="Department" required>
                    <select className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" value={person.operation_id} onChange={(event) => setPerson({ ...person, operation_id: event.target.value })}>
                      {rows.map((row) => <option key={row.operation_id} value={row.operation_id}>{row.name}</option>)}
                    </select>
                  </Field>
                ) : null}
                <Field label="Address">
                  <Input value={person.address} onChange={(event) => setPerson({ ...person, address: event.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Emergency contact">
                    <Input value={person.emergency_contact_name} onChange={(event) => setPerson({ ...person, emergency_contact_name: event.target.value })} />
                  </Field>
                  <Field label="Emergency phone">
                    <Input value={person.emergency_contact_phone} onChange={(event) => setPerson({ ...person, emergency_contact_phone: event.target.value })} />
                  </Field>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 text-white hover:bg-green-700">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Chip({ children, on, onClick }: { children: ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", on ? "bg-gray-900 text-white" : "bg-white text-gray-600")} onClick={onClick}>
      {children}
    </button>
  )
}
