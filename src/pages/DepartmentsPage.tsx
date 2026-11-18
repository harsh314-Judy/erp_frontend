import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Building2, ChevronRight } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
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
import { departmentLabel } from "@/lib/labels"
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
  wage_kind?: string | null
  wage_amount?: string | null
}
type InputRow = { item_name: string; planned_quantity: string }
type ActiveJob = {
  job_id: string
  stage_id?: string
  product_name: string | null
  quantity: string
  good_quantity?: string
  remaining?: string
  due_at?: string | null
  problem_reason?: string | null
  inputs: InputRow[]
  outside?: { supplier_name: string; quantity: string }[]
}
type Machine = { id: string; name: string; status: string; note: string | null }
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
  machines?: Machine[]
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
  wage_kind: "daily",
  wage_amount: "",
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
  const { can } = useAuth()
  const seesWages = can("manage_staff_users") || can("view_financials")
  const [dialog, setDialog] = useState<"add" | "edit" | "move" | null>(null)
  const [machinesFor, setMachinesFor] = useState<string | null>(null)
  const [machineName, setMachineName] = useState("")
  const [machineNote, setMachineNote] = useState("")
  const [person, setPerson] = useState(emptyPerson)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stagesOpen, setStagesOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)

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

  const stageIds = stageSelection(dept, rows)
  const visible = rows.filter((row) => stageIds.includes(row.operation_id))

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
      wage_kind: worker.wage_kind ?? "daily",
      wage_amount: worker.wage_amount ?? "",
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
      ...(seesWages ? { wage_kind: person.wage_kind, wage_amount: person.wage_amount.trim() || "0" } : {}),
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

  async function addMachine(operationId: string, event: FormEvent) {
    event.preventDefault()
    if (!machineName.trim()) return
    setError("")
    try {
      await api("/api/machines", {
        method: "POST",
        body: JSON.stringify({ name: machineName.trim(), operation_id: operationId, note: machineNote.trim() || null }),
      })
      setMachineName("")
      setMachineNote("")
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function toggleMachine(machine: Machine) {
    setError("")
    try {
      await api(`/api/machines/${machine.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: machine.status === "down" ? "up" : "down" }),
      })
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
        crumbs={rows.length > 0 && stageIds.length < rows.length ? [
          {
            label: "Departments",
            to: `/departments?${new URLSearchParams({ from, to, type: employment, dept: "all" })}`,
          },
          { label: rows.filter((row) => stageIds.includes(row.operation_id)).map((row) => departmentLabel(row.name)).join("; ") },
        ] : undefined}
        action={<Button type="button" className="rounded-xl bg-green-600 text-white" onClick={() => openAdd(stageIds.length === 1 ? stageIds[0] : "")}>Add person</Button>}
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterMenu
          label={<DepartmentFace selected={stageIds} rows={rows} />}
          open={stagesOpen}
          onOpenChange={(next) => {
            setStagesOpen(next)
            if (next) setStaffOpen(false)
          }}
        >
          <FilterOption
            on={stageIds.length === rows.length && rows.length > 0}
            onClick={() => setQuery({ dept: "all" })}
          >
            All
          </FilterOption>
          {rows.map((row) => (
            <FilterOption
              key={row.operation_id}
              on={stageIds.includes(row.operation_id) && stageIds.length !== rows.length}
              onClick={() => setQuery({ dept: toggleStage(row.operation_id, stageIds, rows) })}
            >
              <span className="size-1.5 rounded-full" style={{ background: COLORS[row.name.toLowerCase()] ?? "#64748b" }} />
              {departmentLabel(row.name)}
            </FilterOption>
          ))}
        </FilterMenu>
        <FilterMenu
          label={staffFace(employment)}
          open={staffOpen}
          onOpenChange={(next) => {
            setStaffOpen(next)
            if (next) setStagesOpen(false)
          }}
        >
          {(["all", "permanent", "temporary"] as const).map((value) => (
            <FilterOption
              key={value}
              on={employment === value}
              onClick={() => {
                setQuery({ type: value })
                setStaffOpen(false)
              }}
            >
              {value === "all" ? "All" : value === "permanent" ? "Permanent" : "Temporary"}
            </FilterOption>
          ))}
        </FilterMenu>
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
                  <h2 className="text-sm font-bold tracking-wide text-gray-900">{departmentLabel(department.name)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-gray-500">Made {totals(department.output)} in this range</p>
                  <Link to={`/departments/${department.operation_id}/now`} className="rounded-md bg-[var(--scheme)] px-3 py-1.5 text-xs font-medium text-white">Open screen</Link>
                  <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setMachinesFor((current) => current === department.operation_id ? null : department.operation_id)}>Machines</Button>
                </div>
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
                        <p className="text-gray-500">
                          {job.good_quantity != null ? `good ${job.good_quantity} of ${job.quantity}` : amount(job.quantity)}
                          {job.remaining != null ? ` · still ${job.remaining}` : ""}
                          {job.problem_reason ? ` · problem: ${job.problem_reason}` : ""}
                          {(job.outside ?? []).length ? ` · outside ${job.outside?.map((row) => `${row.quantity} at ${row.supplier_name}`).join(", ")}` : ""}
                        </p>
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
              {(department.machines ?? []).some((machine) => machine.status === "down") ? (
                <p className="mt-3 text-xs text-rose-700">Down: {(department.machines ?? []).filter((machine) => machine.status === "down").map((machine) => machine.name).join(", ")}</p>
              ) : null}
              {machinesFor === department.operation_id ? (
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs">
                  {(department.machines ?? []).map((machine) => (
                    <div key={machine.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-3 py-2">
                      <span><strong>{machine.name}</strong> · {machine.status}{machine.note ? ` · ${machine.note}` : ""}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => void toggleMachine(machine)}>{machine.status === "down" ? "Set up" : "Set down"}</Button>
                    </div>
                  ))}
                  <form className="flex flex-wrap gap-2" onSubmit={(event) => void addMachine(department.operation_id, event)}>
                    <Input placeholder="Machine name" value={machineName} onChange={(event) => setMachineName(event.target.value)} />
                    <Input placeholder="Note" value={machineNote} onChange={(event) => setMachineNote(event.target.value)} />
                    <Button type="submit" className="bg-[var(--scheme)] text-white">Add machine</Button>
                  </form>
                </div>
              ) : null}
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
                  {rows.map((row) => <option key={row.operation_id} value={row.operation_id}>{departmentLabel(row.name)}</option>)}
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
                      {rows.map((row) => <option key={row.operation_id} value={row.operation_id}>{departmentLabel(row.name)}</option>)}
                    </select>
                  </Field>
                ) : null}
                {seesWages ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Pay">
                      <select className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" value={person.wage_kind} onChange={(event) => setPerson({ ...person, wage_kind: event.target.value })}>
                        <option value="daily">Daily wage</option>
                        <option value="monthly">Monthly salary</option>
                      </select>
                    </Field>
                    <Field label="Amount">
                      <Input type="number" min="0" step="0.01" value={person.wage_amount} onChange={(event) => setPerson({ ...person, wage_amount: event.target.value })} />
                    </Field>
                  </div>
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

function stageSelection(dept: string, rows: Department[]) {
  if (dept === "all" || rows.length === 0) return rows.map((row) => row.operation_id)
  const known = new Set(rows.map((row) => row.operation_id))
  const picked = dept.split(",").filter((id) => known.has(id))
  return picked.length ? picked : rows.map((row) => row.operation_id)
}

function toggleStage(id: string, selected: string[], rows: Department[]) {
  const showingAll = selected.length === rows.length
  const next = new Set(showingAll ? [] : selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  if (next.size === 0 || next.size === rows.length) return "all"
  return [...next].join(",")
}

function DepartmentFace({ selected, rows }: { selected: string[]; rows: Department[] }) {
  const chosen = rows.filter((row) => selected.includes(row.operation_id))
  if (chosen.length === 0 || chosen.length === rows.length) return <>Department: All</>
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="shrink-0">Department:</span>
      {chosen.map((row, index) => (
        <span key={row.operation_id} className="inline-flex min-w-0 items-center gap-1">
          {index > 0 ? <span className="text-[var(--ink-soft)]">;</span> : null}
          <DepartmentDot name={row.name} />
          <span className="truncate">{departmentLabel(row.name)}</span>
        </span>
      ))}
    </span>
  )
}

function DepartmentDot({ name }: { name: string }) {
  return <span className="size-1.5 shrink-0 rounded-full" style={{ background: COLORS[name.toLowerCase()] ?? "#64748b" }} />
}

function staffFace(employment: string) {
  if (employment === "permanent") return "Staff: Permanent"
  if (employment === "temporary") return "Staff: Temporary"
  return "Staff: All"
}

function FilterMenu({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={box} className="inline-flex h-10 max-w-full items-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-full min-w-0 items-center gap-2 px-3.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--hover)]"
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex min-w-0 items-center">{label}</span>
        <ChevronRight className={cn("size-3.5 shrink-0 text-[var(--ink-soft)] transition-transform duration-300", open && "rotate-90")} />
      </button>
      <div
        aria-hidden={!open}
        className={cn(
          "grid h-full transition-[grid-template-columns,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "grid-cols-[1fr] opacity-100" : "pointer-events-none grid-cols-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div role="listbox" className="flex h-full items-center gap-0.5 pr-1.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterOption({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm whitespace-nowrap text-[var(--ink-muted)] hover:bg-[var(--hover)]",
        on && "bg-[var(--scheme-soft)] text-[var(--scheme)]",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
