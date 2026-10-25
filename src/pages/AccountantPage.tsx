import { useEffect, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  Boxes,
  Clock,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  Scale,
} from "lucide-react"

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

type Job = { id: string; product_name: string | null; quantity: string; status: string }
type Invoice = { id: string; number: string; status: string; total_amount: string; amount_paid: string }

export function AccountantPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [adjustSuccess, setAdjustSuccess] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
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
      .finally(() => setLoading(false))
  }, [])

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
        title="Financial & Quality Approvals"
        hint="Accountant workstation. Approve finished job runs, track unpaid GST invoices, and log audited inventory adjustments."
        icon={Receipt}
        badge={`${jobs.length + invoices.length} Pending Tasks`}
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
                  <div className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
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
        <div className="grid gap-6 lg:grid-cols-2">
        {/* Waiting For Approval */}
        <section className="space-y-3 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Finished Jobs Awaiting Approval</h2>
                <p className="text-[11px] text-gray-500">Sign-off required before goods enter warehouse</p>
              </div>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
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
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 text-xs transition-colors hover:border-gray-300"
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="size-4 text-amber-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{job.product_name ?? "Finished Item"}</p>
                      <p className="text-gray-500">Output Quantity: <span className="font-medium text-gray-900">{job.quantity} units</span></p>
                    </div>
                  </div>
                  <StatusBadge status="awaiting_approval" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Unpaid Invoices */}
        <section className="space-y-3 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Unpaid Customer Invoices</h2>
                <p className="text-[11px] text-gray-500">Accounts receivable tracking</p>
              </div>
            </div>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
              {invoices.length} Unsettled
            </span>
          </div>

          <div className="space-y-2">
            {invoices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs text-gray-500">
                All customer invoices are fully settled.
              </p>
            ) : (
              invoices.map((inv) => {
                const pendingAmount = Number(inv.total_amount) - Number(inv.amount_paid)
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 text-xs transition-colors hover:border-gray-300"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-rose-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{inv.number}</p>
                        <p className="text-gray-500">Paid: ₹{inv.amount_paid} of ₹{inv.total_amount}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-bold text-rose-700">
                        Due: ₹{pendingAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
      )}
    </div>
  )
}

