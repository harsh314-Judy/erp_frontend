import { useEffect, useState, type FormEvent } from "react"
import {
  CreditCard,
  FileText,
  PackageCheck,
  PlusCircle,
  Printer,
  Receipt,
  Send,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { canSeePrices } from "@/lib/access"
import { api, errorMessage, type Page, uploadFile } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

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
  lines: Line[]
}
type Invoice = {
  id: string
  number: string
  status: string
  same_state: boolean
  taxable_amount: string
  cgst_amount: string
  sgst_amount: string
  igst_amount: string
  delivery_charge: string
  total_amount: string
  amount_paid: string
  lines: { description: string; hsn_code: string; quantity: string; unit_price: string; taxable_amount: string }[]
}

export function SalesPage() {
  const { user } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Option[]>([])
  const [products, setProducts] = useState<(Option & { type: string })[]>([])
  const [people, setPeople] = useState<Option[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "1",
    shortfall_choice: "",
    packaging_user_id: "",
    notes: "",
  })
  const [payment, setPayment] = useState({ amount: "", method: "cash", note: "" })

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

  const selectedType = products.find((item) => item.id === form.product_id)?.type

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    await guard(async () => {
    try {
      await api("/api/sales/orders", {
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
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  async function showInvoice(order: Order) {
    if (!order.invoice_id) return
    setInvoice(await api<Invoice>(`/api/invoices/${order.invoice_id}`))
  }

  async function pay(event: FormEvent) {
    event.preventDefault()
    if (!invoice) return
    setError("")
    await guard(async () => {
    try {
      const file = (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>("input[type=file]")?.files?.[0]
      const attachment = file ? await uploadFile(file) : null
      const next = await api<Invoice>(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: payment.amount,
          method: payment.method,
          note: payment.note || null,
          attachment_id: attachment?.id ?? null,
        }),
      })
      setInvoice(next)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sales & Dispatch Orders"
        hint="Available plant inventory is reserved immediately. Shortfalls auto-trigger manufacturing jobs or purchase requests."
        icon={Receipt}
        badge={`${orders.length} Orders`}
        action={
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
              <FormBusy show={busy} />
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
                    disabled={busy}
                    className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs"
                  >
                    Confirm & Reserve Stock
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
            <p className="text-xs text-gray-500">Created customer orders and GST invoices will be listed here.</p>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={() => void showInvoice(order)}
                    >
                      <FileText className="mr-1 size-3.5 text-blue-600" />
                      GST Invoice
                    </Button>
                    {!isDispatched ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-xs font-semibold text-white shadow-xs"
                        onClick={() =>
                          void api(`/api/sales/orders/${order.id}/dispatch`, { method: "POST" })
                            .then(load)
                            .catch((caught) => setError(errorMessage(caught)))
                        }
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

      {/* GST Tax Invoice Viewer */}
      {invoice ? (
        <section
          className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs text-gray-800 print:m-0 print:border-0 print:p-0 print:bg-white print:text-gray-900"
          id="invoice"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-bold text-green-700">
                <span>TAX INVOICE</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{invoice.number}</h2>
              <p className="text-xs text-gray-500">
                GST Regime: <strong className="text-gray-800">{invoice.same_state ? "Intrastate (CGST + SGST)" : "Interstate (IGST)"}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl print:hidden text-xs font-semibold border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => window.print()}
              >
                <Printer className="mr-1.5 size-4" />
                Print Tax Invoice
              </Button>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="my-5 overflow-hidden rounded-xl border border-gray-200/90 bg-white">
            <Table>
              <TableHeader className="bg-gray-50/75">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-gray-900">{line.description}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{line.hsn_code || "–"}</TableCell>
                    <TableCell className="text-right font-medium text-gray-700">{line.quantity}</TableCell>
                    <TableCell className="text-right font-medium text-gray-700">₹{line.unit_price}</TableCell>
                    <TableCell className="text-right font-bold text-gray-900">₹{line.taxable_amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tax Breakdown & Totals */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
            <div className="space-y-1.5 rounded-xl bg-gray-50/80 border border-gray-200/90 p-4 text-xs text-gray-600">
              <p className="font-bold uppercase tracking-wider text-gray-500 mb-2">Tax Breakdown</p>
              <div className="flex justify-between">
                <span>Taxable Total:</span>
                <span className="font-semibold text-gray-900">₹{invoice.taxable_amount}</span>
              </div>
              {invoice.same_state ? (
                <>
                  <div className="flex justify-between text-blue-600">
                    <span>Central GST (CGST):</span>
                    <span className="font-semibold">₹{invoice.cgst_amount}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>State GST (SGST):</span>
                    <span className="font-semibold">₹{invoice.sgst_amount}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-indigo-600">
                  <span>Integrated GST (IGST):</span>
                  <span className="font-semibold">₹{invoice.igst_amount}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 pt-1 border-t border-gray-200">
                <span>Delivery Freight (exempt):</span>
                <span>₹{invoice.delivery_charge}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-gray-900 border border-gray-800 p-5 text-white shadow-xs">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400">Total Invoice Amount</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-white">₹{invoice.total_amount}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
                <span className="text-gray-300">Amount Paid: ₹{invoice.amount_paid}</span>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">
                  Balance: ₹{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Record Payment Form */}
          <div className="mt-6 rounded-xl border border-gray-200/90 bg-gray-50/80 p-4 print:hidden">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-700">
              Record Customer Payment
            </p>
            <form className="grid gap-3 sm:grid-cols-4" onSubmit={(event) => void pay(event)}>
              <Input
                placeholder="Payment Amount (₹)"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
                required
                className="bg-white border-gray-200"
              />
              <select
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-2xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                value={payment.method}
                onChange={(event) => setPayment({ ...payment, method: event.target.value })}
              >
                <option value="cash">Cash Payment</option>
                <option value="online">Online / NEFT / UPI</option>
              </select>
              <Input type="file" accept="image/*,.pdf" className="text-xs bg-white border-gray-200" />
              <Button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs"
              >
                <CreditCard className="mr-1.5 size-4" />
                Record Payment
              </Button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
