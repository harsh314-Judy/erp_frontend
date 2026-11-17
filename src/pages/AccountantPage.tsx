import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  Boxes,
  Clock,
  CreditCard,
  Plus,
  Receipt,
  Scale,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { Field, Notice, PageTitle, StatusBadge } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

type Job = {
  id: string
  product_name: string | null
  quantity: string
  status: string
  good_quantity?: string
  scrap_quantity?: string
  problem_reason?: string | null
}
type ApprovalLog = { at: string; user_name: string; action: string; detail: string }

function estimateOf(job: Job) {
  return Number(job.good_quantity || 0) > 0 ? String(job.good_quantity) : job.quantity
}

function startOfDay(value: Date) {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function jobGroup(when: Date, now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const week = startOfDay(now)
  const weekday = week.getDay()
  week.setDate(week.getDate() - (weekday === 0 ? 6 : weekday - 1))
  const day = startOfDay(when)
  if (day.getTime() === today.getTime()) return "Today"
  if (day.getTime() === yesterday.getTime()) return "Yesterday"
  if (day >= week && day < today) return "This week"
  if (when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()) return "This month"
  if (when.getFullYear() === now.getFullYear()) return when.toLocaleDateString("en-IN", { month: "long" })
  return String(when.getFullYear())
}

function jobHeading(label: string, now: Date) {
  const date = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const month = now.toLocaleDateString("en-IN", { month: "long" })
  if (label === "Today") return `Today · ${date}`
  if (label === "This month") return `This month · ${month}`
  return label
}

export function JobApprovalPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [adjustSuccess, setAdjustSuccess] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjust, setAdjust] = useState({ product_id: "", quantity_delta: "", reason: "" })
  const [signedOff, setSignedOff] = useState<Job[]>([])
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [signoff, setSignoff] = useState({ note: "", staffName: "", area: "", produced: "" })
  const [logs, setLogs] = useState<Record<string, ApprovalLog[]>>({})
  const [logsReady, setLogsReady] = useState(false)
  const { user, can } = useAuth()
  const approver = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const mayApprove = can("approve_jobs")

  async function load() {
    const jobPage = await api<Page<Job>>("/api/production-jobs/?page=1&page_size=500")
    setJobs(jobPage.items.filter((job) => job.status === "awaiting_approval"))
    setSignedOff(jobPage.items.filter((job) => job.status === "completed"))
  }

  useEffect(() => {
    load()
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  async function approve(job: Job, event: FormEvent) {
    event.preventDefault()
    setError("")
    await guard(async () => {
      try {
        await api(`/api/production-jobs/${job.id}/approve`, {
          method: "POST",
          body: JSON.stringify({
            produced_quantity: signoff.produced,
            inputs: [],
            note: signoff.note.trim(),
            staff_name: signoff.staffName.trim(),
            area: signoff.area.trim() || null,
          }),
        })
        setOpenJob(null)
        setSignoff({ note: "", staffName: "", area: "", produced: "" })
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  useEffect(() => {
    if (!signedOff.length) {
      setLogsReady(true)
      return
    }
    let alive = true
    setLogsReady(false)
    Promise.all(
      signedOff.map(async (job) => {
        const detail = await api<{ events?: ApprovalLog[] }>(`/api/production-jobs/${job.id}`)
        return [job.id, (detail.events ?? []).filter((event) => event.action === "approved")] as const
      }),
    )
      .then((pairs) => {
        if (!alive) return
        setLogs(Object.fromEntries(pairs))
        setLogsReady(true)
      })
      .catch((caught) => {
        if (alive) setError(errorMessage(caught))
      })
    return () => {
      alive = false
    }
  }, [signedOff])

  const now = useMemo(() => new Date(), [])
  const signoffGroups = useMemo(() => {
    const lines = signedOff.flatMap((job) => (logs[job.id] ?? []).map((entry) => ({ job, entry })))
    lines.sort((left, right) => new Date(right.entry.at).getTime() - new Date(left.entry.at).getTime())
    const order: string[] = []
    const buckets = new Map<string, typeof lines>()
    for (const line of lines) {
      const label = jobGroup(new Date(line.entry.at), now)
      if (!buckets.has(label)) {
        buckets.set(label, [])
        order.push(label)
      }
      buckets.get(label)?.push(line)
    }
    return order.map((label) => ({ label, lines: buckets.get(label) ?? [] }))
  }, [logs, now, signedOff])

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault()
    setError("")
    setAdjustSuccess(false)
    await guard(async () => {
    try {
      await api("/api/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          product_id: adjust.product_id || null,
          quantity_delta: adjust.quantity_delta,
          reason: adjust.reason,
        }),
      })
      setAdjust({ product_id: "", quantity_delta: "", reason: "" })
      setAdjustSuccess(true)
      setShowAdjustModal(false)
      window.setTimeout(() => setAdjustSuccess(false), 4000)
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Job approval"
        hint="Sign the real quantity into stock. The job quantity is the estimate."
        icon={Receipt}
        badge={`${jobs.length} Queued`}
        action={
          <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]">
                <Plus className="mr-1.5 size-4" />
                Audited Stock Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-white border-gray-200/90 shadow-xl">
              <FormBusy show={busy} />
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="tone tone-emerald grid size-10 place-items-center rounded-xl">
                    <Scale className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-gray-900">
                      Audited Stock Adjustment
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                      Post a formal audit adjustment entry to balance physical vs book ledger.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <form className="mt-4 space-y-4" onSubmit={(event) => void saveAdjustment(event)}>
                <Field label="Product UUID / ID" required>
                  <Input
                    value={adjust.product_id}
                    onChange={(event) => setAdjust({ ...adjust, product_id: event.target.value })}
                    placeholder="Paste product ID or UUID"
                    required
                  />
                </Field>
                <Field label="Quantity Adjustment (+ or -)" required>
                  <Input
                    value={adjust.quantity_delta}
                    onChange={(event) => setAdjust({ ...adjust, quantity_delta: event.target.value })}
                    placeholder="e.g. +10 or -2.5"
                    required
                  />
                </Field>
                <Field label="Mandatory Audit Justification / Reason" required>
                  <Input
                    required
                    value={adjust.reason}
                    onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })}
                    placeholder="e.g. Discrepancy identified during physical stock count"
                  />
                </Field>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowAdjustModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs"
                  >
                    <CreditCard className="mr-1.5 size-4" />
                    Commit Audit Adjustment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}
      {adjustSuccess ? (
        <Notice variant="success">Inventory balance adjustment recorded in audit ledger.</Notice>
      ) : null}

      {loading ? (
        <PageLoading label="Loading approvals" variant="cards" count={2} />
      ) : (
      <>
        <div className="grid gap-6">
        {/* Waiting For Approval */}
        <section className="space-y-3 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="tone tone-amber grid size-9 place-items-center rounded-xl">
                <Clock className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Finished Jobs Awaiting Approval</h2>
                <p className="text-[11px] text-gray-500">Sign-off required before goods enter warehouse</p>
              </div>
            </div>
            <span className="tone tone-amber rounded-full px-2.5 py-0.5 text-xs font-bold">
              {jobs.length} Queued
            </span>
          </div>

          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs text-gray-500">
                No manufacturing jobs are pending approval.
              </p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Boxes className="size-4 text-amber-600" />
                      <div>
                        <Link to="/production" className="font-semibold text-gray-900 hover:underline">{job.product_name ?? "Finished Item"}</Link>
                        <p className="text-gray-500">Estimate {job.quantity} · recorded good {job.good_quantity ?? "0"} · scrap {job.scrap_quantity ?? "0"}{job.problem_reason ? ` · ${job.problem_reason}` : ""}</p>
                      </div>
                    </div>
                    <StatusBadge status="awaiting_approval" />
                  </div>
                  {mayApprove ? (
                    openJob === job.id ? (
                      <form className="mt-3 grid gap-2" onSubmit={(event) => void approve(job, event)}>
                        <Field label="Actual good quantity" required>
                          <Input required type="number" min="0" step="0.001" value={signoff.produced} onChange={(event) => setSignoff({ ...signoff, produced: event.target.value })} />
                        </Field>
                        <Field label="Note" required>
                          <Input required value={signoff.note} onChange={(event) => setSignoff({ ...signoff, note: event.target.value })} />
                        </Field>
                        <Field label="Staff name" required>
                          <Input required value={signoff.staffName} onChange={(event) => setSignoff({ ...signoff, staffName: event.target.value })} />
                        </Field>
                        <Field label="Area">
                          <Input value={signoff.area} onChange={(event) => setSignoff({ ...signoff, area: event.target.value })} />
                        </Field>
                        <Field label="Approval staff">
                          <Input value={approver} readOnly />
                        </Field>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={busy} className="h-8 bg-[var(--scheme)] text-xs text-white">Approve</Button>
                          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setOpenJob(null)}>Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <Button type="button" className="mt-3 h-8 bg-[var(--scheme)] text-xs text-white" onClick={() => { setOpenJob(job.id); setSignoff({ note: "", staffName: "", area: "", produced: estimateOf(job) }) }}>
                        Approve here
                      </Button>
                    )
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--ink)]">Sign-off log</h2>
          <p className="text-[11px] text-[var(--ink-soft)]">Approved jobs stay open here, grouped by when they were signed off.</p>
        </div>
        {signedOff.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">No signed-off jobs yet.</p>
        ) : !logsReady ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">Loading the sign-off log</p>
        ) : signoffGroups.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">No sign-off notes yet.</p>
        ) : (
          <div className="space-y-4">
            {signoffGroups.map((group) => (
              <section key={group.label} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                <h2 className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs font-medium tracking-[0.4px] text-[var(--ink-soft)]">{jobHeading(group.label, now)}</h2>
                {group.lines.map(({ job, entry }) => (
                  <div key={`${job.id}-${entry.at}`} className="border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                    <p className="text-sm font-medium text-[var(--ink)]">{job.product_name ?? "Finished item"}</p>
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      {new Date(entry.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {entry.user_name} · {entry.detail}
                    </p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  )
}

