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
    const [orderRows, customerPage, productPage, userPage] = await Promise.all([
      api<Order[]>("/api/sales/orders"),
      api<Page<Customer>>("/api/customers/?page=1&page_size=100"),
      api<Page<Product>>("/api/products?page=1&page_size=100"),
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
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  const selectedType = products.find((item) => item.id === form.product_id)?.type

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
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
  }

  async function showInvoice(order: Order) {
    if (!order.invoice_id) return
    setInvoice(await api<Invoice>(`/api/invoices/${order.invoice_id}`))
  }

  async function pay(event: FormEvent) {
    event.preventDefault()
    if (!invoice) return
    setError("")
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
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
              >
                <PlusCircle className="mr-1.5 size-4" />
                New Sales Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Receipt className="size-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-slate-100">Create Customer Sales Order</DialogTitle>
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
                      className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
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

                <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-[#262e3f] pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
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
      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2b3447] bg-[#1a1f2b]/60 p-10 text-center">
            <Receipt className="mx-auto size-10 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-200">No Sales Orders Found</p>
            <p className="text-xs text-slate-400">Created customer orders and GST invoices will be listed here.</p>
          </div>
        ) : (
          orders.map((order) => {
            const isDispatched = order.status === "dispatched"
            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg text-slate-200 transition-all hover:border-[#323d54]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#262e3f] pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <PackageCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{order.customer_name ?? "Direct Walk-in"}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        {prices ? (
                          <span className="font-semibold text-slate-300">
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
                      className="rounded-xl border-[#2b3447] bg-[#151924] text-xs font-semibold text-slate-200 hover:bg-[#202737] hover:text-slate-100"
                      onClick={() => void showInvoice(order)}
                    >
                      <FileText className="mr-1 size-3.5 text-blue-400" />
                      GST Invoice
                    </Button>
                    {!isDispatched ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#262e3f] bg-[#161a25] p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{line.product_name ?? "Steel Product"}</span>
                        {line.shortfall_choice ? (
                          <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                            Shortfall: {line.shortfall_choice}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-slate-300">
                        <span>Ordered: <strong className="text-slate-100">{line.quantity}</strong></span>
                        <span>Held: <strong className="text-blue-400">{line.held_quantity ?? line.quantity}</strong></span>
                        {prices && line.unit_price ? (
                          <span className="font-semibold text-emerald-400">@ ₹{line.unit_price}</span>
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

      {/* GST Tax Invoice Viewer */}
      {invoice ? (
        <section
          className="rounded-3xl border border-[#262e3f] bg-[#1a1f2b] p-6 shadow-xl text-slate-200 print:m-0 print:border-0 print:p-0 print:bg-white print:text-slate-900"
          id="invoice"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262e3f] pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400">
                <span>TAX INVOICE</span>
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-100">{invoice.number}</h2>
              <p className="text-xs text-slate-400">
                GST Regime: <strong className="text-slate-200">{invoice.same_state ? "Intrastate (CGST + SGST)" : "Interstate (IGST)"}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl print:hidden text-xs font-semibold border-[#2b3447] bg-[#151924] text-slate-200 hover:bg-[#202737]"
                onClick={() => window.print()}
              >
                <Printer className="mr-1.5 size-4" />
                Print Tax Invoice
              </Button>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="my-5 overflow-hidden rounded-xl border border-[#262e3f] bg-[#161a25]">
            <Table>
              <TableHeader>
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
                    <TableCell className="font-semibold text-slate-100">{line.description}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{line.hsn_code || "–"}</TableCell>
                    <TableCell className="text-right font-medium text-slate-200">{line.quantity}</TableCell>
                    <TableCell className="text-right font-medium text-slate-200">₹{line.unit_price}</TableCell>
                    <TableCell className="text-right font-bold text-slate-100">₹{line.taxable_amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tax Breakdown & Totals */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#262e3f]">
            <div className="space-y-1.5 rounded-2xl bg-[#161a25] border border-[#262e3f] p-4 text-xs text-slate-300">
              <p className="font-bold uppercase tracking-wider text-slate-400 mb-2">Tax Breakdown</p>
              <div className="flex justify-between">
                <span>Taxable Total:</span>
                <span className="font-semibold text-slate-100">₹{invoice.taxable_amount}</span>
              </div>
              {invoice.same_state ? (
                <>
                  <div className="flex justify-between text-blue-400">
                    <span>Central GST (CGST):</span>
                    <span className="font-semibold">₹{invoice.cgst_amount}</span>
                  </div>
                  <div className="flex justify-between text-blue-400">
                    <span>State GST (SGST):</span>
                    <span className="font-semibold">₹{invoice.sgst_amount}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-indigo-400">
                  <span>Integrated GST (IGST):</span>
                  <span className="font-semibold">₹{invoice.igst_amount}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 pt-1 border-t border-[#262e3f]">
                <span>Delivery Freight (exempt):</span>
                <span>₹{invoice.delivery_charge}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#182030] to-[#1c263c] border border-[#2b374f] p-5 text-slate-100">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Total Invoice Amount</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-slate-100">₹{invoice.total_amount}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-slate-300">Amount Paid: ₹{invoice.amount_paid}</span>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 font-bold text-emerald-400">
                  Balance: ₹{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Record Payment Form */}
          <div className="mt-6 rounded-2xl border border-[#262e3f] bg-[#161a25] p-4 print:hidden">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
              Record Customer Payment
            </p>
            <form className="grid gap-3 sm:grid-cols-4" onSubmit={(event) => void pay(event)}>
              <Input
                placeholder="Payment Amount (₹)"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
                required
              />
              <select
                className="h-9 rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm font-medium text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                value={payment.method}
                onChange={(event) => setPayment({ ...payment, method: event.target.value })}
              >
                <option value="cash">Cash Payment</option>
                <option value="online">Online / NEFT / UPI</option>
              </select>
              <Input type="file" accept="image/*,.pdf" className="text-xs" />
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
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
