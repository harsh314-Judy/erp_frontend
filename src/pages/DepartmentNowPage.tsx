import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import { StageDesk } from "@/components/StageDesk"
import { PageLoading } from "@/components/PlantLoader"
import { Notice, PageTitle } from "@/components/plant-ui"
import { api, errorMessage } from "@/lib/api"
import { useRefreshWhenShown } from "@/lib/visible"

type InputRow = { input_id?: string; item_name: string; planned_quantity: string; kind?: string | null; taken_quantity?: string }
type MachineRow = { id: string; name: string; status: string }
type ActiveJob = {
  job_id: string
  stage_id: string
  product_name: string | null
  quantity: string
  good_quantity: string
  scrap_quantity: string
  remaining: string
  job_status: string
  problem_reason: string | null
  problem_note: string | null
  problem_machine_name: string | null
  worker_name: string | null
  bundle_size: string | null
  due_at: string | null
  started_at: string | null
  inputs: InputRow[]
  allows_send_out?: boolean
  standard_scrap_percent?: string | null
  outside?: { supplier_name: string; quantity: string }[]
  sends?: { id: string; supplier_id: string; supplier_name: string; quantity: string; sent_on: string; still_out: string }[]
}
type Department = {
  operation_id: string
  name: string
  machines?: MachineRow[]
  active: ActiveJob[]
}

function stamp(value: string | null) {
  if (!value) return "No due time"
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

export function DepartmentNowPage({ operationId }: { operationId?: string }) {
  const params = useParams()
  const id = operationId || params.operationId || ""
  const [row, setRow] = useState<Department | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const rows = await api<Department[]>("/api/departments")
      setRow(rows.find((item) => item.operation_id === id) ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [id])
  useRefreshWhenShown(operationId ? "/staff" : `/departments/${id}/now`, load, (caught) => setError(errorMessage(caught)))

  async function post(path: string, body?: unknown) {
    setBusy(true)
    setError("")
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined })
      await load()
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title={row?.name || "Department"} hint="Start, done, scrap, or a problem. Nothing else." />
      <Link to="/departments" className="text-xs font-semibold text-sky-700">All departments</Link>
      {error ? <Notice variant="error">{error}</Notice> : null}
      {loading ? <PageLoading label="Loading the department" variant="cards" count={2} /> : null}
      {!loading && row && row.active.length === 0 ? <p className="text-sm text-gray-500">Nothing is at this department.</p> : null}
      {row?.active.map((job) => (
        <article key={job.stage_id} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">{job.product_name || "Job"}</h2>
            <p className="text-xs text-gray-500">
              {job.job_status === "pending" ? "Waiting to start" : "In progress"} · due {stamp(job.due_at)}
              {job.worker_name ? ` · ${job.worker_name}` : ""}
            </p>
            {(job.outside ?? []).length > 0 ? (
              <p className="text-xs text-amber-800">
                Outside {job.outside?.map((row) => `${row.quantity} at ${row.supplier_name}`).join(", ")}
              </p>
            ) : null}
          </div>
          <StageDesk
            jobId={job.job_id}
            jobStatus={job.job_status}
            quantity={job.quantity}
            remaining={job.remaining}
            bundleSize={job.bundle_size}
            busy={busy}
            inputs={job.inputs}
            machines={row.machines}
            stage={{
              id: job.stage_id,
              operation_id: row.operation_id,
              operation_name: row.name,
              started_at: job.started_at,
              good_quantity: job.good_quantity,
              scrap_quantity: job.scrap_quantity,
              problem_reason: job.problem_reason,
              problem_note: job.problem_note,
              problem_machine_name: job.problem_machine_name,
              allows_send_out: job.allows_send_out,
              standard_scrap_percent: job.standard_scrap_percent,
              sends: job.sends,
            }}
            post={post}
          />
        </article>
      ))}
    </div>
  )
}
