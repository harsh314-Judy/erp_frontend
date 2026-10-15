import { useEffect, useState } from "react"

import { Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { api, errorMessage, type Page } from "@/lib/api"

type Job = { id: string; product_name: string | null; quantity: string; status: string }
type Stage = { id: string; operation_name: string | null; status: string; assigned_user_id: string | null }
type Detail = Job & { stages: Stage[] }

export function StaffPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState("")

  async function load() {
    setJobs((await api<Page<Job>>("/api/production-jobs/?page=1&page_size=50")).items)
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function finish(job: Job) {
    setError("")
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
  }

  return (
    <div>
      <PageTitle title="Staff work" hint="Jobs assigned to you. Mark your stage done when the work is finished." />
      {error ? <Notice>{error}</Notice> : null}
      <div className="grid gap-3">
        {jobs.map((job) => (
          <article key={job.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div>
              <p className="font-medium">{job.product_name}</p>
              <p className="text-sm text-muted-foreground">{job.quantity} · {job.status.replaceAll("_", " ")}</p>
            </div>
            <Button type="button" onClick={() => void finish(job)}>Mark my stage done</Button>
          </article>
        ))}
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is assigned right now.</p> : null}
      </div>
    </div>
  )
}
