import { useEffect, useState, type FormEvent } from "react"
import {
  Download,
  FileText,
  PackageCheck,
  PlusCircle,
  Receipt,
  Send,
  Trash2,
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
  invoice_id: string | null
  invoice_has_pdf: boolean
  lines: Line[]
}
type DraftLine = {
  line_id: string
  product_name: string
  quantity: string
  unit: string
  mrp: string
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

export function SalesPage() {
  const { user } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [orders, setOrders] = useState<Order[]>(() => peek<Order[]>("/api/sales/orders") ?? [])
  const [customers, setCustomers] = useState<Option[]>([])
  const [products, setProducts] = useState<(Option & { type: string })[]>([])
  const [people, setPeople] = useState<Option[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(() => peek<Order[]>("/api/sales/orders") === undefined)
  const [showCreate, setShowCreate] = useState(false)
  const [billFor, setBillFor] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rates, setRates] = useState<Record<string, Rate>>({})
  const [form, setForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "1",
    shortfall_choice: "",
    packaging_user_id: "",
    notes: "",
  })

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
      product_id: current.product_id || productOptions[0]?.id || "",
      packaging_user_id: current.packaging_user_id || peopleOptions[0]?.id || "",
    }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])
  useRefreshWhenShown("/sales", load, (caught) => setError(errorMessage(caught)))

  const selectedType = products.find((item) => item.id === form.product_id)?.type

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    const tempId = crypto.randomUUID()
    const optimistic: Order = {
      id: tempId,
      customer_name: customers.find((item) => item.id === form.customer_id)?.label ?? null,
      status: "open",
      delivery_charge: "0",
      packaging_user_id: form.packaging_user_id || null,
      invoice_id: null,
      invoice_has_pdf: false,
      lines: [
        {
          product_id: form.product_id,
          product_name: products.find((item) => item.id === form.product_id)?.label ?? null,
          quantity: form.quantity,
        },
      ],
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
          lines: [
            {
              product_id: form.product_id,
              quantity: form.quantity,
              shortfall_choice: selectedType === "both" ? form.shortfall_choice || "make" : null,
            },
          ],
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
  const doneCount = orders.filter((order) => order.status === "dispatched").length

  async function deleteDone() {
    if (!window.confirm(`Delete all ${doneCount} dispatched orders and their invoices? This cannot be undone.`)) return
    setError("")
    const previous = orders
    setOrders((current) => current.filter((order) => order.status !== "dispatched"))
    try {
      await api("/api/sales/orders/dispatched", { method: "DELETE" })
    } catch (caught) {
      setOrders(previous)
      setError(errorMessage(caught))
    }
  }

  async function dispatch(order: Order) {
    setError("")
    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: "dispatched" } : item)))
    try {
      const next = await api<Order>(`/api/sales/orders/${order.id}/dispatch`, { method: "POST" })
      setOrders((current) => current.map((item) => (item.id === next.id ? next : item)))
    } catch (caught) {
      setOrders((current) => current.map((item) => (item.id === order.id ? order : item)))
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sales & Dispatch Orders"
        hint="Available plant inventory is reserved immediately. Shortfalls auto-trigger manufacturing jobs or purchase requests."
        icon={Receipt}
        badge={`${orders.length} Orders`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {doneCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => void deleteDone()}
              >
                <Trash2 className="mr-1.5 size-4" />
                Delete done orders
              </Button>
            ) : null}
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
                  <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                    <Receipt className="size-5" />
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
                  label="Product"
                  options={products}
                  value={form.product_id}
                  onChange={(product_id) => setForm({ ...form, product_id })}
                  required
                />
                <Field label="Order Quantity" required>
                  <Input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  />
                </Field>

                {selectedType === "both" ? (
                  <Field label="If Stock is Short">
                    <select
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-2xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                      value={form.shortfall_choice}
                      onChange={(event) => setForm({ ...form, shortfall_choice: event.target.value })}
                    >
                      <option value="make">Make it (Launch Production Job)</option>
                      <option value="buy">Buy it (Create Purchase Request)</option>
                    </select>
                  </Field>
                ) : null}

                <SearchSelect
                  label="Packaging Staff Assigned"
                  options={people}
                  value={form.packaging_user_id}
                  onChange={(packaging_user_id) => setForm({ ...form, packaging_user_id })}
                />
                <Field label="Order Instructions">
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

      {/* Orders Grid */}
      {loading ? (
        <PageLoading label="Loading sales orders" variant="cards" count={3} />
      ) : (
        <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-xs">
            <Receipt className="mx-auto size-10 text-gray-400" />
            <p className="mt-2 text-sm font-semibold text-gray-800">No Sales Orders Found</p>
            <p className="text-xs text-gray-500">Dispatch an order, then raise its invoice from here.</p>
          </div>
        ) : (
          orders.map((order) => {
            const isDispatched = order.status === "dispatched"
            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs text-gray-800 transition-all hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                      <PackageCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{order.customer_name ?? "Direct Walk-in"}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {prices ? (
                          <span className="font-semibold text-gray-700">
                            Delivery: ₹{order.delivery_charge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={order.status} />
                    {isDispatched && order.invoice_has_pdf && order.invoice_id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() =>
                          void downloadFile(`/api/invoices/${order.invoice_id}/pdf`, "invoice.pdf").catch((caught) =>
                            setError(errorMessage(caught)),
                          )
                        }
                      >
                        <Download className="mr-1 size-3.5 text-green-700" />
                        Download PDF
                      </Button>
                    ) : null}
                    {isDispatched && !order.invoice_has_pdf ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => void openInvoice(order)}
                      >
                        <FileText className="mr-1 size-3.5 text-blue-600" />
                        Invoice
                      </Button>
                    ) : null}
                    {!isDispatched ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-xs font-semibold text-white shadow-xs"
                        onClick={() => void dispatch(order)}
                      >
                        <Send className="mr-1 size-3.5" />
                        Dispatch Order
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Line Items */}
                <div className="mt-3 space-y-1.5 text-xs">
                  {order.lines.map((line) => (
                    <div
                      key={line.product_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{line.product_name ?? "Steel Product"}</span>
                        {line.shortfall_choice ? (
                          <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                            Shortfall: {line.shortfall_choice}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <span>Ordered: <strong className="text-gray-900">{line.quantity}</strong></span>
                        <span>Held: <strong className="text-blue-600">{line.held_quantity ?? line.quantity}</strong></span>
                        {prices && line.unit_price ? (
                          <span className="font-semibold text-green-700">@ ₹{line.unit_price}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )
          })
        )}
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
                    <Field label="MRP (₹)" required>
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
                <Button type="submit" className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs">
                  Create bill
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
