import { useEffect, useState, type FormEvent } from "react"
import {
  Boxes,
  CheckCircle2,
  Clock,
  Factory,
  Layers,
  PlusCircle,
  Wrench,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"
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
}
type Stage = {
  id: string
  operation_name: string | null
  status: string
  polish_type: string | null
  assigned_user_id: string | null
}
type InputRow = {
  id: string
  item_name: string | null
  planned_quantity: string
  actual_quantity: string | null
  wastage_quantity: string
  available: string | null
}
type Detail = Job & { stages: Stage[]; inputs: InputRow[]; produced_quantity: string | null }

export function ProductionPage() {
  const { can, user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [selected, setSelected] = useState<Detail | null>(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ product_id: "", quantity: "1", estimated_minutes: "60", notes: "" })
  const [cancelReason, setCancelReason] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    const [jobPage, productPage] = await Promise.all([
      api<Page<Job>>("/api/production-jobs/?page=1&page_size=50"),
      api<Page<Product>>("/api/products?page=1&page_size=100"),
    ])
    setJobs(jobPage.items)
    const options = productPage.items.map((item) => ({ id: item.id, label: item.product_name }))
    setProducts(options)
    setForm((current) => ({ ...current, product_id: current.product_id || options[0]?.id || "" }))
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function open(id: string) {
    setSelected(await api<Detail>(`/api/production-jobs/${id}`))
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      const job = await api<Detail>("/api/production-jobs/", {
        method: "POST",
        body: JSON.stringify({ ...form, notes: form.notes || null }),
      })
      setSelected(job)
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function act(path: string, body?: unknown) {
    if (!selected) return
    setError("")
    try {
      const job = await api<Detail>(`/api/production-jobs/${selected.id}${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      })
      setSelected(job)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const active = selected?.stages.find((stage) => stage.status === "active")

  return (
    <div className="space-y-6">
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
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  New Production Job
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Factory className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-slate-100">Initiate New Production Job</DialogTitle>
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
                  <Field label="Est. Duration (Minutes)" required>
                    <Input
                      type="number"
                      min="1"
                      value={form.estimated_minutes}
                      onChange={(event) => setForm({ ...form, estimated_minutes: event.target.value })}
                    />
                  </Field>
                  <Field label="Floor Instructions / Notes" className="sm:col-span-2">
                    <Input
                      placeholder="e.g. 2B finish required, handle with care"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    />
                  </Field>
                  <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-[#262e3f] pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#222938]"
                      onClick={() => setShowCreate(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/15 hover:from-blue-500 hover:to-indigo-500"
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

      {/* Main Grid: Jobs Table + Detail Panel */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Jobs List Table */}
        <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
          <div className="border-b border-[#262e3f] bg-[#161a25] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Production Queue
              </span>
              <span className="text-xs text-slate-400">Click row to inspect stages</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-xs text-slate-400">
                      No production jobs active. Create one above to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => {
                    const isSelected = selected?.id === job.id
                    return (
                      <TableRow
                        key={job.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-slate-800/40",
                          isSelected && "bg-blue-600/15 font-medium ring-1 ring-blue-500/30",
                        )}
                        onClick={() => void open(job.id)}
                      >
                        <TableCell className="font-semibold text-slate-200">
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <span className="size-2 rounded-full bg-blue-400 shadow-xs shadow-blue-400" />
                            ) : null}
                            <span>{job.product_name ?? "Custom Job"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-300">{job.quantity}</TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 capitalize">
                          {job.source}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Selected Job Detail Panel */}
        {selected ? (
          <section className="space-y-4 rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg text-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#262e3f] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-100">{selected.product_name}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-slate-400" />
                    {selected.estimated_minutes} min estimated
                  </span>
                  <span>·</span>
                  <span>Target: {selected.quantity} units</span>
                </div>
              </div>
            </div>

            {/* Stage Routing Stepper */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Wrench className="size-3.5 text-blue-400" />
                <span>Stage Workflow</span>
              </div>
              <div className="space-y-2">
                {selected.stages.map((stage, index) => {
                  const isActive = stage.status === "active"
                  const isDone = stage.status === "completed"
                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-3 text-xs transition-all",
                        isActive
                          ? "border-blue-500/40 bg-blue-500/15 shadow-sm ring-1 ring-blue-500/30 text-slate-100"
                          : isDone
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-[#262e3f] bg-[#161a25] text-slate-400",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-lg text-[11px] font-bold",
                            isActive
                              ? "bg-blue-600 text-white shadow-xs shadow-blue-500/30"
                              : isDone
                                ? "bg-emerald-600 text-white shadow-xs shadow-emerald-500/30"
                                : "bg-[#151924] text-slate-400 border border-[#2b3447]",
                          )}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200">
                            {stage.operation_name ?? "Processing Stage"}
                          </p>
                          {stage.polish_type ? (
                            <span className="text-[10px] font-medium text-blue-400 uppercase">
                              Mode: {stage.polish_type}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <StatusBadge status={stage.status} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bill of Materials Inputs Required */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Boxes className="size-3.5 text-indigo-400" />
                <span>Materials Allocated</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#262e3f] bg-[#161a25]">
                <div className="space-y-1.5 p-3 text-xs">
                  {selected.inputs.map((input) => (
                    <div key={input.id} className="flex items-center justify-between py-1.5 border-b border-[#262e3f]/60 last:border-0">
                      <span className="font-medium text-slate-200">{input.item_name}</span>
                      <div className="flex items-center gap-3 text-slate-300">
                        <span>Planned: <strong className="text-slate-100">{input.planned_quantity}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>Free stock: <strong className="text-emerald-400">{input.available ?? "–"}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Operator Actions */}
            <div className="pt-3 border-t border-[#262e3f] flex flex-wrap gap-2">
              {selected.status === "pending" ? (
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
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
                        className="rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20"
                        onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "dry" })}
                      >
                        Finish Dry Polish
                      </Button>
                      <Button
                        type="button"
                        className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20"
                        onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "wet" })}
                      >
                        Finish Wet Polish
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
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
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
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
                className="mt-4 flex gap-2 border-t border-[#262e3f] pt-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void act("/cancel", { reason: cancelReason, produced_quantity: "0", inputs: [] })
                }}
              >
                <Input
                  className="text-xs bg-[#151924] border-[#2b3447] text-slate-200 placeholder:text-slate-500"
                  value={cancelReason}
                  placeholder="Reason for job cancellation..."
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                <Button type="submit" variant="destructive" size="sm" className="rounded-xl shrink-0">
                  <XCircle className="mr-1 size-3.5" />
                  Cancel Job
                </Button>
              </form>
            ) : null}
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2b3447] bg-[#1a1f2b]/60 p-10 text-center">
            <Layers className="size-10 text-slate-500" />
            <h3 className="mt-3 text-sm font-semibold text-slate-200">No Job Selected</h3>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Select any production job from the list on the left to track operations, operator stages, and raw stock consumption.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
