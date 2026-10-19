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

type Job = { id: string; product_name: string | null; quantity: string; status: string }
type Invoice = { id: string; number: string; status: string; total_amount: string; amount_paid: string }

export function AccountantPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [error, setError] = useState("")
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
  }, [])

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault()
    setError("")
    setAdjustSuccess(false)
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
              <Button className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40">
                <Plus className="mr-1.5 size-4" />
                Audited Stock Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                    <Scale className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-100">
                      Audited Stock Adjustment
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
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

                <div className="flex items-center justify-end gap-2 border-t border-[#262e3f] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#202737]"
                    onClick={() => setShowAdjustModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-blue-500 hover:to-indigo-500"
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waiting For Approval */}
        <section className="space-y-3 rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#262e3f] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <Clock className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Finished Jobs Awaiting Approval</h2>
                <p className="text-[11px] text-slate-400">Sign-off required before goods enter warehouse</p>
              </div>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
              {jobs.length} Queued
            </span>
          </div>

          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2b3447] bg-[#161a25]/50 p-6 text-center text-xs text-slate-500">
                No manufacturing jobs are pending approval.
              </p>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs transition-colors hover:border-amber-500/40"
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="size-4 text-amber-400" />
                    <div>
                      <p className="font-semibold text-slate-200">{job.product_name ?? "Finished Item"}</p>
                      <p className="text-slate-400">Output Quantity: <span className="font-medium text-slate-200">{job.quantity} units</span></p>
                    </div>
                  </div>
                  <StatusBadge status="awaiting_approval" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Unpaid Invoices */}
        <section className="space-y-3 rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#262e3f] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Unpaid Customer Invoices</h2>
                <p className="text-[11px] text-slate-400">Accounts receivable tracking</p>
              </div>
            </div>
            <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-300">
              {invoices.length} Unsettled
            </span>
          </div>

          <div className="space-y-2">
            {invoices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2b3447] bg-[#161a25]/50 p-6 text-center text-xs text-slate-500">
                All customer invoices are fully settled.
              </p>
            ) : (
              invoices.map((inv) => {
                const pendingAmount = Number(inv.total_amount) - Number(inv.amount_paid)
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs transition-colors hover:border-rose-500/40"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-rose-400" />
                      <div>
                        <p className="font-semibold text-slate-200">{inv.number}</p>
                        <p className="text-slate-400">Paid: ₹{inv.amount_paid} of ₹{inv.total_amount}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 font-bold text-rose-300">
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
    </div>
  )
}

