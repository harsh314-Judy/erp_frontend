import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  CheckCircle2,
  Download,
  FileText,
  PackageCheck,
  PlusCircle,
  Search,
  Send,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { PageLoading } from "@/components/PlantLoader"
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
import { canSeePrices } from "@/lib/access"
import { api, downloadFile, errorMessage, peek, type Page } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useRefreshWhenShown } from "@/lib/visible"

type Option = { id: string; label: string }
type Customer = { id: string; name: string }
type Product = { id: string; product_name: string; product_type: string }
type User = { id: string; first_name: string; last_name: string | null }
type Line = {
  product_id: string
  product_name?: string | null
  quantity: string
  held_quantity?: string
  unit_price?: string | null
  shortfall_choice?: string | null
}
type Order = {
  id: string
  customer_name: string | null
  status: string
  delivery_charge: string
  packaging_user_id: string | null
  packaging_name?: string | null
  notes?: string | null
  invoice_id: string | null
  invoice_has_pdf: boolean
  updated_at?: string | null
  lines: Line[]
}
type FormLine = { key: string; product_id: string; quantity: string; shortfall_choice: string }
type DraftLine = {
  line_id: string
  product_name: string
  quantity: string
  unit: string
  mrp: string
  catalog_price?: string
  gst_percent: string
}
type Draft = {
  customer_name: string
  customer_address: string
  customer_state: string
  customer_gst_number: string | null
  customer_phone: string
  delivery_charge: string
  same_state: boolean
  seller_name: string
  seller_gstin: string
  lines: DraftLine[]
  has_pdf: boolean
  invoice_id: string | null
  invoice_number: string | null
}
type Rate = { mrp: string; gst: string }
type SavedInvoice = { id: string; has_pdf: boolean }

const STATUSES = [
  { id: "initiated", label: "Initiated", desc: "Order logged and stock reserved" },
  { id: "process", label: "In Process", desc: "Packaging staff is preparing the order" },
  { id: "in_delivery", label: "In Delivery", desc: "Left the plant and is on the way to the client" },
  { id: "delivered", label: "Delivered", desc: "Dispatched and removed from held stock" },
  { id: "cancelled", label: "Cancelled", desc: "Order voided. Held stock is released." },
]

function stage(status: string) {
  if (status === "open") return "initiated"
  if (status === "dispatched") return "delivered"
  return status
}

function billFileName(name: string | null) {
  const initials =
    (name || "Order")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .map((word) => word[0] ?? "")
      .join("")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase() || "SO"
  const today = new Date()
  const day = String(today.getDate()).padStart(2, "0")
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const year = String(today.getFullYear())
  return `${initials}-${day}-${month}-${year}.pdf`
}

