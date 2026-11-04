import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Building2 } from "lucide-react"

import { PageLoading } from "@/components/PlantLoader"
import { PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"
import { useRefreshWhenShown } from "@/lib/visible"

type Worker = { id: string; name: string }
type InputRow = { item_name: string; planned_quantity: string }
type ActiveJob = {
  job_id: string
  product_name: string | null
  quantity: string
  started_at: string | null
  due_at: string | null
  inputs: InputRow[]
}
type Recent = {
  worker_name: string | null
  product_name: string | null
  quantity: string
  completed_at: string | null
  polish_type: string | null
}
type Department = {
  operation_id: string
  name: string
  workers: Worker[]
  active: ActiveJob[]
  recent: Recent[]
  per_worker: { name: string; stages: number }[]
}

const COLORS: Record<string, string> = {
  cutting: "#1e293b",
  shaping: "#0ea5e9",
  assembly: "#d946ef",
  polishing: "#f97316",
  coloring: "#10b981",
  packaging: "#a78bfa",
}

function stamp(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

export function DepartmentsPage() {
  const [rows, setRows] = useState<Department[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      setRows(await api<Department[]>("/api/departments"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])
  useRefreshWhenShown("/departments", load, (caught) => setError(errorMessage(caught)))

  async function addPerson(department: Department, event: FormEvent) {
    event.preventDefault()
    const name = (drafts[department.operation_id] || "").trim()
    if (!name) return
    setError("")
    try {
      await api(`/api/departments/${department.operation_id}/workers`, {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      setDrafts((current) => ({ ...current, [department.operation_id]: "" }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removePerson(worker: Worker) {
    setError("")
    try {
      await api(`/api/departments/workers/${worker.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Departments" hint="Who is working each stage, and what they finished this week." icon={Building2} />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {loading ? <PageLoading label="Loading departments" variant="cards" count={3} /> : null}
      <div className="grid gap-4">
        {rows.map((department) => {
          const color = COLORS[department.name.toLowerCase()] ?? "#64748b"
          const counts = Object.fromEntries(department.per_worker.map((row) => [row.name, row.stages]))
          return (
            <article key={department.operation_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: color }} />
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">{department.name}</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Working now</p>
                  {department.active.length === 0 ? <p className="mt-2 text-xs text-gray-400">Nothing in this department.</p> : null}
                  <ul className="mt-2 space-y-2">
                    {department.active.map((job) => (
                      <li key={job.job_id} className="rounded-xl border border-gray-100 p-2 text-xs">
                        <Link to="/production" className="font-semibold text-gray-900 hover:underline">
                          {job.product_name ?? "Job"} · {Number(job.quantity)}
                        </Link>
                        <p className="text-gray-500">{job.inputs.map((item) => `${item.item_name} ${Number(item.planned_quantity)}`).join(", ") || "No materials listed"}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recently done</p>
                  {department.recent.length === 0 ? <p className="mt-2 text-xs text-gray-400">No finishes in the last 7 days.</p> : null}
                  <ul className="mt-2 space-y-2">
                    {department.recent.map((row, index) => (
                      <li key={`${row.completed_at}-${index}`} className="text-xs text-gray-700">
                        <span className="font-semibold">{row.worker_name ?? "Unnamed"}</span> finished {row.product_name ?? "a job"}
                        {row.polish_type ? ` (${row.polish_type})` : ""} · {stamp(row.completed_at)}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">People</p>
                  <ul className="mt-2 space-y-1">
                    {department.workers.map((worker) => (
                      <li key={worker.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>{worker.name}{counts[worker.name] ? ` · ${counts[worker.name]} this week` : ""}</span>
                        <button type="button" className="text-rose-700" onClick={() => void removePerson(worker)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                  <form className="mt-2 flex gap-2" onSubmit={(event) => void addPerson(department, event)}>
                    <Input value={drafts[department.operation_id] ?? ""} placeholder="Add a name" onChange={(event) => setDrafts((current) => ({ ...current, [department.operation_id]: event.target.value }))} />
                    <Button type="submit" size="sm" className="rounded-xl bg-green-600 text-white">Add</Button>
                  </form>
                </section>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
