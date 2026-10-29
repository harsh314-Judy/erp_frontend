import { Fragment, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Boxes,
  CheckCircle2,
  Clock,
  Factory,
  Pencil,
  PlusCircle,
  Undo2,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { Field, Notice, PageTitle, SearchSelect, StatusBadge } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, errorMessage, peek, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { useRefreshWhenShown } from "@/lib/visible"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string }
type Product = { id: string; product_name: string }
type Job = {
  id: string
  product_name: string | null
  quantity: string
  status: string
  estimated_minutes: number
  source: string
  notes: string | null
  due_at: string | null
  overdue: boolean
  created_at: string | null
  created_by_name: string | null
  assigned_user_id: string | null
  assigned_user_name: string | null
  current_operation_name: string | null
}
type Person = { id: string; first_name: string; last_name: string | null }
type Stage = {
  id: string
  operation_name: string | null
  status: string
  polish_type: string | null
  assigned_user_id: string | null
  completed_at: string | null
}
type InputRow = {
  id: string
  item_name: string | null
  planned_quantity: string
  actual_quantity: string | null
  wastage_quantity: string
  available: string | null
}
type JobEvent = {
  at: string
  user_name: string
  action: string
  stage: string | null
  detail: string
}
type Variance = {
  at: string
  user_name: string
  kind: string
  item_name: string
  quantity: string
  note: string
  stage: string | null
}
type Detail = Job & {
  stages: Stage[]
  inputs: InputRow[]
  produced_quantity: string | null
  created_at: string | null
  created_by_name: string | null
  events: JobEvent[]
  variances: Variance[]
}