function OrderFlow({ status }: { status: string }) {
  const steps = STATUSES.filter((step) => step.id !== "cancelled")
  const current = steps.findIndex((step) => step.id === stage(status))
  const cancelled = stage(status) === "cancelled"
  return (
    <ol className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-white px-5 py-2">
      {cancelled ? <li className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">Cancelled</li> : null}
      {steps.map((step, index) => {
        const reached = !cancelled && index <= current
        const active = !cancelled && index === current
        return (
          <li key={step.id} className="flex items-center gap-1">
            <span
              title={step.desc}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-semibold",
                active && "bg-gray-900 text-white",
                reached && !active && "text-gray-900",
                !reached && "text-gray-400",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? <span className="text-[10px] text-gray-300">→</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

function blankLine(productId = ""): FormLine {
  return { key: crypto.randomUUID(), product_id: productId, quantity: "1", shortfall_choice: "make" }
}

export function SalesPage() {
  const { user } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [orders, setOrders] = useState<Order[]>(() => peek<Order[]>("/api/sales/orders") ?? [])
  const [customers, setCustomers] = useState<Option[]>([])
  const [products, setProducts] = useState<(Option & { type: string })[]>([])
  const [people, setPeople] = useState<Option[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(() => peek<Order[]>("/api/sales/orders") === undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [kept, setKept] = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [billFor, setBillFor] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rates, setRates] = useState<Record<string, Rate>>({})
  const [form, setForm] = useState({
    customer_id: "",
    packaging_user_id: "",
    notes: "",
  })
  const [lines, setLines] = useState<FormLine[]>(() => [blankLine()])

  async function load() {
    try {
    const [orderRows, customerPage, productPage, userPage] = await Promise.all([
      api<Order[]>("/api/sales/orders"),
      api<Page<Customer>>("/api/customers/?page=1&page_size=100"),
      api<Page<Product>>("/api/products?page=1&page_size=100&brief=true"),
      api<User[]>("/api/users/options"),
    ])
    setOrders(orderRows)
    const customerOptions = customerPage.items.map((item) => ({ id: item.id, label: item.name }))
    const productOptions = productPage.items.map((item) => ({ id: item.id, label: item.product_name, type: item.product_type }))
    const peopleOptions = userPage.map((item) => ({
      id: item.id,
      label: [item.first_name, item.last_name].filter(Boolean).join(" "),
    }))
    setCustomers(customerOptions)
    setProducts(productOptions)
    setPeople(peopleOptions)
    setForm((current) => ({
      ...current,
      customer_id: current.customer_id || customerOptions[0]?.id || "",
      packaging_user_id: current.packaging_user_id || peopleOptions[0]?.id || "",
    }))
    setLines((current) =>
      current.map((line) => ({ ...line, product_id: line.product_id || productOptions[0]?.id || "" })),
    )
    setError("")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])
  useRefreshWhenShown("/sales", load, (caught) => setError(errorMessage(caught)))

  const packerName = (id: string | null) => people.find((item) => item.id === id)?.label

  function chooseStatus(next: string) {
    setStatusFilter(next)
    setKept([])
  }

  function remember(id: string) {
    setKept((current) => (current.includes(id) ? current : [...current, id]))
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    const tempId = crypto.randomUUID()
    const optimistic: Order = {
      id: tempId,
      customer_name: customers.find((item) => item.id === form.customer_id)?.label ?? null,
      status: "initiated",
      delivery_charge: "0",
      packaging_user_id: form.packaging_user_id || null,
      packaging_name: packerName(form.packaging_user_id) ?? null,
      invoice_id: null,
      invoice_has_pdf: false,
      lines: lines.map((line) => ({
        product_id: line.product_id,
        product_name: products.find((item) => item.id === line.product_id)?.label ?? null,
        quantity: line.quantity,
      })),
    }
    setOrders((current) => [optimistic, ...current])
    setShowCreate(false)
    try {
      const created = await api<Order>("/api/sales/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: form.customer_id,
          notes: form.notes || null,
          packaging_user_id: form.packaging_user_id || null,
          lines: lines.map((line) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            shortfall_choice:
              products.find((item) => item.id === line.product_id)?.type === "both"
                ? line.shortfall_choice || "make"
                : null,
          })),
        }),
      })
      setOrders((current) => current.map((order) => (order.id === tempId ? created : order)))
    } catch (caught) {
      setOrders((current) => current.filter((order) => order.id !== tempId))
      setShowCreate(true)
      setError(errorMessage(caught))
    }
  }

  async function openInvoice(order: Order) {
    setError("")
    try {
      const next = await api<Draft>(`/api/sales/orders/${order.id}/invoice-draft`)
      const seeded: Record<string, Rate> = {}
      for (const line of next.lines) {
        seeded[line.line_id] = { mrp: line.mrp, gst: String(Number(line.gst_percent)) }
      }
      setRates(seeded)
      setDraft(next)
      setBillFor(order.id)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function createBill(event: FormEvent) {
    event.preventDefault()
    if (!billFor || !draft) return
    setError("")
    const orderId = billFor
    const body = JSON.stringify({
      lines: draft.lines.map((line) => ({
        line_id: line.line_id,
        mrp: rates[line.line_id]?.mrp,
        gst_percent: rates[line.line_id]?.gst,
      })),
    })
    setBillFor(null)
    setDraft(null)
    try {
      const saved = await api<SavedInvoice>(`/api/sales/orders/${orderId}/invoice`, {
        method: "POST",
        body,
      })
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, invoice_id: saved.id, invoice_has_pdf: saved.has_pdf } : order,
        ),
      )
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  function money(value: number) {
    return Math.round(value * 100) / 100
  }

  const preview = draft
    ? draft.lines.reduce(
        (total, line) => {
          const amount = money(Number(line.quantity) * Number(rates[line.line_id]?.mrp || 0))
          const tax = money(amount * Number(rates[line.line_id]?.gst || 0) / 100)
          const cgst = draft.same_state ? money(tax / 2) : 0
          const sgst = draft.same_state ? money(tax - cgst) : 0
          return {
            taxable: money(total.taxable + amount),
            cgst: money(total.cgst + cgst),
            sgst: money(total.sgst + sgst),
            igst: money(total.igst + (draft.same_state ? 0 : tax)),
          }
        },
        { taxable: 0, cgst: 0, sgst: 0, igst: 0 },
      )
    : null
  const previewTotal = preview
    ? money(preview.taxable + preview.cgst + preview.sgst + preview.igst + Number(draft?.delivery_charge || 0))
    : 0

  async function advance(order: Order, next: string) {
    setError("")
    remember(order.id)
    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: next } : item)))
    try {
      const updated =
        next === "delivered"
          ? await api<Order>(`/api/sales/orders/${order.id}/dispatch`, { method: "POST" })
          : await api<Order>(`/api/sales/orders/${order.id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: next }),
            })
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      try {
        await load()
      } catch (loadError) {
        setError(errorMessage(loadError))
        return
      }
      setError(errorMessage(caught))
    }
  }

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return orders.filter((order) => {
      const current = stage(order.status)
      const matchesStatus = statusFilter === "all" || current === statusFilter || kept.includes(order.id)
      if (!matchesStatus) return false
      if (!query) return true
      const packer = (order.packaging_name || packerName(order.packaging_user_id) || "").toLowerCase()
      const haystack = [order.customer_name, packer, order.notes, ...order.lines.map((line) => line.product_name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [orders, statusFilter, searchQuery, kept, people])

  const counts = useMemo(() => {
    const of = (id: string) => orders.filter((order) => stage(order.status) === id).length
    return {
      total: orders.length,
      initiated: of("initiated"),
      process: of("process"),
      inDelivery: of("in_delivery"),
      delivered: of("delivered"),
      cancelled: of("cancelled"),
    }
  }, [orders])

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sales & Dispatch Orders"
        hint="Dispatch finished goods to client accounts and hold plant stock as each order is logged. Track packing, delivery, dispatch, and the invoice raised for every line."
        guide={[
          {
            heading: "How an order moves",
            items: [
              { label: "Initiated", detail: "The order is logged and the quantity is held for this client." },
              { label: "In Process", detail: "The assigned packer is preparing the goods. Start packing moves an order here." },
              { label: "In Delivery", detail: "The goods have left the plant. Step back returns the order to packing, and the hold stays." },
              { label: "Delivered", detail: "Dispatch Order removes the held quantity from stock." },
              { label: "Cancelled", detail: "The order is voided and the hold is released." },
            ],
          },
          {
            heading: "The card",
            items: [
              { label: "Client and packer", detail: "Each card shows the client, who is packing the order, and every product on it." },
              { label: "Tabs", detail: "A status change stays on the current tab until you switch tabs." },
            ],
          },
          {
            heading: "Invoice",
            items: [
              { label: "Always available", detail: "Invoice opens in every status, including before the order is dispatched." },
              { label: "Price", detail: "Each line is filled from the catalog price and can be changed before the bill is saved." },
              { label: "Tax", detail: "GST, taxable value, and the total update as the price changes." },
              { label: "Update", detail: "Saving again replaces the bill that is already on the order." },
            ],
          },
        ]}
        icon={FileText}
        badge={`${orders.length} Orders`}
        action={
          <div className="flex flex-wrap items-center gap-2">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
              >
                <PlusCircle className="mr-1.5 size-4" />
                New Sales Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bg-white border-gray-200/90 shadow-xl">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <FileText className="size-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-gray-900">Create Customer Sales Order</DialogTitle>
                </div>
              </DialogHeader>
              <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                <SearchSelect
                  label="Customer Client"
                  options={customers}
                  value={form.customer_id}
                  onChange={(customer_id) => setForm({ ...form, customer_id })}
                  required
                />
                <SearchSelect
                  label="Packaging Staff Assigned"
                  options={people}
                  value={form.packaging_user_id}
                  onChange={(packaging_user_id) => setForm({ ...form, packaging_user_id })}
                />
                <div className="grid gap-3 sm:col-span-2">
                  {lines.map((line, index) => {
                    const lineType = products.find((item) => item.id === line.product_id)?.type
                    return (
                      <div key={line.key} className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 sm:grid-cols-2">
                        <SearchSelect
                          label={index === 0 ? "Product" : `Product ${index + 1}`}
                          options={products}
                          value={line.product_id}
                          onChange={(product_id) =>
                            setLines((current) => current.map((item) => (item.key === line.key ? { ...item, product_id } : item)))
                          }
                          required
                        />
                        <Field label="Order Quantity" required>
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(event) =>
                              setLines((current) =>
                                current.map((item) => (item.key === line.key ? { ...item, quantity: event.target.value } : item)),
                              )
                            }
                          />
                        </Field>
                        {lineType === "both" ? (
                          <Field label="If Stock is Short">
                            <select
                              className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-2xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                              value={line.shortfall_choice}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item) =>
                                    item.key === line.key ? { ...item, shortfall_choice: event.target.value } : item,
                                  ),
                                )
                              }
                            >
                              <option value="make">Make it (Launch Production Job)</option>
                              <option value="buy">Buy it (Create Purchase Request)</option>
                            </select>
                          </Field>
                        ) : null}
                        {lines.length > 1 ? (
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-gray-200 text-gray-700"
                              onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                            >
                              Remove product
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => setLines((current) => [...current, blankLine(products[0]?.id || "")])}
                  >
                    <PlusCircle className="mr-1.5 size-4" />
                    Add another product
                  </Button>
                </div>
                <Field label="Order Instructions" className="sm:col-span-2">
                  <Input
                    placeholder="e.g. Export bubble packaging"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </Field>

                <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-gray-100 pt-4">
                  <Button type="button" variant="outline" className="border-gray-200 hover:bg-gray-50 text-gray-700" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs"
                  >
                    Confirm & Reserve Stock
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200/90 bg-white p-1.5 text-xs font-medium shadow-xs">
          {(
            [
              ["all", `All (${counts.total})`, "bg-emerald-700"],
              ["initiated", `Initiated (${counts.initiated})`, "bg-amber-600"],
              ["process", `Process (${counts.process})`, "bg-blue-600"],
              ["in_delivery", `In Delivery (${counts.inDelivery})`, "bg-sky-600"],
              ["delivered", `Delivered (${counts.delivered})`, "bg-emerald-600"],
              ["cancelled", `Cancelled (${counts.cancelled})`, "bg-rose-600"],
            ] as const
          ).map(([id, label, active]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-xl px-3 py-1.5 font-semibold transition-all",
                statusFilter === id ? `${active} text-white shadow-xs` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
              )}
              onClick={() => chooseStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search client, product, packer..."
            className="rounded-xl border-gray-200 bg-white pl-9 text-xs"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchQuery("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <PageLoading label="Loading sales orders" variant="cards" count={3} />
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-xs">
          <FileText className="mx-auto size-10 text-gray-400" />
          <p className="mt-2 text-sm font-semibold text-gray-800">
            {searchQuery || statusFilter !== "all" ? "No sales orders match this view" : "No Sales Orders Found"}
          </p>
          <p className="text-xs text-gray-500">
            {searchQuery || statusFilter !== "all"
              ? "Switch tabs to see orders whose status you just changed."
              : "Create an order, then raise its invoice from here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const current = stage(order.status)
            const packer = order.packaging_name || packerName(order.packaging_user_id) || "Unassigned"
            const next =
              current === "initiated" ? "process" : current === "process" ? "in_delivery" : current === "in_delivery" ? "delivered" : ""
            const nextLabel =
              current === "initiated" ? "Start packing" : current === "process" ? "Mark In Delivery" : current === "in_delivery" ? "Dispatch Order" : ""
            return (
              <article
                key={order.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white shadow-xs transition-all",
                  current === "cancelled" ? "border-rose-200 bg-rose-50/30" : "border-gray-200/90 hover:border-emerald-200",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-emerald-50/40 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                      <PackageCheck className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{order.customer_name ?? "Direct Walk-in"}</h3>
                        <span className="font-mono text-[11px] font-medium text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3 text-emerald-700" />
                          Packed by {packer}
                        </span>
                        <span>
                          {order.lines.length} {order.lines.length === 1 ? "product" : "products"}
                        </span>
                        {prices ? <span>Delivery ₹{Number(order.delivery_charge).toFixed(2)}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={current} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={() => void openInvoice(order)}
                    >
                      <FileText className="mr-1 size-3.5 text-emerald-700" />
                      Invoice
                    </Button>
                    {order.invoice_has_pdf && order.invoice_id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Download PDF"
                        className="h-8 rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() =>
                          void downloadFile(`/api/invoices/${order.invoice_id}/pdf`, billFileName(order.customer_name)).catch((caught) =>
                            setError(errorMessage(caught)),
                          )
                        }
                      >
                        <Download className="mr-1 size-3.5 text-emerald-700" />
                        {billFileName(order.customer_name).replace(/\.pdf$/, "")}
                      </Button>
                    ) : null}
                    {current === "in_delivery" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => void advance(order, "process")}
                      >
                        <Undo2 className="mr-1 size-3.5" />
                        Step back
                      </Button>
                    ) : null}
                    {next ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-xl bg-green-600 text-xs font-semibold text-white shadow-xs hover:bg-green-700"
                        onClick={() => void advance(order, next)}
                      >
                        {current === "in_delivery" ? <CheckCircle2 className="mr-1 size-3.5" /> : current === "process" ? <Truck className="mr-1 size-3.5" /> : <Send className="mr-1 size-3.5" />}
                        {nextLabel}
                      </Button>
                    ) : null}
                    {current !== "delivered" && current !== "cancelled" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                        onClick={() => {
                          if (window.confirm("Cancel this sales order? Held stock will be released.")) void advance(order, "cancelled")
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
                <OrderFlow status={current} />
                <div className="p-5">
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Product</th>
                          <th className="px-4 py-2.5 text-right">Ordered</th>
                          <th className="px-4 py-2.5 text-right">Held</th>
                          {prices ? <th className="px-4 py-2.5 text-right">Unit price</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {order.lines.map((line, index) => (
                          <tr key={`${line.product_id}-${index}`}>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">
                              {line.product_name ?? "Steel Product"}
                              {line.shortfall_choice ? (
                                <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                                  {line.shortfall_choice}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5 text-right">{line.quantity}</td>
                            <td className="px-4 py-2.5 text-right text-blue-700">{line.held_quantity ?? line.quantity}</td>
                            {prices ? <td className="px-4 py-2.5 text-right">{line.unit_price ? `₹${line.unit_price}` : "—"}</td> : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={billFor !== null} onOpenChange={(open) => { if (!open) { setBillFor(null); setDraft(null) } }}>
        <DialogContent className="sm:max-w-3xl bg-white border-gray-200/90 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                <FileText className="size-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-gray-900">Create invoice</DialogTitle>
            </div>
          </DialogHeader>
          {draft ? (
            <form className="mt-2 space-y-4" onSubmit={(event) => void createBill(event)}>
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Seller</p>
                  <p className="mt-1 font-semibold text-gray-900">{draft.seller_name}</p>
                  <p className="text-xs text-gray-600">GSTIN: {draft.seller_gstin || "Not set in company settings"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Buyer (Bill to)</p>
                  <p className="mt-1 font-semibold text-gray-900">{draft.customer_name}</p>
                  <p className="text-xs text-gray-600">{draft.customer_address}</p>
                  <p className="text-xs text-gray-600">{[draft.customer_state, draft.customer_phone].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-gray-600">GSTIN: {draft.customer_gst_number || "—"}</p>
                </div>
              </div>
              <div className="space-y-3">
                {draft.lines.map((line) => (
                  <div key={line.line_id} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <p className="text-sm font-semibold text-gray-900">{line.product_name}</p>
                      <p className="text-xs text-gray-500">Qty {line.quantity} {line.unit}</p>
                    </div>
                    <Field label="Price (₹)" required hint={line.catalog_price ? `Catalog ₹${Number(line.catalog_price).toFixed(2)}` : undefined}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={rates[line.line_id]?.mrp ?? ""}
                        onChange={(event) =>
                          setRates((current) => ({
                            ...current,
                            [line.line_id]: { mrp: event.target.value, gst: current[line.line_id]?.gst ?? "0" },
                          }))
                        }
                      />
                      {line.catalog_price ? (
                        <button
                          type="button"
                          className="mt-1 text-left text-[11px] font-semibold text-emerald-700 hover:underline"
                          onClick={() =>
                            setRates((current) => ({
                              ...current,
                              [line.line_id]: { mrp: String(line.catalog_price), gst: current[line.line_id]?.gst ?? line.gst_percent },
                            }))
                          }
                        >
                          Use catalog price
                        </button>
                      ) : null}
                    </Field>
                    <Field label="GST %" required>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        value={rates[line.line_id]?.gst ?? ""}
                        onChange={(event) =>
                          setRates((current) => ({
                            ...current,
                            [line.line_id]: { gst: event.target.value, mrp: current[line.line_id]?.mrp ?? "0" },
                          }))
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
              {preview ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-xs text-gray-600">
                  <div className="flex justify-between"><span>Taxable</span><span className="font-semibold text-gray-900">₹{preview.taxable.toFixed(2)}</span></div>
                  {draft.same_state ? (
                    <>
                      <div className="mt-1 flex justify-between"><span>CGST</span><span>₹{preview.cgst.toFixed(2)}</span></div>
                      <div className="mt-1 flex justify-between"><span>SGST</span><span>₹{preview.sgst.toFixed(2)}</span></div>
                    </>
                  ) : (
                    <div className="mt-1 flex justify-between"><span>IGST</span><span>₹{preview.igst.toFixed(2)}</span></div>
                  )}
                  <div className="mt-1 flex justify-between"><span>Delivery</span><span>₹{Number(draft.delivery_charge).toFixed(2)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-900">
                    <span>Total</span><span>₹{previewTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}
              <DialogFooter className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <Button type="button" variant="outline" className="border-gray-200 hover:bg-gray-50 text-gray-700" onClick={() => { setBillFor(null); setDraft(null) }}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-green-600 font-semibold text-white shadow-xs hover:bg-green-700">
                  {draft.has_pdf ? "Update bill" : "Create bill"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
