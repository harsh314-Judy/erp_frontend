import { useEffect, useState, type FormEvent } from "react"

import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage, type Page } from "@/lib/api"

type Job = { id: string; product_name: string | null; quantity: string; status: string }
type Invoice = { id: string; number: string; status: string; total_amount: string; amount_paid: string }

export function AccountantPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [error, setError] = useState("")
  const [adjust, setAdjust] = useState({ product_id: "", quantity_delta: "", reason: "" })

  useEffect(() => {
    Promise.all([
      api<Page<Job>>("/api/production-jobs/?page=1&page_size=50"),
      api<Invoice[]>("/api/invoices"),
    ])
      .then(([jobPage, invoiceRows]) => {
        setJobs(jobPage.items.filter((job) => job.status === "awaiting_approval"))
        setInvoices(invoiceRows.filter((invoice) => invoice.status !== "paid"))
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault()
    setError("")
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
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Accountant work" hint="Approve finished jobs, follow unpaid invoices, and correct stock with a reason." />
      {error ? <Notice>{error}</Notice> : null}
      <section className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Waiting for approval</h2>
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No jobs are waiting.</p> : null}
        <ul className="grid gap-2 text-sm">
          {jobs.map((job) => (
            <li key={job.id}>{job.product_name} · {job.quantity}</li>
          ))}
        </ul>
      </section>
      <section className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Unpaid invoices</h2>
        <ul className="grid gap-2 text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id}>{invoice.number} · {invoice.status} · {invoice.amount_paid} of {invoice.total_amount}</li>
          ))}
        </ul>
      </section>
      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void saveAdjustment(event)}>
        <Field label="Product id"><Input value={adjust.product_id} onChange={(event) => setAdjust({ ...adjust, product_id: event.target.value })} placeholder="Paste a product id" /></Field>
        <Field label="Quantity change"><Input value={adjust.quantity_delta} onChange={(event) => setAdjust({ ...adjust, quantity_delta: event.target.value })} placeholder="12.5 or -1" /></Field>
        <Field label="Reason"><Input required value={adjust.reason} onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })} /></Field>
        <Button type="submit">Adjust stock</Button>
      </form>
    </div>
  )
}
