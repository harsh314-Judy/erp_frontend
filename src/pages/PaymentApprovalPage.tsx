import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Receipt } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { PaymentSummary, RecordPayment, type PaymentLine } from "@/components/RecordPayment"
import { PageLoading } from "@/components/PlantLoader"
import { Notice, PageTitle } from "@/components/plant-ui"
import { api, errorMessage } from "@/lib/api"

type Bill = {
  key: string
  title: string
  party: "Customer" | "Supplier"
  partyName: string
  status: string
  total: number
  paid: number
  payments: PaymentLine[]
  payUrl: string
}

type LogLine = {
  id: string
  bill: Bill
  payment: PaymentLine
}

type Invoice = {
  id: string
  number: string
  customer_name?: string | null
  status: string
  total_amount: string
  amount_paid: string
  payments?: PaymentLine[]
}

type PurchaseLine = { quantity: string; unit_price: string | null }
type Purchase = {
  id: string
  supplier_name: string | null
  stock_received: boolean
  amount_paid?: string | null
  lines: PurchaseLine[]
  payments?: PaymentLine[]
}

const PARTIES = [
  { id: "", label: "All" },
  { id: "customer", label: "Customer" },
  { id: "supplier", label: "Supplier" },
]

function purchaseTotal(order: Purchase) {
  return order.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price || 0), 0)
}

function startOfDay(value: Date) {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfWeek(value: Date) {
  const copy = startOfDay(value)
  const weekday = copy.getDay()
  copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1))
  return copy
}

function monthName(month: number) {
  return new Date(2026, month, 1).toLocaleString("en-IN", { month: "long" })
}

function matchesSort(when: Date, sort: string, now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const week = startOfWeek(now)
  const day = startOfDay(when)
  if (sort === "all") return true
  if (sort === "today") return day.getTime() === today.getTime()
  if (sort === "yesterday") return day.getTime() === yesterday.getTime()
  if (sort === "week") return day >= week && day <= today
  if (sort === "month") return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()
  if (sort.startsWith("month:")) return when.getFullYear() === now.getFullYear() && when.getMonth() === Number(sort.slice(6))
  if (sort.startsWith("year:")) return when.getFullYear() === Number(sort.slice(5))
  return true
}

function groupLabel(when: Date, now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const week = startOfWeek(now)
  const day = startOfDay(when)
  if (day.getTime() === today.getTime()) return "Today"
  if (day.getTime() === yesterday.getTime()) return "Yesterday"
  if (day >= week && day < today) return "This week"
  if (when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()) return "This month"
  if (when.getFullYear() === now.getFullYear()) return monthName(when.getMonth())
  return String(when.getFullYear())
}

function headingFor(label: string, now: Date) {
  const date = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const month = now.toLocaleDateString("en-IN", { month: "long" })
  if (label === "Today") return `Today · ${date}`
  if (label === "This month") return `This month · ${month}`
  return label
}

function OpenBill({ bill, focused, canPay, onPaid }: { bill: Bill; focused: boolean; canPay: boolean; onPaid: () => Promise<void> }) {
  const [preview, setPreview] = useState<string | null>(null)
  return (
    <article id={bill.key} className={`grid items-center gap-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 md:grid-cols-[minmax(0,1fr)_18rem] ${focused ? "ring-2 ring-[var(--scheme)]" : ""}`}>
      <div className="min-w-0">
        {preview ? (
          <img src={preview} alt="" className="mb-4 max-h-[420px] w-full rounded-xl border border-[var(--line)] object-contain object-left" />
        ) : null}
        <p className="text-xl font-semibold text-[var(--ink)]">{bill.partyName}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{bill.party} · {bill.title}</p>
        <div className="mt-3">
          <PaymentSummary total={bill.total} paid={bill.paid} status={bill.status} />
        </div>
      </div>
      {canPay ? (
        <RecordPayment due={Math.max(0, bill.total - bill.paid).toFixed(2)} payUrl={bill.payUrl} onPreview={setPreview} onDone={onPaid} />
      ) : null}
    </article>
  )
}

function methodLabel(method: string) {
  if (method === "upi") return "UPI"
  if (method === "bank") return "Bank transfer"
  if (method === "cash") return "Cash"
  return method
}