function toLocalInput(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function localStamp(iso: string | null | undefined) {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function stageDone(status: string) {
  return status === "done" || status === "completed"
}

function durationLabel(minutes: number) {
  const days = Math.floor(minutes / 1440)
  const hours = Math.round((minutes % 1440) / 60)
  if (days <= 0) return hours > 0 ? `${hours}h today` : "Same day"
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

function quantityLabel(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return value
  return String(amount)
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function currentStage(job: { status: string; current_operation_name: string | null }) {
  if (job.status === "awaiting_approval") return "Waiting For Approval"
  if (job.status === "completed") return "Finished"
  if (job.status === "cancelled") return "Cancelled"
  if (job.status === "pending") return "Not Started"
  return job.current_operation_name ? titleCase(`${job.current_operation_name} Now`) : "In Progress"
}

function personLabel(person: Person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ")
}

const DOTS = ["#1e293b", "#0ea5e9", "#d946ef", "#f97316", "#10b981"]
const STAGE_COLOR: Record<string, string> = {
  cutting: "#1e293b",
  shaping: "#0ea5e9",
  assembly: "#d946ef",
  polishing: "#f97316",
  coloring: "#10b981",
  packaging: "#a78bfa",
}

function stageColor(name: string, index = 0) {
  return STAGE_COLOR[name.toLowerCase()] ?? DOTS[index % DOTS.length]
}

function stageInk(name: string) {
  const color = stageColor(name)
  return color === "#1e293b" ? "#cbd5e1" : color
}

function WorkflowCurve({ stages }: { stages: Stage[] }) {
  type Dot = {
    key: string
    label: string
    x: number
    y: number
    fill: string
    on: boolean
    now: boolean
    muted: boolean
  }
  const spine: Dot[] = []
  const forks: { from: Dot; to: Dot }[] = []
  let y = 14
  stages.forEach((stage, index) => {
    const done = stageDone(stage.status)
    const now = stage.status === "active"
    const name = stage.operation_name ?? "Stage"
    const node: Dot = {
      key: stage.id,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      x: 10,
      y,
      fill: stageColor(name, index),
      on: done || now,
      now,
      muted: false,
    }
    spine.push(node)
    if (name.toLowerCase().includes("polish")) {
      const chosen = stage.polish_type
      ;(["dry", "wet"] as const).forEach((mode) => {
        y += 18
        const dot: Dot = {
          key: `${stage.id}-${mode}`,
          label: mode === "dry" ? "Dry" : "Wet",
          x: 36,
          y,
          fill: mode === "dry" ? "#0284c7" : "#4f46e5",
          on: chosen === mode,
          now: false,
          muted: chosen != null && chosen !== mode,
        }
        forks.push({ from: node, to: dot })
      })
      y += 8
    }
    y += 36
  })
  const links: { key: string; d: string; stroke: string }[] = []
  const bend = (from: Dot, to: Dot) => {
    const mid = (from.y + to.y) / 2
    return `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`
  }
  for (let index = 1; index < spine.length; index += 1) {
    const from = spine[index - 1]
    const to = spine[index]
    if (from.label.toLowerCase().includes("polish")) continue
    links.push({ key: `${from.key}-${to.key}`, d: bend(from, to), stroke: "#d4d4d8" })
  }
  forks.forEach((fork) => {
    const stroke = fork.to.muted ? "#d4d4d8" : fork.to.on ? fork.to.fill : "#cbd5e1"
    links.push({ key: fork.to.key, d: bend(fork.from, fork.to), stroke })
    const next = spine[spine.findIndex((node) => node.key === fork.from.key) + 1]
    if (!next) return
    links.push({ key: `${fork.to.key}-onward`, d: bend(fork.to, next), stroke })
  })
  const dots = [...spine, ...forks.map((fork) => fork.to)]
  return (
    <svg width="176" height={Math.max(y - 8, 36)} className="overflow-visible" role="img" aria-label="Workflow">
      {[...links.filter((link) => link.stroke === "#d4d4d8" || link.stroke === "#cbd5e1"), ...links.filter((link) => link.stroke !== "#d4d4d8" && link.stroke !== "#cbd5e1")].map((link) => (
        <path key={link.key} d={link.d} fill="none" stroke={link.stroke} strokeWidth="1.75" strokeLinecap="round" />
      ))}
      {dots.map((dot) => (
        <g key={dot.key}>
          {dot.now ? <circle cx={dot.x} cy={dot.y} r="9" fill="none" stroke={dot.fill} strokeOpacity="0.35" /> : null}
          <circle
            cx={dot.x}
            cy={dot.y}
            r={dot.now ? "5.5" : "4.25"}
            fill={dot.muted ? "#f3f4f6" : dot.on ? dot.fill : "#ffffff"}
            stroke={dot.muted ? "#d1d5db" : dot.fill}
            strokeWidth={dot.on && !dot.muted ? 0 : 1.6}
          />
          <text
            x={dot.x + 12}
            y={dot.y + 4}
            fontSize="11"
            fontWeight={dot.muted ? 500 : dot.now ? 700 : 600}
            fill={dot.muted ? "#9ca3af" : "#f4f5f7"}
          >
            {dot.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function ProductionPage() {
  const { can, user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>(
    () => peek<Page<Job>>("/api/production-jobs/?page=1&page_size=50")?.items ?? [],
  )
  const [products, setProducts] = useState<Option[]>([])
  const [selected, setSelected] = useState<Detail | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(
    () => peek<Page<Job>>("/api/production-jobs/?page=1&page_size=50") === undefined,
  )
  const { busy, guard } = useFormBusy()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    product_id: "",
    quantity: "1",
    days: "0",
    hours: "8",
    notes: "",
    assigned_user_id: "",
    deadline: "",
  })
  const [people, setPeople] = useState<Option[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [held, setHeld] = useState(false)
  const hold = useRef(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [editForm, setEditForm] = useState({
    quantity: "",
    days: "0",
    hours: "1",
    notes: "",
    assigned_user_id: "",
    deadline: "",
  })
  const [cancelReason, setCancelReason] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [revertNote, setRevertNote] = useState("")
  const [planNote, setPlanNote] = useState("")
  const [plans, setPlans] = useState<Record<string, string>>({})
  const [variance, setVariance] = useState({ kind: "waste", item_name: "", quantity: "", note: "" })

  async function load() {
    try {
    const [jobPage, productPage, staff] = await Promise.all([
      api<Page<Job>>("/api/production-jobs/?page=1&page_size=50"),
      api<Page<Product>>("/api/products?page=1&page_size=100&brief=true"),
      can("edit_inventory") ? api<Person[]>("/api/users/options") : Promise.resolve([] as Person[]),
    ])
    setJobs(jobPage.items)
    const options = productPage.items.map((item) => ({ id: item.id, label: item.product_name }))
    setProducts(options)
    const names = staff.map((person) => ({ id: person.id, label: personLabel(person) }))
    setPeople(names)
    setForm((current) => ({
      ...current,
      product_id: current.product_id || options[0]?.id || "",
      assigned_user_id: current.assigned_user_id || names[0]?.id || "",
    }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [user?.role_name])
  useRefreshWhenShown("/production", load, (caught) => setError(errorMessage(caught)))

  useEffect(() => {
    const product = searchParams.get("product")
    if (!product) return
    setForm((current) => ({ ...current, product_id: product }))
    setShowCreate(true)
  }, [searchParams])

  function show(job: Detail) {
    setSelected(job)
    setPlans(Object.fromEntries(job.inputs.map((row) => [row.id, row.planned_quantity])))
  }

  async function open(id: string) {
    show(await api<Detail>(`/api/production-jobs/${id}`))
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    await guard(async () => {
    try {
      const minutes = Math.max(1, Number(form.days || 0) * 1440 + Number(form.hours || 0) * 60)
      const job = await api<Detail>("/api/production-jobs/", {
        method: "POST",
        body: JSON.stringify({
          product_id: form.product_id,
          quantity: form.quantity,
          estimated_minutes: minutes,
          notes: form.notes || null,
          assigned_user_id: form.assigned_user_id || null,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        }),
      })
      show(job)
      setShowCreate(false)
      void load().catch((caught) => setError(errorMessage(caught)))
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  function actorName() {
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "You"
  }

  function preview(path: string, body: unknown, job: Detail): Detail {
    const stamp = new Date().toISOString()
    const note = (detail: string, action: string, stage: string | null): Detail => ({
      ...job,
      events: [{ at: stamp, user_name: actorName(), action, stage, detail }, ...job.events],
    })
    if (path === "/start") {
      const stages = job.stages.map((stage, index) =>
        index === 0 ? { ...stage, status: "active" } : stage,
      )
      return {
        ...note("Stock held and the first stage opened", "started", stages[0]?.operation_name ?? null),
        status: "in_progress",
        stages,
        current_operation_name: stages[0]?.operation_name ?? job.current_operation_name,
      }
    }
    if (path.endsWith("/complete")) {
      const polish = (body as { polish_type?: string } | undefined)?.polish_type ?? null
      const stages = job.stages.map((stage) => ({ ...stage }))
      const active = stages.find((stage) => stage.status === "active")
      if (!active) return job
      active.status = "done"
      active.polish_type = polish
      active.completed_at = stamp
      const upcoming = stages.find((stage) => stage.status === "pending")
      if (upcoming) upcoming.status = "active"
      const moved = upcoming ? upcoming.operation_name ?? "the next stage" : "awaiting approval"
      return {
        ...note(
          `Finished ${active.operation_name ?? "stage"}${polish ? ` (${polish})` : ""} → ${moved}`,
          "advanced",
          active.operation_name,
        ),
        status: upcoming ? "in_progress" : "awaiting_approval",
        stages,
        current_operation_name: upcoming?.operation_name ?? job.current_operation_name,
      }
    }
    if (path === "/revert") {
      const stages = job.stages.map((stage) => ({ ...stage }))
      const done = stages.filter((stage) => stageDone(stage.status))
      const previous = done[done.length - 1]
      if (!previous) return job
      const active = stages.find((stage) => stage.status === "active")
      if (active) active.status = "pending"
      const was = previous.polish_type
      previous.status = "active"
      previous.polish_type = null
      previous.completed_at = null
      return {
        ...note(
          `Stepped back to ${previous.operation_name ?? "stage"}${was ? ` (was ${was})` : ""}`,
          "reverted",
          previous.operation_name,
        ),
        status: "in_progress",
        stages,
        current_operation_name: previous.operation_name,
      }
    }
    if (path === "/variances") {
      const row = body as { kind: string; item_name: string; quantity: string; note: string }
      const label = row.kind === "extra_made" ? "Made extra" : row.kind === "extra_used" ? "Used extra" : "Wasted"
      const stage = job.stages.find((item) => item.status === "active")?.operation_name ?? null
      return {
        ...note(`${label} ${row.quantity} ${row.item_name} — ${row.note}`, "variance", stage),
        variances: [
          {
            at: stamp,
            user_name: actorName(),
            kind: row.kind,
            item_name: row.item_name,
            quantity: row.quantity,
            note: row.note,
            stage,
          },
          ...job.variances,
        ],
      }
    }
    if (path === "/requirements") {
      const lines = (body as { inputs: { input_id: string; planned_quantity: string }[] }).inputs
      const inputs = job.inputs.map((input) => {
        const next = lines.find((line) => line.input_id === input.id)
        return next ? { ...input, planned_quantity: String(next.planned_quantity) } : input
      })
      return { ...note("Requirements updated", "requirement", job.current_operation_name), inputs }
    }
    if (path === "/approve") return { ...note("Approved the finished output", "approved", null), status: "completed" }
    if (path === "/cancel") return { ...note("Job cancelled", "cancelled", null), status: "cancelled" }
    return job
  }

  async function act(path: string, body?: unknown) {
    if (!selected || hold.current) return false
    hold.current = true
    setHeld(true)
    setError("")
    const before = selected
    const optimistic = preview(path, body, selected)
    show(optimistic)
    setJobs((current) =>
      current.map((job) =>
        job.id === optimistic.id
          ? {
              ...job,
              status: optimistic.status,
              quantity: optimistic.quantity,
              current_operation_name: optimistic.current_operation_name,
            }
          : job,
      ),
    )
    try {
      const job = await api<Detail>(`/api/production-jobs/${selected.id}${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      })
      show(job)
      void load().catch((caught) => setError(errorMessage(caught)))
      return true
    } catch (caught) {
      show(before)
      setJobs((current) => current.map((job) => (job.id === before.id ? { ...job, status: before.status } : job)))
      setError(errorMessage(caught))
      return false
    } finally {
      hold.current = false
      setHeld(false)
    }
  }

  const active = selected?.stages.find((stage) => stage.status === "active")
  const priorFinish = selected ? [...selected.stages].reverse().find((stage) => stage.completed_at) : undefined
  const counts = {
    all: jobs.length,
    pending: jobs.filter((job) => job.status === "pending").length,
    in_progress: jobs.filter((job) => job.status === "in_progress").length,
    awaiting_approval: jobs.filter((job) => job.status === "awaiting_approval").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    cancelled: jobs.filter((job) => job.status === "cancelled").length,
  }
  const visibleJobs = [...jobs]
    .filter((job) => statusFilter === "all" || job.status === statusFilter)
    .sort((left, right) => {
      if (sortBy === "oldest") return (left.created_at ?? "").localeCompare(right.created_at ?? "")
      if (sortBy === "deadline") return (left.due_at ?? "9999").localeCompare(right.due_at ?? "9999")
      if (sortBy === "quantity") return Number(right.quantity) - Number(left.quantity)
      if (sortBy === "stage") return (left.current_operation_name ?? "").localeCompare(right.current_operation_name ?? "")
      return (right.created_at ?? "").localeCompare(left.created_at ?? "")
    })

  function beginEdit(job: Job, event: MouseEvent) {
    event.stopPropagation()
    if (hold.current) return
    const days = Math.floor((job.estimated_minutes || 0) / 1440)
    const hours = Math.round(((job.estimated_minutes || 0) % 1440) / 60)
    setEditForm({
      quantity: String(Number(job.quantity)),
      days: String(days),
      hours: String(hours),
      notes: job.notes ?? "",
      assigned_user_id: job.assigned_user_id ?? "",
      deadline: job.due_at ? toLocalInput(job.due_at) : "",
    })
    setEditJob(job)
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editJob || hold.current) return
    hold.current = true
    setHeld(true)
    setError("")
    try {
      const minutes = Math.max(1, Number(editForm.days || 0) * 1440 + Number(editForm.hours || 0) * 60)
      const job = await api<Detail>(`/api/production-jobs/${editJob.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: editForm.quantity,
          notes: editForm.notes || null,
          estimated_minutes: minutes,
          deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
          ...(editForm.assigned_user_id ? { assigned_user_id: editForm.assigned_user_id } : {}),
        }),
      })
      if (selected?.id === job.id) show(job)
      setEditJob(null)
      void load().catch((caught) => setError(errorMessage(caught)))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      hold.current = false
      setHeld(false)
    }
  }

  async function toggle(id: string) {
    if (hold.current) {
      setError("Still confirming the previous action")
      return
    }
    try {
      if (selected?.id === id) {
        setSelected(null)
        return
      }
      await open(id)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="production-floor space-y-6">
      <PageTitle
        title="Production Floor"
        hint="Stage-by-stage workpiece routing. Raw stock is automatically held upon job initiation."
        icon={Factory}
        badge={`${jobs.length} Active Jobs`}
        action={
          can("edit_inventory") ? (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  New Production Job
                </Button>
              </DialogTrigger>
              <DialogContent className="production-dialog sm:max-w-2xl border-gray-200 bg-white">
                <FormBusy show={busy} />
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-600">
                      <Factory className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-gray-900">Initiate New Production Job</DialogTitle>
                  </div>
                </DialogHeader>
                <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                  <div className="sm:col-span-2">
                    <SearchSelect
                      label="Product to Manufacture"
                      options={products}
                      value={form.product_id}
                      onChange={(product_id) => setForm({ ...form, product_id })}
                      required
                    />
                  </div>
                  <Field label="Target Quantity" required>
                    <Input
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                    />
                  </Field>
                  <Field label="Days" required>
                    <Input
                      type="number"
                      min="0"
                      value={form.days}
                      onChange={(event) => setForm({ ...form, days: event.target.value })}
                    />
                  </Field>
                  <Field label="Hours" required>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={form.hours}
                      onChange={(event) => setForm({ ...form, hours: event.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <SearchSelect
                      label="Assign to"
                      options={people}
                      value={form.assigned_user_id}
                      onChange={(assigned_user_id) => setForm({ ...form, assigned_user_id })}
                    />
                  </div>
                  <Field label="Deadline" className="sm:col-span-2">
                    <Input
                      type="datetime-local"
                      value={form.deadline}
                      onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                    />
                  </Field>
                  <p className="sm:col-span-2 text-[11px] leading-relaxed text-gray-500">
                    Same-day work reminds the assigned person and the person who opened the job at 10:00 if it is still untouched. A deadline alerts admins once it passes.
                  </p>
                  <Field label="Floor Instructions / Notes" className="sm:col-span-2">
                    <Input
                      placeholder="e.g. 2B finish required, handle with care"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    />
                  </Field>
                  <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-gray-100 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowCreate(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={held || busy}
                      className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                    >
                      Confirm & Launch Job
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading production jobs" variant="table" cols={4} count={5} />
      ) : (
        <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200/90 bg-white p-1.5 text-xs font-medium shadow-xs">
            {(
              [
                ["all", `All (${counts.all})`, "bg-emerald-700"],
                ["pending", `Pending (${counts.pending})`, "bg-slate-600"],
                ["in_progress", `In Progress (${counts.in_progress})`, "bg-blue-600"],
                ["awaiting_approval", `Awaiting (${counts.awaiting_approval})`, "bg-amber-600"],
                ["completed", `Completed (${counts.completed})`, "bg-emerald-600"],
                ["cancelled", `Cancelled (${counts.cancelled})`, "bg-rose-600"],
              ] as const
            ).map(([id, label, activeTone]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-xl px-3 py-1.5 font-semibold transition-all",
                  statusFilter === id ? `${activeTone} text-white shadow-xs` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                )}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="deadline">Deadline</option>
            <option value="quantity">Quantity</option>
            <option value="stage">Workflow stage</option>
          </select>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-gray-200/90 bg-white px-4 py-3 text-center shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Production Queue
            </span>
            <span className="text-xs text-gray-400">Open a job to work the stage</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="space-y-2.5">
                {jobs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-gray-400">
                    No production jobs active. Create one above to get started.
                  </p>
                ) : (
                  visibleJobs.map((job, index) => {
                    const isSelected = selected?.id === job.id
                    const ink = job.current_operation_name && (job.status === "in_progress" || job.status === "active")
                      ? stageInk(job.current_operation_name)
                      : undefined
                    return (
                      <Fragment key={job.id}>
                      {index > 0 ? <div className="mx-6 h-px bg-white/10" /> : null}
                      {isSelected ? null : (
                      <div
                        className={cn(
                          "grid cursor-pointer grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto] items-center gap-x-8 rounded-2xl border border-gray-200/90 bg-white px-5 py-4 shadow-xs transition-all duration-300 hover:bg-gray-50/70",
                          selected && "bg-[#1a1d23]",
                        )}
                        onClick={() => void toggle(job.id)}
                      >
                        <span className="truncate text-[15px] font-semibold text-gray-900">{job.product_name ?? "Custom Job"}</span>
                        <span className="truncate text-xs text-gray-800">
                          Started {localStamp(job.created_at)}
                          {job.created_by_name ? ` · ${job.created_by_name}` : ""}
                        </span>
                        <span className="truncate text-xs text-gray-800">
                          {durationLabel(job.estimated_minutes || 0)}
                          {job.assigned_user_name ? ` · ${job.assigned_user_name}` : ""}
                          <span className="mx-2 text-gray-300">·</span>
                          Target {quantityLabel(job.quantity)}
                          <span className="mx-2 text-gray-300">·</span>
                          <span className="font-semibold" style={{ color: ink ?? "#f2f4f7" }}>{currentStage(job)}</span>
                        </span>
                        {user?.role_name === "super_admin" && job.status !== "completed" && job.status !== "cancelled" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50"
                            aria-label="Edit job"
                            onClick={(event) => beginEdit(job, event)}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      )}
                      <div>
                          <div className={cn("grid transition-[grid-template-rows] duration-500 ease-out", isSelected ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                            <div className={cn("min-h-0 overflow-hidden", isSelected && "py-3")}>
                              {isSelected && selected ? (
          <section className={cn("relative z-10 @container space-y-4 rounded-2xl border border-white/10 bg-white p-4 text-gray-900 shadow-[0_2px_6px_rgba(0,0,0,0.35),0_18px_40px_rgba(0,0,0,0.45)]", held && "pointer-events-none")}>
            {held ? (
              <p className="text-xs font-medium text-emerald-700">Recorded. Other actions stay locked until the plant confirms it.</p>
            ) : null}
            <div
              className="flex cursor-pointer flex-wrap items-start justify-between gap-3 border-b border-gray-300 pb-4"
              onClick={() => void toggle(selected.id)}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{selected.product_name}</h2>
                  <StatusBadge status={selected.status} />
                  <span className="text-xs font-semibold" style={{ color: selected.current_operation_name && (selected.status === "in_progress" || selected.status === "active") ? stageInk(selected.current_operation_name) : "#f2f4f7" }}>{currentStage(selected)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-800">
                  Started {localStamp(selected.created_at)}
                  {selected.created_by_name ? ` · ${selected.created_by_name}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-800">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-gray-700" />
                    {durationLabel(selected.estimated_minutes || 0)}
                    {selected.assigned_user_name ? ` · Assigned to ${selected.assigned_user_name}` : ""}
                    {selected.due_at ? ` · Due ${localStamp(selected.due_at)}` : ""}
                  </span>
                  <span>Target {quantityLabel(selected.quantity)}</span>
                  {selected.events[0] ? (
                    <span className="font-medium text-gray-900">
                      Latest · {localStamp(selected.events[0].at)} · {selected.events[0].user_name}
                    </span>
                  ) : priorFinish ? (
                    <span className="font-medium text-gray-900">
                      Latest · {localStamp(priorFinish.completed_at)} · {priorFinish.operation_name ?? "Stage"} finished
                    </span>
                  ) : null}
                </div>
              </div>
              {user?.role_name === "super_admin" && selected.status !== "completed" && selected.status !== "cancelled" ? (
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
                  aria-label="Edit job"
                  onClick={(event) => beginEdit(selected, event)}
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="grid items-start gap-4 @min-[640px]:grid-cols-[12.5rem_minmax(0,1fr)] @min-[860px]:grid-cols-[12.5rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-gray-300 bg-white p-3">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-800">Workflow</p>
                <WorkflowCurve stages={selected.stages} />
                {selected.status === "awaiting_approval" ? (
                  <p className="mt-2 text-[10px] font-medium text-amber-700">Waiting for approval</p>
                ) : null}
                {selected.stages.some((stage) => stageDone(stage.status)) &&
                (selected.status === "in_progress" || selected.status === "awaiting_approval") &&
                (can("edit_inventory") || can("approve_jobs") || selected.stages.some((stage) => stage.assigned_user_id === user?.id)) ? (
                  <form
                    className="mt-3 space-y-1.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void act("/revert", { note: revertNote }).then((ok) => {
                        if (ok) setRevertNote("")
                      })
                    }}
                  >
                    <Input
                      className="h-8 text-xs"
                      value={revertNote}
                      placeholder="Why step back?"
                      onChange={(event) => setRevertNote(event.target.value)}
                    />
                    <Button type="submit" disabled={held || busy || revertNote.trim().length < 3} variant="outline" size="sm" className="h-8 w-full rounded-lg text-xs">
                      <Undo2 className="mr-1 size-3.5" />
                      Step back
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="min-w-0 rounded-xl border border-gray-300 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-800">Latest updates</p>
                {selected.events.length === 0 && !selected.stages.some((stage) => stage.completed_at) ? (
                  <p className="mt-3 text-xs text-gray-400">Moves from here on record the person and the time.</p>
                ) : (
                  <ul className="mt-2 space-y-2.5">
                    {selected.events.map((event, index) => (
                      <li key={`${event.at}-${index}`} className="border-b border-gray-300 pb-2 last:border-0">
                        <p className="text-[11px] font-medium text-gray-900">
                          {localStamp(event.at)} · {event.user_name}
                        </p>
                        <p className="text-xs leading-snug text-gray-900">{event.detail}</p>
                      </li>
                    ))}
                    {selected.events.length === 0
                      ? [...selected.stages]
                          .reverse()
                          .filter((stage) => stage.completed_at)
                          .map((stage) => (
                            <li key={stage.id} className="border-b border-gray-300 pb-2 last:border-0">
                              <p className="text-[11px] font-medium text-gray-900">{localStamp(stage.completed_at)}</p>
                              <p className="text-xs leading-snug text-gray-800">
                                {(stage.operation_name ?? "Stage")} finished
                                {stage.polish_type ? ` (${stage.polish_type})` : ""}
                              </p>
                            </li>
                          ))
                      : null}
                  </ul>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-gray-300 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-800">Used, wasted, extra</p>
                {selected.variances.length === 0 ? (
                  <p className="mt-3 text-xs text-gray-400">Nothing logged beyond the plan.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selected.variances.map((row, index) => (
                      <li key={`${row.at}-${index}`} className="text-xs">
                        <p className="font-medium text-gray-900">
                          <span
                            className={cn(
                              "mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              row.kind === "extra_made"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.kind === "extra_used"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800",
                            )}
                          >
                            {row.kind === "extra_made" ? "Extra made" : row.kind === "extra_used" ? "Extra used" : "Wasted"}
                          </span>
                          {row.quantity} {row.item_name}
                        </p>
                        <p className="text-[11px] font-medium text-gray-900">
                          {localStamp(row.at)} · {row.user_name}
                          {row.stage ? ` · ${row.stage}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {(selected.status === "in_progress" || selected.status === "awaiting_approval") &&
                (can("edit_inventory") || can("approve_jobs") || selected.stages.some((stage) => stage.assigned_user_id === user?.id)) ? (
                  <form
                    className="mt-3 grid grid-cols-2 gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void act("/variances", variance).then((ok) => {
                        if (ok) setVariance({ kind: "waste", item_name: "", quantity: "", note: "" })
                      })
                    }}
                  >
                    <select
                      className="col-span-2 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800"
                      value={variance.kind}
                      onChange={(event) => setVariance({ ...variance, kind: event.target.value })}
                    >
                      <option value="waste">Wasted</option>
                      <option value="extra_used">Used more than planned</option>
                      <option value="extra_made">Made extra</option>
                    </select>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Item"
                      value={variance.item_name}
                      onChange={(event) => setVariance({ ...variance, item_name: event.target.value })}
                    />
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Qty"
                      value={variance.quantity}
                      onChange={(event) => setVariance({ ...variance, quantity: event.target.value })}
                    />
                    <Input
                      className="col-span-2 h-8 text-xs"
                      placeholder="What happened"
                      value={variance.note}
                      onChange={(event) => setVariance({ ...variance, note: event.target.value })}
                    />
                    <Button
                      type="submit"
                      disabled={held || busy || variance.note.trim().length < 3 || !variance.item_name.trim() || !variance.quantity}
                      size="sm"
                      variant="outline"
                      className="col-span-2 h-8 rounded-lg text-xs"
                    >
                      Log it
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                <Boxes className="size-3.5 text-green-600" />
                <span>Materials for this stage</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
                <div className="space-y-1.5 p-3 text-xs">
                  {selected.inputs.length === 0 ? (
                    <p className="text-gray-400">No materials on this job.</p>
                  ) : (
                    selected.inputs.map((input) => (
                      <div key={input.id} className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0">
                        <span className="font-medium text-gray-900">{input.item_name}</span>
                        {can("approve_jobs") && (selected.status === "in_progress" || selected.status === "awaiting_approval") ? (
                          <label className="flex items-center gap-2 text-gray-500">
                            Planned
                            <Input
                              className="h-7 w-20 text-xs"
                              type="number"
                              min="0"
                              step="any"
                              value={plans[input.id] ?? input.planned_quantity}
                              onChange={(event) => setPlans({ ...plans, [input.id]: event.target.value })}
                            />
                          </label>
                        ) : (
                          <span className="text-gray-600">
                            Planned <strong className="text-gray-900">{input.planned_quantity}</strong>
                            {input.available != null ? <span className="text-gray-400"> · free {input.available}</span> : null}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              {can("approve_jobs") &&
              selected.inputs.length > 0 &&
              (selected.status === "in_progress" || selected.status === "awaiting_approval") ? (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void act("/requirements", {
                      note: planNote,
                      inputs: selected.inputs.map((input) => ({
                        input_id: input.id,
                        planned_quantity: plans[input.id] ?? input.planned_quantity,
                      })),
                    }).then((ok) => {
                      if (ok) setPlanNote("")
                    })
                  }}
                >
                  <Input
                    className="h-8 text-xs"
                    value={planNote}
                    placeholder="Why the requirement changed"
                    onChange={(event) => setPlanNote(event.target.value)}
                  />
                  <Button type="submit" disabled={held || busy || planNote.trim().length < 3} size="sm" variant="outline" className="h-8 shrink-0 rounded-lg text-xs">
                    Update requirements
                  </Button>
                </form>
              ) : null}
            </div>

            {/* Operator Actions */}
            <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              {selected.status === "pending" ? (
                <Button
                  type="button"
                  className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                  onClick={() => void act("/start")}
                >
                  <Factory className="mr-1.5 size-4" />
                  Start Production & Hold Stock
                </Button>
              ) : null}

              {active && (active.assigned_user_id === user?.id || can("edit_inventory")) ? (
                <>
                  {active.operation_name?.toLowerCase() === "polishing" ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "dry" })}
                      >
                        Finish Dry Polish
                      </Button>
                      <Button
                        type="button"
                        className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                        onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "wet" })}
                      >
                        Finish Wet Polish
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                      onClick={() => void act(`/stages/${active.id}/complete`, {})}
                    >
                      <CheckCircle2 className="mr-1.5 size-4" />
                      Mark Stage Complete
                    </Button>
                  )}
                </>
              ) : null}

              {selected.status === "awaiting_approval" && can("approve_jobs") ? (
                <Button
                  type="button"
                  className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                  onClick={() =>
                    void act("/approve", {
                      produced_quantity: selected.quantity,
                      inputs: selected.inputs.map((input) => ({
                        input_id: input.id,
                        actual_quantity: input.planned_quantity,
                        wastage_quantity: "0",
                      })),
                    })
                  }
                >
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Approve Finished Output
                </Button>
              ) : null}
            </div>

            {/* Cancel Job Form */}
            {(can("approve_jobs") || can("edit_inventory")) &&
            selected.status !== "completed" &&
            selected.status !== "cancelled" ? (
              <form
                className="mt-4 flex gap-2 border-t border-gray-100 pt-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void act("/cancel", { reason: cancelReason, produced_quantity: "0", inputs: [] })
                }}
              >
                <Input
                  className="text-xs bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                  value={cancelReason}
                  placeholder="Reason for job cancellation..."
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                <Button type="submit" disabled={held || busy} variant="destructive" size="sm" className="rounded-xl shrink-0">
                  <XCircle className="mr-1 size-3.5" />
                  Cancel Job
                </Button>
              </form>
            ) : null}
          </section>
                              ) : null}
                            </div>
                          </div>
                      </div>
                      </Fragment>
                    )
                  })
                )}
          </div>
        </div>
        </div>
      )}
      {editJob ? (
        <Dialog open onOpenChange={(open) => { if (!open) setEditJob(null) }}>
          <DialogContent className="production-dialog sm:max-w-lg border-gray-200 bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900">Edit {editJob.product_name}</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveEdit(event)}>
              <Field label="Target quantity" required>
                <Input type="number" min="0.001" step="any" value={editForm.quantity} onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })} />
              </Field>
              <Field label="Days">
                <Input type="number" min="0" value={editForm.days} onChange={(event) => setEditForm({ ...editForm, days: event.target.value })} />
              </Field>
              <Field label="Hours">
                <Input type="number" min="0" max="23" value={editForm.hours} onChange={(event) => setEditForm({ ...editForm, hours: event.target.value })} />
              </Field>
              <Field label="Deadline" className="sm:col-span-2">
                <Input type="datetime-local" value={editForm.deadline} onChange={(event) => setEditForm({ ...editForm, deadline: event.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <SearchSelect label="Assign to" options={people} value={editForm.assigned_user_id} onChange={(assigned_user_id) => setEditForm({ ...editForm, assigned_user_id })} />
              </div>
              <Field label="Instructions" className="sm:col-span-2">
                <Input value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditJob(null)}>Cancel</Button>
                <Button type="submit" disabled={held} className="bg-green-600 text-white hover:bg-green-700">Save job</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
