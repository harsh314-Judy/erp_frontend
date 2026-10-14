import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"

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
    <div>
      <PageTitle title="Production" hint="One job moves stage by stage. Stock is held when the job starts." />
      {error ? <Notice>{error}</Notice> : null}
      {can("edit_inventory") ? (
        <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4" onSubmit={(event) => void create(event)}>
          <SearchSelect label="Product" options={products} value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
          <Field label="Quantity"><Input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
          <Field label="Estimate (minutes)"><Input value={form.estimated_minutes} onChange={(event) => setForm({ ...form, estimated_minutes: event.target.value })} /></Field>
          <Field label="Notes"><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit">Create job</Button></div>
        </form>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-x-auto rounded-xl border bg-white">
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
              {jobs.map((job) => (
                <TableRow key={job.id} className="cursor-pointer" onClick={() => void open(job.id)}>
                  <TableCell>{job.product_name}</TableCell>
                  <TableCell>{job.quantity}</TableCell>
                  <TableCell>{job.status.replaceAll("_", " ")}</TableCell>
                  <TableCell>{job.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {selected ? (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-medium">{selected.product_name}</h2>
            <p className="text-sm text-muted-foreground">{selected.status.replaceAll("_", " ")} · {selected.estimated_minutes} min estimate</p>
            <ul className="my-3 grid gap-1 text-sm">
              {selected.stages.map((stage, index) => (
                <li key={stage.id}>{index + 1}. {stage.operation_name} — {stage.status}{stage.polish_type ? ` (${stage.polish_type})` : ""}</li>
              ))}
            </ul>
            <ul className="mb-3 grid gap-1 text-sm">
              {selected.inputs.map((input) => (
                <li key={input.id}>{input.item_name}: planned {input.planned_quantity}, free {input.available ?? "–"}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {selected.status === "pending" ? <Button type="button" onClick={() => void act("/start")}>Start</Button> : null}
              {active && (active.assigned_user_id === user?.id || can("edit_inventory")) ? (
                <>
                  {active.operation_name?.toLowerCase() === "polishing" ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "dry" })}>Finish dry</Button>
                      <Button type="button" variant="outline" onClick={() => void act(`/stages/${active.id}/complete`, { polish_type: "wet" })}>Finish wet</Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => void act(`/stages/${active.id}/complete`, {})}>Mark stage done</Button>
                  )}
                </>
              ) : null}
              {selected.status === "awaiting_approval" && can("approve_jobs") ? (
                <Button
                  type="button"
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
                  Approve output
                </Button>
              ) : null}
            </div>
            {(can("approve_jobs") || can("edit_inventory")) && selected.status !== "completed" && selected.status !== "cancelled" ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void act("/cancel", { reason: cancelReason, produced_quantity: "0", inputs: [] })
                }}
              >
                <Input value={cancelReason} placeholder="Cancellation reason" onChange={(event) => setCancelReason(event.target.value)} />
                <Button type="submit" variant="outline">Cancel</Button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
