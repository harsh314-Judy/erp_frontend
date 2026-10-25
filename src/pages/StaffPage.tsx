import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Factory,
  Wrench,
} from "lucide-react"

import { PageLoading } from "@/components/PlantLoader"
import { EmptyState, Notice, PageTitle, StatusBadge } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

type Job = { id: string; product_name: string | null; quantity: string; status: string }
type Stage = { id: string; operation_name: string | null; status: string; assigned_user_id: string | null }
type Detail = Job & { stages: Stage[] }

export function StaffPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()

  async function load() {
    try {
      setJobs((await api<Page<Job>>("/api/production-jobs/?page=1&page_size=50")).items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function finish(job: Job) {
    setError("")
    await guard(async () => {
    try {
      const detail = await api<Detail>(`/api/production-jobs/${job.id}`)
      const active = detail.stages.find((stage) => stage.status === "active")
      if (!active) return
      if (job.status === "pending") {
        await api(`/api/production-jobs/${job.id}/start`, { method: "POST" })
      }
      const body = active.operation_name?.toLowerCase() === "polishing" ? { polish_type: "dry" } : {}
      await api(`/api/production-jobs/${job.id}/stages/${active.id}/complete`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="My Assigned Floor Tasks"
        hint="Work assigned to your operator station. Sign off each stage as soon as physical processing is complete."
        icon={Wrench}
        badge={`${jobs.length} Active`}
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading your jobs" variant="cards" count={2} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
        {jobs.map((job) => (
          <article
            key={job.id}
            className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs transition-all hover:border-gray-300 hover:shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                    <Factory className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{job.product_name ?? "Custom Workpiece"}</h3>
                    <p className="text-xs font-semibold text-gray-500">Batch Quantity: <span className="text-gray-900">{job.quantity}</span></p>
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Proceed with physical cutting, stamping, or polishing. Click below once output is ready for inspection.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <Button
                type="button"
                disabled={busy}
                className="w-full rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
                onClick={() => void finish(job)}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Sign Off & Advance Stage
              </Button>
            </div>
          </article>
        ))}

        {jobs.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState
              title="No Pending Work Assigned"
              description="Your station is clear right now. Check back when new production jobs are dispatched to your line."
              icon={Wrench}
            />
          </div>
        ) : null}
      </div>
      )}
    </div>
  )
}