export function PaymentApprovalPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState("all")
  const [parties, setParties] = useState<string[]>([])
  const { can, canAccessAdmin } = useAuth()
  const [photoId, setPhotoId] = useState<string | null>(null)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [params] = useSearchParams()
  const focus = params.get("invoice") ? `invoice:${params.get("invoice")}` : params.get("purchase") ? `purchase:${params.get("purchase")}` : ""
  const now = useMemo(() => new Date(), [])

  async function load() {
    const [invoices, purchases] = await Promise.all([
      api<Invoice[]>("/api/invoices"),
      api<Purchase[]>("/api/purchase-orders"),
    ])
    const rows: Bill[] = [
      ...invoices.map((invoice) => ({
        key: `invoice:${invoice.id}`,
        title: invoice.number,
        party: "Customer" as const,
        partyName: invoice.customer_name || "Customer",
        status: invoice.status,
        total: Number(invoice.total_amount),
        paid: Number(invoice.amount_paid),
        payments: invoice.payments ?? [],
        payUrl: `/api/invoices/${invoice.id}/payments`,
      })),
      ...purchases.filter((order) => order.stock_received).map((order) => {
        const total = purchaseTotal(order)
        const paid = Number(order.amount_paid || 0)
        const status = total <= 0 || paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid"
        return {
          key: `purchase:${order.id}`,
          title: order.supplier_name || "Supplier bill",
          party: "Supplier" as const,
          partyName: order.supplier_name || "Supplier",
          status,
          total,
          paid,
          payments: order.payments ?? [],
          payUrl: `/api/purchase-orders/${order.id}/payments`,
        }
      }),
    ]
    setBills(rows)
  }

  useEffect(() => {
    load()
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  const partyOn = (bill: Bill) => parties.length === 0 || parties.includes(bill.party.toLowerCase())
  const open = bills.filter((bill) => bill.status !== "paid" && partyOn(bill))
  const lines = useMemo(() => {
    const rows: LogLine[] = []
    for (const bill of bills) {
      if (!partyOn(bill)) continue
      for (const payment of bill.payments) {
        if (matchesSort(new Date(payment.created_at), sort, now)) rows.push({ id: payment.id, bill, payment })
      }
    }
    rows.sort((left, right) => right.payment.created_at.localeCompare(left.payment.created_at))
    return rows
  }, [bills, now, parties, sort])
  const choices = useMemo(() => {
    const items = [
      { id: "all", label: "All" },
      { id: "today", label: "Today" },
      { id: "yesterday", label: "Yesterday" },
      { id: "week", label: "This week" },
      { id: "month", label: "This month" },
    ]
    for (let month = now.getMonth() - 1; month >= 0; month -= 1) items.push({ id: `month:${month}`, label: monthName(month) })
    const years = new Set<number>([now.getFullYear() - 1])
    for (const bill of bills) {
      for (const payment of bill.payments) {
        const year = new Date(payment.created_at).getFullYear()
        if (year < now.getFullYear()) years.add(year)
      }
    }
    ;[...years].sort((left, right) => right - left).forEach((year) => items.push({ id: `year:${year}`, label: String(year) }))
    return items
  }, [bills, now])
  const quickSorts = choices.filter((item) => ["all", "today", "yesterday", "week", "month"].includes(item.id))
  const customSorts = choices.filter((item) => !["all", "today", "yesterday", "week", "month"].includes(item.id))
  const customValue = customSorts.some((item) => item.id === sort) ? sort : ""
  const groups = useMemo(() => {
    const order: string[] = []
    const buckets = new Map<string, LogLine[]>()
    for (const line of lines) {
      const label = sort === "all" ? groupLabel(new Date(line.payment.created_at), now) : choices.find((item) => item.id === sort)?.label ?? "Payments"
      if (!buckets.has(label)) {
        buckets.set(label, [])
        order.push(label)
      }
      buckets.get(label)?.push(line)
    }
    return order.map((label) => ({ label, lines: buckets.get(label) ?? [] }))
  }, [choices, lines, now, sort])

  async function replacePhoto(line: LogLine, file: File) {
    setReplacingId(line.id)
    setError("")
    try {
      const body = new FormData()
      body.append("file", file)
      const [kind, ownerId] = line.bill.key.split(":")
      const path = kind === "invoice"
        ? `/api/invoices/${ownerId}/payments/${line.payment.id}/photo`
        : `/api/purchase-orders/${ownerId}/payments/${line.payment.id}/photo`
      await api(path, { method: "POST", body })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setReplacingId(null)
    }
  }

  function toggleParty(id: string) {
    if (!id) {
      setParties([])
      return
    }
    setParties((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      if (next.length === 0 || next.length === 2) return []
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Payment approval"
        hint="Record every customer and supplier installment here. The bill stays open until the paid amount covers the total."
        icon={Receipt}
        badge={`${open.length} Open`}
      />
      {error ? <Notice variant="error">{error}</Notice> : null}
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.4px] text-[var(--ink-soft)]">Sort by</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {quickSorts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSort(item.id)}
                className={`h-10 px-2 text-sm font-medium ${sort === item.id ? "text-[var(--scheme)]" : "text-[var(--ink-soft)]"}`}
              >
                {item.label}
              </button>
            ))}
            <select
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
              value={customValue}
              onChange={(event) => setSort(event.target.value || "all")}
            >
              <option value="">Custom range</option>
              {customSorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.4px] text-[var(--ink-soft)]">Party</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {PARTIES.map((item) => {
              const selected = item.id ? parties.includes(item.id) : parties.length === 0
              return (
                <button
                  key={item.id || "all"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleParty(item.id)}
                  className={`h-10 px-2 text-sm font-medium ${selected ? "text-[var(--scheme)]" : "text-[var(--ink-soft)]"}`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {loading ? <PageLoading label="Loading payments" variant="cards" count={2} /> : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--ink)]">Open bills</h2>
              <p className="text-[11px] text-[var(--ink-soft)]">These stay here until the paid amount covers the total.</p>
            </div>
            {open.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">Nothing is waiting for a payment.</p>
            ) : open.map((bill) => (
              <OpenBill key={bill.key} bill={bill} focused={focus === bill.key} canPay={can("approve_jobs")} onPaid={() => load()} />
            ))}
          </section>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--ink)]">Payment log</h2>
              <p className="text-[11px] text-[var(--ink-soft)]">Every installment stays open here, grouped by when it was recorded.</p>
            </div>
            {groups.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]">No payments in this range.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.label} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                    <h2 className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs font-medium tracking-[0.4px] text-[var(--ink-soft)]">{headingFor(group.label, now)}</h2>
                    {group.lines.map((line) => (
                      <div key={line.id} id={focus === line.bill.key ? line.bill.key : undefined} className={`border-b border-[var(--line)] px-4 py-3 last:border-b-0 ${focus === line.bill.key ? "ring-2 ring-inset ring-[var(--scheme)]" : ""}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[var(--ink)]">{line.bill.partyName} · {line.bill.title}</p>
                            <p className="text-[11px] text-[var(--ink-soft)]">
                              {new Date(line.payment.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {line.bill.party} · {methodLabel(line.payment.method)} · ₹{Number(line.payment.amount).toFixed(2)}
                              {line.payment.note ? ` · ${line.payment.note}` : ""}
                            </p>
                          </div>
                          {line.payment.attachment_id ? (
                            <button
                              type="button"
                              className="inline-flex h-10 items-center rounded-full border border-[var(--line)] px-4 text-sm font-medium text-[var(--scheme)]"
                              onClick={() => setPhotoId((current) => current === line.id ? null : line.id)}
                            >
                              {photoId === line.id ? "Hide photo" : "View photo"}
                            </button>
                          ) : null}
                        </div>
                        {photoId === line.id && line.payment.attachment_id ? (
                          <div className="mt-4">
                            <div className="relative">
                              <img
                                src={`/api/attachments/${line.payment.attachment_id}/file`}
                                alt=""
                                className="max-h-[480px] w-full rounded-xl border border-[var(--line)] object-contain object-left"
                              />
                              {replacingId === line.id ? (
                                <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/45 text-sm font-medium text-white">Replacing photo…</div>
                              ) : null}
                            </div>
                            {canAccessAdmin ? (
                              <label className={`mt-3 inline-flex h-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-5 text-sm font-medium text-[var(--ink)] ${replacingId ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                                {replacingId === line.id ? "Replacing photo…" : "Replace photo"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  disabled={replacingId !== null}
                                  onChange={(event) => {
                                    const next = event.target.files?.[0]
                                    event.target.value = ""
                                    if (next) void replacePhoto(line, next)
                                  }}
                                />
                              </label>
                            ) : null}
                          </div>
                        ) : null}
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
