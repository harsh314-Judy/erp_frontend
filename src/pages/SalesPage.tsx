import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    <div>
      <PageTitle title="Sales" hint="Free stock is held. A shortfall starts a production job or a purchase request, then a GST invoice." />
      {error ? <Notice>{error}</Notice> : null}
      <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void create(event)}>
        <SearchSelect label="Customer" options={customers} value={form.customer_id} onChange={(customer_id) => setForm({ ...form, customer_id })} />
        <SearchSelect label="Product" options={products} value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
        <Field label="Quantity"><Input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        {selectedType === "both" ? (
          <Field label="If stock is short">
            <select className="h-8 rounded-lg border px-2 text-sm" value={form.shortfall_choice} onChange={(event) => setForm({ ...form, shortfall_choice: event.target.value })}>
              <option value="make">Make it</option>
              <option value="buy">Buy it</option>
            </select>
          </Field>
        ) : null}
        <SearchSelect label="Packaging person" options={people} value={form.packaging_user_id} onChange={(packaging_user_id) => setForm({ ...form, packaging_user_id })} />
        <Field label="Notes"><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <div className="flex items-end"><Button type="submit">Create order</Button></div>
      </form>
      <div className="grid gap-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground">{order.status}{prices ? ` · delivery ${order.delivery_charge}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void showInvoice(order)}>Invoice</Button>
                {order.status !== "dispatched" ? (
                  <Button type="button" onClick={() => void api(`/api/sales/orders/${order.id}/dispatch`, { method: "POST" }).then(load).catch((caught) => setError(errorMessage(caught)))}>
                    Dispatch
                  </Button>
                ) : null}
              </div>
            </div>
            <ul className="mt-2 text-sm">
              {order.lines.map((line) => (
                <li key={line.product_id}>
                  {line.product_name}: {line.quantity} held {line.held_quantity}
                  {prices && line.unit_price ? ` @ ${line.unit_price}` : ""}
                  {line.shortfall_choice ? ` · shortfall ${line.shortfall_choice}` : ""}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {invoice ? (
        <section className="mt-6 rounded-xl border bg-white p-4 print:border-0" id="invoice">
          <h2 className="text-lg font-semibold">{invoice.number}</h2>
          <p className="text-sm text-muted-foreground">{invoice.same_state ? "CGST + SGST" : "IGST"} · {invoice.status}</p>
          <ul className="my-3 text-sm">
            {invoice.lines.map((line) => (
              <li key={line.description}>{line.description} · HSN {line.hsn_code || "–"} · {line.quantity} × {line.unit_price}</li>
            ))}
          </ul>
          <p className="text-sm">Taxable {invoice.taxable_amount} · CGST {invoice.cgst_amount} · SGST {invoice.sgst_amount} · IGST {invoice.igst_amount}</p>
          <p className="text-sm">Delivery {invoice.delivery_charge} (not taxed) · Total {invoice.total_amount} · Paid {invoice.amount_paid}</p>
          <form className="mt-3 grid gap-2 md:grid-cols-4 print:hidden" onSubmit={(event) => void pay(event)}>
            <Input placeholder="Amount" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} />
            <select className="h-8 rounded-lg border px-2 text-sm" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            <Input type="file" accept="image/*,.pdf" />
            <Button type="submit">Record payment</Button>
          </form>
          <Button type="button" className="mt-3 print:hidden" variant="outline" onClick={() => window.print()}>Print</Button>
        </section>
      ) : null}
    </div>
  )
}
