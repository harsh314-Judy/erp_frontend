import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canSeePrices } from "@/lib/access"
import { api, errorMessage, type Page, uploadFile } from "@/lib/api"

type Option = { id: string; label: string }
type Supplier = { id: string; supplier_company_name: string }
type Material = { id: string; name: string }
type Product = { id: string; product_name: string }
type Line = { product_id: string | null; raw_material_id: string | null; quantity: string; unit_price: string | null }
type Order = {
  id: string
  supplier_name: string | null
  status: string
  expected_vehicle_plate: string | null
  arrived_vehicle_plate: string | null
  lines: Line[]
}
type RequestRow = { id: string; product_id: string | null; raw_material_id: string | null; quantity: string; source: string }

export function PurchasesPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const staff = user?.role_name === "staff"
  const [orders, setOrders] = useState<Order[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [materials, setMaterials] = useState<Option[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    supplier_id: "",
    kind: "material",
    item_id: "",
    quantity: "1",
    unit_price: "0",
    expected_vehicle_plate: "",
    request_id: "",
  })

  async function load() {
    const orderRows = await api<Order[]>("/api/purchase-orders")
    setOrders(orderRows)
    if (!can("manage_purchasing")) return
    const [requestRows, supplierPage, materialPage, productPage] = await Promise.all([
      api<RequestRow[]>("/api/purchase-requests"),
      api<Page<Supplier>>("/api/suppliers?page=1&page_size=100"),
      api<Page<Material>>("/api/raw-materials/?page=1&page_size=100"),
      api<Page<Product>>("/api/products?page=1&page_size=100"),
    ])
    setRequests(requestRows)
    const supplierOptions = supplierPage.items.map((item) => ({ id: item.id, label: item.supplier_company_name }))
    setSuppliers(supplierOptions)
    setMaterials(materialPage.items.map((item) => ({ id: item.id, label: item.name })))
    setProducts(productPage.items.map((item) => ({ id: item.id, label: item.product_name })))
    setForm((current) => ({ ...current, supplier_id: current.supplier_id || supplierOptions[0]?.id || "" }))
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: form.supplier_id,
          expected_vehicle_plate: form.expected_vehicle_plate || null,
          request_ids: form.request_id ? [form.request_id] : [],
          lines: [
            {
              product_id: form.kind === "product" ? form.item_id : null,
              raw_material_id: form.kind === "material" ? form.item_id : null,
              quantity: form.quantity,
              unit_price: form.unit_price,
            },
          ],
        }),
      })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function arrive(order: Order, event: FormEvent) {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    setError("")
    try {
      const file = data.get("receipt")
      const attachment = file instanceof File && file.size ? await uploadFile(file) : null
      await api(`/api/purchase-orders/${order.id}/arrived`, {
        method: "POST",
        body: JSON.stringify({
          arrived_vehicle_plate: String(data.get("plate") || ""),
          receipt_attachment_id: attachment?.id ?? null,
        }),
      })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle
        title="Purchase orders"
        hint={staff ? "Incoming shipments show the item, quantity, and vehicle plate." : "Record the vehicle plate and receipt, then verify to add stock."}
      />
      {error ? <Notice>{error}</Notice> : null}
      {can("manage_purchasing") ? (
        <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void create(event)}>
          <SearchSelect label="Supplier" options={suppliers} value={form.supplier_id} onChange={(supplier_id) => setForm({ ...form, supplier_id })} />
          <Field label="Line type">
            <select className="h-8 rounded-lg border px-2 text-sm" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, item_id: "" })}>
              <option value="material">Raw material</option>
              <option value="product">Product</option>
            </select>
          </Field>
          <SearchSelect label="Item" options={form.kind === "product" ? products : materials} value={form.item_id} onChange={(item_id) => setForm({ ...form, item_id })} />
          <Field label="Quantity"><Input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
          {prices ? <Field label="Unit price"><Input value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></Field> : null}
          <Field label="Expected plate"><Input value={form.expected_vehicle_plate} onChange={(event) => setForm({ ...form, expected_vehicle_plate: event.target.value })} /></Field>
          <Field label="Open request">
            <select className="h-8 rounded-lg border px-2 text-sm" value={form.request_id} onChange={(event) => setForm({ ...form, request_id: event.target.value })}>
              <option value="">None</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>{request.source} · {request.quantity}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end"><Button type="submit">Place order</Button></div>
        </form>
      ) : null}
      <div className="grid gap-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium">{staff ? "Incoming shipment" : order.supplier_name}</p>
            <p className="text-sm text-muted-foreground">
              {order.status} · expected {order.expected_vehicle_plate || "–"} · arrived {order.arrived_vehicle_plate || "–"}
            </p>
            <ul className="mt-2 text-sm">
              {order.lines.map((line, index) => (
                <li key={index}>
                  Qty {line.quantity}
                  {prices && line.unit_price ? ` @ ${line.unit_price}` : ""}
                </li>
              ))}
            </ul>
            {can("manage_purchasing") && order.status === "ordered" ? (
              <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => void arrive(order, event)}>
                <Field label="Arrived plate"><Input name="plate" required /></Field>
                <Field label="Receipt"><Input name="receipt" type="file" accept="image/*,.pdf" /></Field>
                <Button type="submit">Mark arrived</Button>
              </form>
            ) : null}
            {can("manage_purchasing") && order.status === "arrived" ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const note = new FormData(event.currentTarget).get("note")
                  void api(`/api/purchase-orders/${order.id}/verify`, {
                    method: "POST",
                    body: JSON.stringify({ plate_mismatch_note: note ? String(note) : null }),
                  }).then(load).catch((caught) => setError(errorMessage(caught)))
                }}
              >
                <Field label="Plate note if it differs"><Input name="note" /></Field>
                <Button type="submit">Verify and add stock</Button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
