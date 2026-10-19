import { useEffect, useState, type FormEvent } from "react"
import {
  CheckCircle2,
  PlusCircle,
  ShoppingCart,
  Truck,
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
import { canSeePrices } from "@/lib/access"
import { api, errorMessage, type Page, uploadFile } from "@/lib/api"
import { cn } from "@/lib/utils"

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
  const [showCreate, setShowCreate] = useState(false)
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
      setShowCreate(false)
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
    <div className="space-y-6">
      <PageTitle
        title="Purchase Orders & Shipments"
        hint={
          staff
            ? "Incoming delivery trucks scheduled for gate entry. Verify plate numbers before admitting stock."
            : "Procure raw coil and finished components. Log vehicle arrival and upload weighment/tax receipts."
        }
        icon={ShoppingCart}
        badge={`${orders.length} Shipments`}
        action={
          can("manage_purchasing") ? (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  Create Purchase Order
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ShoppingCart className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-slate-100">New Purchase Order</DialogTitle>
                  </div>
                </DialogHeader>
                <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                  <div className="sm:col-span-2">
                    <SearchSelect
                      label="Supplier Company"
                      options={suppliers}
                      value={form.supplier_id}
                      onChange={(supplier_id) => setForm({ ...form, supplier_id })}
                      required
                    />
                  </div>
                  <Field label="Item Classification" required>
                    <select
                      className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm font-medium text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      value={form.kind}
                      onChange={(event) => setForm({ ...form, kind: event.target.value, item_id: "" })}
                    >
                      <option value="material">Raw Material (Sheet / Coil)</option>
                      <option value="product">Finished Product / Part</option>
                    </select>
                  </Field>
                  <SearchSelect
                    label="Select Item"
                    options={form.kind === "product" ? products : materials}
                    value={form.item_id}
                    onChange={(item_id) => setForm({ ...form, item_id })}
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
                  {prices ? (
                    <Field label="Negotiated Unit Price (₹)">
                      <Input
                        value={form.unit_price}
                        onChange={(event) => setForm({ ...form, unit_price: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  <Field label="Expected Truck Plate">
                    <Input
                      placeholder="e.g. MH-12-AB-1234"
                      value={form.expected_vehicle_plate}
                      onChange={(event) => setForm({ ...form, expected_vehicle_plate: event.target.value })}
                    />
                  </Field>
                  <Field label="Fulfill Open Request">
                    <select
                      className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      value={form.request_id}
                      onChange={(event) => setForm({ ...form, request_id: event.target.value })}
                    >
                      <option value="">Direct Order (No request)</option>
                      {requests.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.source} · Qty {request.quantity}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-[#262e3f] pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                    >
                      Place Purchase Order
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* Orders List */}
      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2b3447] bg-[#1a1f2b]/60 p-10 text-center">
            <Truck className="mx-auto size-10 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-200">No Purchase Orders Recorded</p>
            <p className="text-xs text-slate-400">Incoming shipments and placed purchase orders will appear here.</p>
          </div>
        ) : (
          orders.map((order) => {
            const hasMismatch =
              order.expected_vehicle_plate &&
              order.arrived_vehicle_plate &&
              order.expected_vehicle_plate.trim().toUpperCase() !== order.arrived_vehicle_plate.trim().toUpperCase()

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg text-slate-200 transition-all hover:border-[#323d54]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#262e3f] pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Truck className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">
                        {staff ? "Incoming Material Shipment" : (order.supplier_name ?? "General Supplier")}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-[#151924] border border-[#2b3447] px-2 py-0.5 font-medium text-slate-300">
                          Expected: {order.expected_vehicle_plate || "Not specified"}
                        </span>
                        {order.arrived_vehicle_plate ? (
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 font-semibold",
                              hasMismatch
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
                            )}
                          >
                            Arrived: {order.arrived_vehicle_plate}
                            {hasMismatch ? " (Mismatch)" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Items in this order */}
                <div className="my-3 flex flex-wrap gap-2 text-xs">
                  {order.lines.map((line, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#262e3f] bg-[#161a25] px-3 py-1 font-medium text-slate-300"
                    >
                      <span>Ordered Qty: <strong className="text-slate-100">{line.quantity}</strong></span>
                      {prices && line.unit_price ? (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-emerald-400 font-semibold">@ ₹{line.unit_price}/unit</span>
                        </>
                      ) : null}
                    </span>
                  ))}
                </div>

                {/* Mark Arrived Form */}
                {can("manage_purchasing") && order.status === "ordered" ? (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[#262e3f] bg-[#161a25] p-3"
                    onSubmit={(event) => void arrive(order, event)}
                  >
                    <div className="flex-1 min-w-44">
                      <Field label="Arrived Vehicle Number Plate" required>
                        <Input
                          name="plate"
                          placeholder="e.g. MH-12-AB-1234"
                          defaultValue={order.expected_vehicle_plate || ""}
                          required
                        />
                      </Field>
                    </div>
                    <div className="flex-1 min-w-44">
                      <Field label="Receipt / Challan Upload">
                        <Input name="receipt" type="file" accept="image/*,.pdf" />
                      </Field>
                    </div>
                    <Button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                    >
                      <Truck className="mr-1.5 size-4" />
                      Mark Vehicle Arrived
                    </Button>
                  </form>
                ) : null}

                {/* Verification Form */}
                {can("manage_purchasing") && order.status === "arrived" ? (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const note = new FormData(event.currentTarget).get("note")
                      void api(`/api/purchase-orders/${order.id}/verify`, {
                        method: "POST",
                        body: JSON.stringify({ plate_mismatch_note: note ? String(note) : null }),
                      })
                        .then(load)
                        .catch((caught) => setError(errorMessage(caught)))
                    }}
                  >
                    <div className="flex-1 min-w-56">
                      <Field label="Gate Verification Note (if vehicle differs or damaged)">
                        <Input name="note" placeholder="Weighment match confirmed, gate verified" />
                      </Field>
                    </div>
                    <Button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
                    >
                      <CheckCircle2 className="mr-1.5 size-4" />
                      Verify Shipment & Credit Stock
                    </Button>
                  </form>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
