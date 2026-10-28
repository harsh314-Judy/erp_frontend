import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Building2,
  CheckCircle2,
  FileText,
  Package,
  Pencil,
  PlusCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
  XCircle,
  Zap,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { CardListSkeleton, FormBusy, StatGridSkeleton } from "@/components/PlantLoader"
import { CategoryManager, Field, Notice, PageTitle, SearchSelect, StatusBadge } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { canSeePrices } from "@/lib/access"
import { api, errorMessage, peek, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { useRefreshWhenShown } from "@/lib/visible"
import { cn } from "@/lib/utils"

type Named = { id: string; name: string }
type Option = { id: string; label: string }
type Supplier = {
  id: string
  supplier_company_name: string
  supply_kind: string
  raw_material_ids?: string[]
  product_ids?: string[]
}
type Material = { id: string; name: string; category_id: string | null }
type Product = { id: string; product_name: string; category_id: string }
type Line = {
  id?: string
  item_name?: string | null
  product_id: string | null
  raw_material_id: string | null
  quantity: string
  unit_price: string | null
}
type Order = {
  id: string
  supplier_id: string | null
  supplier_name: string | null
  status: string
  notes: string | null
  stock_received: boolean
  expected_vehicle_plate: string | null
  lines: Line[]
}
type DraftLine = {
  key: string
  kind: "material" | "product"
  category_id: string
  item_id: string
  quantity: string
  unit_price: string
}

const STATUSES = [
  { id: "initiated", label: "Initiated", desc: "PO logged, awaiting vendor processing" },
  { id: "process", label: "In Process", desc: "Supplier is packaging / fabricating items" },
  { id: "in_delivery", label: "In Delivery", desc: "Dispatched from supplier, en route to plant" },
  { id: "delivered", label: "Delivered", desc: "Received at gate & auto-added to stock inventory" },
  { id: "cancelled", label: "Cancelled", desc: "Order voided. Stock will not be credited." },
]

function OrderFlow({ status, compact = false }: { status: string; compact?: boolean }) {
  const steps = STATUSES.filter((step) => step.id !== "cancelled")
  const current = steps.findIndex((step) => step.id === status)
  const cancelled = status === "cancelled"
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", compact ? "py-1" : "border-b border-gray-100 bg-white px-5 py-2")}>
      {cancelled ? (
        <li className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">Cancelled</li>
      ) : null}
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

const selectClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

const emptySupplier = {
  supplier_company_name: "",
  contact_person_name: "",
  phone: "",
  email: "",
  address: "",
  supply_kind: "materials",
}

function blankLine(kind: DraftLine["kind"] = "material"): DraftLine {
  return { key: crypto.randomUUID(), kind, category_id: "", item_id: "", quantity: "1", unit_price: "0" }
}

export function PurchasesPage() {
  const { user, can } = useAuth()
  const [searchParams] = useSearchParams()
  const prices = canSeePrices(user?.role_name)
  const staff = user?.role_name === "staff"
  const { busy, guard } = useFormBusy()

  const [loading, setLoading] = useState(() => peek<Order[]>("/api/purchase-orders") === undefined)
  const [orders, setOrders] = useState<Order[]>(() => peek<Order[]>("/api/purchase-orders") ?? [])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [materialCategories, setMaterialCategories] = useState<Named[]>([])
  const [productCategories, setProductCategories] = useState<Named[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [error, setError] = useState("")

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Create / Edit modal
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [panel, setPanel] = useState<"supplier" | "material" | "product" | null>(null)
  const [supplierForm, setSupplierForm] = useState(emptySupplier)
  const [draftMaterial, setDraftMaterial] = useState({ name: "", category_id: "", measurement_unit_id: "" })
  const [draftProduct, setDraftProduct] = useState({ product_name: "", sku_number: "", category_id: "", measurement_unit_id: "" })
  const [header, setHeader] = useState({
    supplier_id: "",
    expected_vehicle_plate: "",
    status: "initiated",
    notes: "",
  })
  const [lines, setLines] = useState<DraftLine[]>([blankLine()])

  // Quick update modal
  const [quickOrder, setQuickOrder] = useState<Order | null>(null)
  const [quickForm, setQuickForm] = useState({ status: "initiated", expected_vehicle_plate: "" })
  const [quickSaving, setQuickSaving] = useState(false)

  async function load() {
    try {
      const orderRows = await api<Order[]>("/api/purchase-orders")
      setOrders(orderRows)
      if (!can("manage_purchasing")) return
      const [supplierPage, materialPage, productPage, materialCategoryPage, productCategoryPage, unitPage] = await Promise.all([
        api<Page<Supplier>>("/api/suppliers?page=1&page_size=500"),
        api<Page<Material>>("/api/raw-materials/?page=1&page_size=500&brief=true"),
        api<Page<Product>>("/api/products?page=1&page_size=500&brief=true"),
        api<Page<Named>>("/api/raw-materials/categories?page=1&page_size=100"),
        api<Page<Named>>("/api/product-categories?page=1&page_size=100"),
        api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
      ])
      setSuppliers(supplierPage.items)
      setMaterials(materialPage.items)
      setProducts(productPage.items)
      setMaterialCategories(materialCategoryPage.items)
      setProductCategories(productCategoryPage.items)
      setUnits(unitPage.items)
      setDraftMaterial((current) => ({
        ...current,
        category_id: current.category_id || materialCategoryPage.items[0]?.id || "",
        measurement_unit_id: current.measurement_unit_id || unitPage.items[0]?.id || "",
      }))
      setDraftProduct((current) => ({
        ...current,
        category_id: current.category_id || productCategoryPage.items[0]?.id || "",
        measurement_unit_id: current.measurement_unit_id || unitPage.items[0]?.id || "",
      }))
      setHeader((current) => ({ ...current, supplier_id: current.supplier_id || supplierPage.items[0]?.id || "" }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])
  useRefreshWhenShown("/purchases", load, (caught) => setError(errorMessage(caught)))

  const openedDraft = useRef(false)
  useEffect(() => {
    if (openedDraft.current || loading) return
    const kind = searchParams.get("draft")
    const item = searchParams.get("item")
    if ((kind !== "material" && kind !== "product") || !item) return
    openedDraft.current = true
    const supplier = suppliers.find((row) => {
      if (kind === "material" && row.supply_kind === "products") return false
      if (kind === "product" && row.supply_kind === "materials") return false
      const allowed = kind === "material" ? row.raw_material_ids : row.product_ids
      return !allowed?.length || allowed.includes(item)
    })
    setEditing(null)
    setHeader({
      supplier_id: supplier?.id || suppliers[0]?.id || "",
      expected_vehicle_plate: "",
      status: "initiated",
      notes: "",
    })
    setLines([{ ...blankLine(kind), item_id: item }])
    setShowCreate(true)
  }, [loading, searchParams, suppliers])

  const currentSupplier = useMemo(
    () => suppliers.find((item) => item.id === header.supplier_id),
    [suppliers, header.supplier_id],
  )

  const allowedKind: DraftLine["kind"] | "both" = useMemo(() => {
    if (!currentSupplier) return "both"
    if (currentSupplier.supply_kind === "products") return "product"
    if (currentSupplier.supply_kind === "materials") return "material"
    return "both"
  }, [currentSupplier])

  function optionsFor(line: DraftLine): Option[] {
    const rawIds = Array.isArray(currentSupplier?.raw_material_ids) ? currentSupplier.raw_material_ids : []
    const prodIds = Array.isArray(currentSupplier?.product_ids) ? currentSupplier.product_ids : []

    if (line.kind === "product") {
      const filtered = prodIds.length > 0 ? products.filter((item) => prodIds.includes(item.id)) : products
      return filtered
        .filter((item) => !line.category_id || item.category_id === line.category_id)
        .map((item) => ({ id: item.id, label: item.product_name }))
    }

    const filtered = rawIds.length > 0 ? materials.filter((item) => rawIds.includes(item.id)) : materials
    return filtered
      .filter((item) => !line.category_id || item.category_id === line.category_id)
      .map((item) => ({ id: item.id, label: item.name }))
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function openCreate() {
    setEditing(null)
    setPanel(null)
    const initialSupplierId = header.supplier_id || suppliers[0]?.id || ""
    const initialSupplier = suppliers.find((s) => s.id === initialSupplierId)
    const kind = initialSupplier?.supply_kind === "products" ? "product" : "material"

    setHeader({
      supplier_id: initialSupplierId,
      expected_vehicle_plate: "",
      status: "initiated",
      notes: "",
    })
    setLines([blankLine(kind)])
    setShowCreate(true)
  }

  function openEdit(order: Order) {
    setEditing(order)
    setPanel(null)
    setHeader({
      supplier_id: order.supplier_id || "",
      expected_vehicle_plate: order.expected_vehicle_plate || "",
      status: order.status,
      notes: order.notes || "",
    })
    setLines(
      order.lines.length > 0
        ? order.lines.map((line) => ({
            key: line.id || crypto.randomUUID(),
            kind: line.product_id ? "product" : "material",
            category_id: "",
            item_id: line.product_id || line.raw_material_id || "",
            quantity: String(line.quantity),
            unit_price: String(line.unit_price ?? "0"),
          }))
        : [blankLine()],
    )
    setShowCreate(true)
  }

  function openQuickUpdate(order: Order) {
    setQuickOrder(order)
    setQuickForm({
      status: order.status,
      expected_vehicle_plate: order.expected_vehicle_plate || "",
    })
  }

  async function handleQuickSave(event: FormEvent) {
    event.preventDefault()
    if (!quickOrder) return
    setError("")
    setQuickSaving(true)
    try {
      await api(`/api/purchase-orders/${quickOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: quickForm.status,
          expected_vehicle_plate: quickForm.expected_vehicle_plate.trim().toUpperCase() || null,
        }),
      })
      setQuickOrder(null)
      void load().catch((caught) => setError(errorMessage(caught)))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setQuickSaving(false)
    }
  }

  async function quickAdvanceStatus(order: Order, nextStatus: string) {
    setError("")
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${order.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        })
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function createSupplier() {
    if (
      !supplierForm.supplier_company_name ||
      !supplierForm.contact_person_name ||
      !supplierForm.phone ||
      !supplierForm.email ||
      !supplierForm.address
    ) {
      setError("Fill in the new supplier's company, contact, phone, email, and address.")
      return
    }
    await guard(async () => {
      try {
        const created = await api<Supplier>("/api/suppliers", {
          method: "POST",
          body: JSON.stringify({ ...supplierForm, gst_number: null, is_gst: false, raw_material_ids: [], product_ids: [] }),
        })
        setSupplierForm(emptySupplier)
        setPanel(null)
        setHeader((current) => ({ ...current, supplier_id: created.id }))
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function createMaterial() {
    if (!draftMaterial.name.trim() || !header.supplier_id || !draftMaterial.category_id) {
      setError("Choose a supplier, then enter the raw material name and category.")
      return
    }
    await guard(async () => {
      try {
        const created = await api<Material>("/api/raw-materials/", {
          method: "POST",
          body: JSON.stringify({
            name: draftMaterial.name.trim(),
            kind: "other",
            quantity: "0",
            alert_quantity: "0",
            measurement_unit_id: draftMaterial.measurement_unit_id,
            category_id: draftMaterial.category_id,
            supplier_id: header.supplier_id,
            price: "0",
            purchase_price: "0",
            description: null,
          }),
        })
        setDraftMaterial((current) => ({ ...current, name: "" }))
        setPanel(null)
        setLines((current) => {
          const index = current.findIndex((line) => line.kind === "material" && !line.item_id)
          const slot = index >= 0 ? index : 0
          return current.map((line, lineIndex) =>
            lineIndex === slot
              ? { ...line, kind: "material", item_id: created.id, category_id: draftMaterial.category_id }
              : line,
          )
        })
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function createProduct() {
    if (!draftProduct.product_name.trim() || !draftProduct.sku_number.trim() || !header.supplier_id) {
      setError("Enter a product name and SKU.")
      return
    }
    await guard(async () => {
      try {
        const created = await api<Product>("/api/products", {
          method: "POST",
          body: JSON.stringify({
            product_name: draftProduct.product_name.trim(),
            sku_number: draftProduct.sku_number.trim(),
            product_type: "purchased",
            measurement_unit_id: draftProduct.measurement_unit_id,
            category_id: draftProduct.category_id,
            gst: false,
            gst_percent: 0,
            sale_price_without_gst: "0",
            alert_quantity: "0",
            quantity: "0",
            description: null,
          }),
        })
        const sup = suppliers.find((item) => item.id === header.supplier_id)
        if (sup) {
          const currentProdIds = Array.isArray(sup.product_ids) ? sup.product_ids : []
          await api(`/api/suppliers/${sup.id}`, {
            method: "PATCH",
            body: JSON.stringify({ product_ids: [...currentProdIds, created.id] }),
          })
        }
        setDraftProduct((current) => ({ ...current, product_name: "", sku_number: "" }))
        setPanel(null)
        setLines((current) => {
          const index = current.findIndex((line) => line.kind === "product" && !line.item_id)
          const slot = index >= 0 ? index : 0
          return current.map((line, lineIndex) =>
            lineIndex === slot
              ? { ...line, kind: "product", item_id: created.id, category_id: draftProduct.category_id }
              : line,
          )
        })
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  function payloadLines() {
    return lines.map((line) => ({
      product_id: line.kind === "product" ? line.item_id : null,
      raw_material_id: line.kind === "material" ? line.item_id : null,
      quantity: line.quantity,
      unit_price: line.unit_price,
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (lines.some((line) => !line.item_id)) {
      setError("Choose an item on every line, or remove the empty one.")
      return
    }
    await guard(async () => {
      try {
        const body = {
          supplier_id: header.supplier_id,
          notes: header.notes || null,
          status: header.status,
          expected_vehicle_plate: header.expected_vehicle_plate.trim().toUpperCase() || null,
          lines: payloadLines(),
        }
        if (editing) {
          await api(`/api/purchase-orders/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        } else {
          await api("/api/purchase-orders", { method: "POST", body: JSON.stringify(body) })
        }
        setShowCreate(false)
        setEditing(null)
        setLines([blankLine()])
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function cancelOrder(order: Order) {
    if (!window.confirm("Cancel this purchase order? Stock will not be credited.")) return
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${order.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        })
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const supplierMatch = (order.supplier_name || "").toLowerCase().includes(q)
      const plateMatch = (order.expected_vehicle_plate || "").toLowerCase().includes(q)
      const itemMatch = order.lines.some((line) => (line.item_name || "").toLowerCase().includes(q))
      const notesMatch = (order.notes || "").toLowerCase().includes(q)
      return supplierMatch || plateMatch || itemMatch || notesMatch
    })
  }, [orders, statusFilter, searchQuery])

  // Count metrics
  const counts = useMemo(() => {
    const total = orders.length
    const initiated = orders.filter((o) => o.status === "initiated").length
    const process = orders.filter((o) => o.status === "process").length
    const inDelivery = orders.filter((o) => o.status === "in_delivery").length
    const delivered = orders.filter((o) => o.status === "delivered").length
    const cancelled = orders.filter((o) => o.status === "cancelled").length
    return { total, initiated, process, inDelivery, delivered, cancelled }
  }, [orders])

  return (
    <div className="space-y-6">
      <PageTitle
        title="Purchase Orders"
        hint="Procure raw materials & manufactured parts from verified suppliers. Track shipment status, logistics vehicle numbers, and warehouse stock receipts."
        icon={ShoppingCart}
        badge={`${orders.length} Orders`}
        action={
          can("manage_purchasing") ? (
            <Button
              type="button"
              className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
              onClick={openCreate}
            >
              <PlusCircle className="mr-1.5 size-4" />
              Create Purchase Order
            </Button>
          ) : null
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* KPI Stats Bar */}
      {loading ? (
        <StatGridSkeleton count={5} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Total Purchase Orders</span>
              <div className="grid size-8.5 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/20">
                <ShoppingCart className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{counts.total}</p>
            <p className="mt-1 text-xs text-gray-400">Across all vendor accounts</p>
          </div>

          <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Awaiting / In Process</span>
              <div className="grid size-8.5 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/20">
                <Package className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
              {counts.initiated + counts.process}
            </p>
            <p className="mt-1 text-xs text-gray-400">{counts.initiated} initiated, {counts.process} processing</p>
          </div>

          <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">In Delivery / En Route</span>
              <div className="grid size-8.5 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-500/20">
                <Truck className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600">{counts.inDelivery}</p>
            <p className="mt-1 text-xs text-gray-400">Vehicles scheduled for gate arrival</p>
          </div>

          <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Delivered & Stocked</span>
              <div className="grid size-8.5 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{counts.delivered}</p>
            <p className="mt-1 text-xs text-gray-400">Goods verified & inventory credited</p>
          </div>

          <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Cancelled Orders</span>
              <div className="grid size-8.5 place-items-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/20">
                <XCircle className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">{counts.cancelled}</p>
            <p className="mt-1 text-xs text-gray-400">Voided / non-credited orders</p>
          </div>
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200/90 bg-white p-1.5 text-xs font-medium shadow-xs">
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "all"
                ? "bg-green-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("all")}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "initiated"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("initiated")}
          >
            Initiated ({counts.initiated})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "process"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("process")}
          >
            Process ({counts.process})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "in_delivery"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("in_delivery")}
          >
            In Delivery ({counts.inDelivery})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "delivered"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("delivered")}
          >
            Delivered ({counts.delivered})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-1.5 transition-all font-semibold",
              statusFilter === "cancelled"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => setStatusFilter("cancelled")}
          >
            Cancelled ({counts.cancelled})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplier, item, vehicle..."
            className="pl-9 text-xs rounded-xl border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/20"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchQuery("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Orders List / Loading Skeleton */}
      {loading ? (
        <CardListSkeleton count={4} />
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-400">
            <Truck className="size-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-900">
            {searchQuery || statusFilter !== "all"
              ? "No purchase orders match your filter"
              : "No purchase orders recorded yet"}
          </p>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">
            {searchQuery || statusFilter !== "all"
              ? "Try clearing your search query or selecting a different status filter tab."
              : "Click 'Create Purchase Order' above to place your first supplier order."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100"
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("all")
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const locked = order.stock_received || order.status === "cancelled"
            const orderTotal = order.lines.reduce((sum, line) => {
              const qty = Number(line.quantity) || 0
              const price = Number(line.unit_price) || 0
              return sum + qty * price
            }, 0)

            return (
              <article
                key={order.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white shadow-xs transition-all",
                  order.status === "cancelled"
                    ? "border-red-200 bg-red-50/20"
                    : "border-gray-200/90 hover:border-gray-300",
                )}
              >
                {/* Order Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-600">
                      <Building2 className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">
                          {staff ? "Incoming Material Shipment" : (order.supplier_name || "General Supplier")}
                        </h3>
                        <span className="font-mono text-[11px] font-medium text-gray-500">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {order.lines.length} {order.lines.length === 1 ? "line item" : "line items"}
                        {prices && orderTotal > 0 ? (
                          <span className="text-green-600 font-semibold">
                            {" "}· Total: ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={order.status} />

                    {/* Quick advance shortcut */}
                    {can("manage_purchasing") && !locked ? (
                      order.status === "initiated" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-8 border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold"
                          onClick={() => void quickAdvanceStatus(order, "in_delivery")}
                          disabled={busy}
                        >
                          <Truck className="mr-1 size-3.5" />
                          Mark In Delivery
                        </Button>
                      ) : order.status === "in_delivery" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl h-8 bg-green-600 font-semibold text-white shadow-xs text-xs hover:bg-green-700"
                          onClick={() => void quickAdvanceStatus(order, "delivered")}
                          disabled={busy}
                        >
                          <CheckCircle2 className="mr-1 size-3.5" />
                          Received and stocked
                        </Button>
                      ) : null
                    ) : null}
                  </div>
                </div>

                <OrderFlow status={order.status} />

                {/* Order Body */}
                <div className="p-5 space-y-4">
                  {/* Line items table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Item Ordered</th>
                          <th className="px-4 py-2.5 text-center">Type</th>
                          <th className="px-4 py-2.5 text-right">Quantity</th>
                          {prices ? <th className="px-4 py-2.5 text-right">Unit Price</th> : null}
                          {prices ? <th className="px-4 py-2.5 text-right">Subtotal</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {order.lines.map((line, idx) => {
                          const qty = Number(line.quantity) || 0
                          const price = Number(line.unit_price) || 0
                          const subtotal = qty * price
                          const isProduct = Boolean(line.product_id)

                          return (
                            <tr key={line.id ?? idx} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-2.5 font-semibold text-gray-900">
                                {line.item_name || "Material item"}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span
                                  className={cn(
                                    "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                                    isProduct
                                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                                      : "bg-blue-50 text-blue-700 border border-blue-200",
                                  )}
                                >
                                  {isProduct ? "Product" : "Raw Material"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                                {line.quantity}
                              </td>
                              {prices ? (
                                <td className="px-4 py-2.5 text-right text-slate-300">
                                  {line.unit_price ? `₹${line.unit_price}` : "–"}
                                </td>
                              ) : null}
                              {prices ? (
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                                  ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Delivery Info & Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Vehicle Number pill */}
                      {order.expected_vehicle_plate ? (
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-semibold text-cyan-300">
                          <Truck className="size-3.5" />
                          <span>Vehicle: <strong>{order.expected_vehicle_plate}</strong></span>
                          {can("manage_purchasing") && !locked ? (
                            <button
                              type="button"
                              className="ml-1 text-cyan-400 hover:text-white"
                              onClick={() => openQuickUpdate(order)}
                              title="Update Vehicle Number"
                            >
                              <Pencil className="size-3" />
                            </button>
                          ) : null}
                        </div>
                      ) : can("manage_purchasing") && !locked ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors"
                          onClick={() => openQuickUpdate(order)}
                        >
                          <Truck className="size-3.5" />
                          <span>+ Set Vehicle Plate</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Vehicle not assigned</span>
                      )}

                      {/* Stock Received pill */}
                      {order.stock_received ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3.5" />
                          <span>Inventory Stock Credited</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Order Action Buttons */}
                    {can("manage_purchasing") && !locked ? (
                      <div className="flex items-center gap-2">
                        {/* Quick Update Button */}
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs h-8"
                          onClick={() => openQuickUpdate(order)}
                        >
                          <Zap className="mr-1 size-3.5 text-amber-500" />
                          Quick Update
                        </Button>

                        {/* Full Edit */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-gray-200 bg-white text-xs h-8 text-gray-700 hover:bg-gray-50"
                          onClick={() => openEdit(order)}
                        >
                          <Pencil className="mr-1 size-3.5" />
                          Full Edit
                        </Button>

                        {/* Cancel */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs h-8"
                          disabled={busy}
                          onClick={() => void cancelOrder(order)}
                        >
                          <XCircle className="mr-1 size-3.5" />
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Cancelled Notice Banner */}
                  {order.status === "cancelled" ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                      <XCircle className="size-4 shrink-0 text-rose-500" />
                      <div>
                        <p className="font-semibold text-rose-900">Purchase Order Cancelled</p>
                        <p className="text-[11px] text-rose-700">This procurement request was voided. No stock will be delivered or credited to inventory.</p>
                      </div>
                    </div>
                  ) : null}

                  {order.notes ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-700 flex items-start gap-2">
                      <FileText className="size-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>{order.notes}</span>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* QUICK UPDATE MODAL (Status & Delivery Vehicle Plate) */}
      <Dialog open={quickOrder !== null} onOpenChange={(open) => !open && setQuickOrder(null)}>
        <DialogContent className="sm:max-w-md border-gray-200 bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Zap className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">Quick Update PO</DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Update order status and truck delivery vehicle number plate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {quickOrder ? (
            <form onSubmit={handleQuickSave} className="space-y-4 mt-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1">
                <p className="font-semibold text-gray-900">
                  {quickOrder.supplier_name || "Supplier PO"} · {quickOrder.lines.map((l) => l.item_name).filter(Boolean).join(", ")}
                </p>
                <p className="text-gray-400 font-mono text-[11px]">PO #{quickOrder.id.slice(0, 8).toUpperCase()}</p>
              </div>

              <OrderFlow status={quickForm.status} compact />

              <Field label="Status Stage" hint="Selecting 'Delivered' automatically credits warehouse stock">
                <select
                  className={selectClass}
                  value={quickForm.status}
                  onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}
                >
                  {STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label} — {status.desc}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Delivery Vehicle Plate Number" hint="e.g. MH-12-AB-1234">
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    className="pl-9 font-mono uppercase bg-white border-gray-200 text-gray-900"
                    placeholder="e.g. MH-12-AB-1234"
                    value={quickForm.expected_vehicle_plate}
                    onChange={(e) =>
                      setQuickForm({
                        ...quickForm,
                        expected_vehicle_plate: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </Field>

              <DialogFooter className="border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => setQuickOrder(null)}
                  disabled={quickSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={quickSaving}
                  className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                >
                  <Sparkles className="mr-1.5 size-4 text-white" />
                  {quickSaving ? "Saving..." : "Save Quick Update"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* FULL CREATE / EDIT PURCHASE ORDER MODAL */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-3xl border-gray-200 bg-white">
          <FormBusy show={busy} label={editing ? "Updating order" : "Placing orders"} />
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-600">
                <ShoppingCart className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  {editing ? "Edit Purchase Order" : "Create Purchase Order"}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {editing
                    ? "Modify ordered items, supplier credentials, or shipment status."
                    : "Add multiple items in one order form. Stock will be held and verified on delivery."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form className="mt-2 space-y-5" onSubmit={(event) => void save(event)}>
            {/* Supplier & Header Section */}
            <section className="grid gap-4 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SearchSelect
                  label="Supplier Company"
                  options={suppliers
                    .filter((item) => item.supply_kind !== "none")
                    .map((item) => ({ id: item.id, label: item.supplier_company_name }))}
                  value={header.supplier_id}
                  onChange={(supplier_id) => {
                    setHeader({ ...header, supplier_id })
                    setLines((current) => current.map((line) => ({ ...line, item_id: "" })))
                  }}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setPanel(panel === "supplier" ? null : "supplier")}
                >
                  {panel === "supplier" ? "Hide Supplier Form" : "+ Add a New Supplier"}
                </Button>
              </div>

              {/* Inline mini-create for supplier */}
              {panel === "supplier" ? (
                <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:col-span-2 sm:grid-cols-2">
                  <p className="text-sm font-bold text-gray-900 sm:col-span-2 flex items-center gap-1.5">
                    <Building2 className="size-4 text-green-600" />
                    Create New Supplier
                  </p>
                  <Field label="Company Name">
                    <Input
                      value={supplierForm.supplier_company_name}
                      placeholder="e.g. Jindal Steel Ltd"
                      onChange={(event) => setSupplierForm({ ...supplierForm, supplier_company_name: event.target.value })}
                    />
                  </Field>
                  <Field label="Contact Person">
                    <Input
                      value={supplierForm.contact_person_name}
                      placeholder="e.g. Ramesh Sharma"
                      onChange={(event) => setSupplierForm({ ...supplierForm, contact_person_name: event.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={supplierForm.phone}
                      placeholder="+91 98765 43210"
                      onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={supplierForm.email}
                      placeholder="contact@supplier.com"
                      onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })}
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input
                      value={supplierForm.address}
                      placeholder="Industrial Area, Plot 4B"
                      onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })}
                    />
                  </Field>
                  <Field label="Supply Category">
                    <select
                      className={selectClass}
                      value={supplierForm.supply_kind}
                      onChange={(event) => setSupplierForm({ ...supplierForm, supply_kind: event.target.value })}
                    >
                      <option value="materials">Raw materials only</option>
                      <option value="products">Products only</option>
                      <option value="both">Both (Materials & Products)</option>
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      disabled={busy}
                      className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-10 w-full"
                      onClick={() => void createSupplier()}
                    >
                      Save & Select Supplier
                    </Button>
                  </div>
                </div>
              ) : null}

              <Field label="Expected Delivery Vehicle" hint="Optional">
                <Input
                  value={header.expected_vehicle_plate}
                  placeholder="e.g. MH-12-AB-1234"
                  onChange={(event) => setHeader({ ...header, expected_vehicle_plate: event.target.value.toUpperCase() })}
                />
              </Field>

              <Field label="Order Status Stage" hint="'Delivered' adds goods directly to inventory">
                <select
                  className={selectClass}
                  value={header.status}
                  onChange={(event) => setHeader({ ...header, status: event.target.value })}
                >
                  {(STATUSES.some((status) => status.id === header.status)
                    ? STATUSES
                    : [{ id: header.status, label: header.status.replaceAll("_", " "), desc: "" }, ...STATUSES]
                  ).map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="PO Instructions / Notes" className="sm:col-span-2">
                <textarea
                  className="min-h-16 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                  value={header.notes}
                  placeholder="e.g. Immediate delivery required, coil thickness verification at gate"
                  onChange={(event) => setHeader({ ...header, notes: event.target.value })}
                />
              </Field>
            </section>

            {/* Quick Create Buttons for Material / Product */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => setPanel(panel === "material" ? null : "material")}
              >
                {panel === "material" ? "Close Raw Material Form" : "+ Create New Raw Material"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => setPanel(panel === "product" ? null : "product")}
              >
                {panel === "product" ? "Close Product Form" : "+ Create New Product"}
              </Button>
            </div>

            {/* Mini-create raw material panel */}
            {panel === "material" ? (
              <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <CategoryManager
                    categories={materialCategories}
                    onAdd={(name) =>
                      void api<Named>("/api/raw-materials/categories", { method: "POST", body: JSON.stringify({ name }) })
                        .then((created) => {
                          setDraftMaterial((current) => ({ ...current, category_id: created.id }))
                          return load()
                        })
                        .catch((caught) => setError(errorMessage(caught)))
                    }
                    onRemove={(id) =>
                      void api(`/api/raw-materials/categories/${id}`, { method: "DELETE" })
                        .then(load)
                        .catch((caught) => setError(errorMessage(caught)))
                    }
                  />
                </div>
                <Field label="Category" required>
                  <select
                    className={selectClass}
                    value={draftMaterial.category_id}
                    onChange={(event) => setDraftMaterial({ ...draftMaterial, category_id: event.target.value })}
                  >
                    {materialCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit of Measure" required>
                  <select
                    className={selectClass}
                    value={draftMaterial.measurement_unit_id}
                    onChange={(event) => setDraftMaterial({ ...draftMaterial, measurement_unit_id: event.target.value })}
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Material Name" className="sm:col-span-2" required>
                  <Input
                    value={draftMaterial.name}
                    placeholder="e.g. CR Steel Coil 1.2mm"
                    onChange={(event) => setDraftMaterial({ ...draftMaterial, name: event.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    disabled={busy}
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-9"
                    onClick={() => void createMaterial()}
                  >
                    Save & Add To Line Items
                  </Button>
                </div>
              </section>
            ) : null}

            {/* Mini-create product panel */}
            {panel === "product" ? (
              <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <CategoryManager
                    categories={productCategories}
                    onAdd={(name) =>
                      void api<Named>("/api/product-categories", { method: "POST", body: JSON.stringify({ name }) })
                        .then((created) => {
                          setDraftProduct((current) => ({ ...current, category_id: created.id }))
                          return load()
                        })
                        .catch((caught) => setError(errorMessage(caught)))
                    }
                    onRemove={(id) =>
                      void api(`/api/product-categories/${id}`, { method: "DELETE" })
                        .then(load)
                        .catch((caught) => setError(errorMessage(caught)))
                    }
                  />
                </div>
                <Field label="Category" required>
                  <select
                    className={selectClass}
                    value={draftProduct.category_id}
                    onChange={(event) => setDraftProduct({ ...draftProduct, category_id: event.target.value })}
                  >
                    {productCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit of Measure" required>
                  <select
                    className={selectClass}
                    value={draftProduct.measurement_unit_id}
                    onChange={(event) => setDraftProduct({ ...draftProduct, measurement_unit_id: event.target.value })}
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Product Name" required>
                  <Input
                    value={draftProduct.product_name}
                    placeholder="e.g. Precision Bracket A4"
                    onChange={(event) => setDraftProduct({ ...draftProduct, product_name: event.target.value })}
                  />
                </Field>
                <Field label="SKU / Part Code" required>
                  <Input
                    value={draftProduct.sku_number}
                    placeholder="e.g. PRD-BRK-001"
                    onChange={(event) => setDraftProduct({ ...draftProduct, sku_number: event.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    disabled={busy}
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-9"
                    onClick={() => void createProduct()}
                  >
                    Save & Add To Line Items
                  </Button>
                </div>
              </section>
            ) : null}

            {/* Line Items Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Ordered Items ({lines.length})
                </p>
                {!editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-gray-200 bg-white text-xs font-semibold text-green-700 hover:bg-green-50"
                    onClick={() =>
                      setLines((current) => [...current, blankLine(allowedKind === "product" ? "product" : "material")])
                    }
                  >
                    <PlusCircle className="mr-1 size-3.5" />
                    Add Another Item
                  </Button>
                ) : null}
              </div>

              {lines.map((line, index) => (
                <section
                  key={line.key}
                  className="grid gap-3 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-4 sm:grid-cols-2"
                >
                  <div className="flex items-center justify-between sm:col-span-2">
                    <span className="text-xs font-bold text-gray-900">Item #{index + 1}</span>
                    {lines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>

                  <Field label="Item Classification">
                    <select
                      className={selectClass}
                      value={line.kind}
                      onChange={(event) =>
                        updateLine(line.key, { kind: event.target.value as DraftLine["kind"], item_id: "" })
                      }
                    >
                      {allowedKind !== "product" ? <option value="material">Raw Material (Sheet/Coil)</option> : null}
                      {allowedKind !== "material" ? <option value="product">Finished Product / Part</option> : null}
                    </select>
                  </Field>

                  <Field label="Category Filter">
                    <select
                      className={selectClass}
                      value={line.category_id}
                      onChange={(event) => updateLine(line.key, { category_id: event.target.value, item_id: "" })}
                    >
                      <option value="">All Categories</option>
                      {(line.kind === "product" ? productCategories : materialCategories).map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </Field>

                  <div className="sm:col-span-2">
                    <SearchSelect
                      label={line.kind === "product" ? "Select Product" : "Select Raw Material"}
                      options={optionsFor(line)}
                      value={line.item_id}
                      onChange={(item_id) => updateLine(line.key, { item_id })}
                      required
                    />
                  </div>

                  <Field label="Order Quantity" required>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      required
                    />
                  </Field>

                  {prices ? (
                    <Field label="Negotiated Unit Price (₹)">
                      <Input
                        value={line.unit_price}
                        placeholder="0.00"
                        onChange={(event) => updateLine(line.key, { unit_price: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </section>
              ))}
            </div>

            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
              >
                {editing ? "Save Purchase Order" : lines.length > 1 ? `Place ${lines.length} Purchase Orders` : "Place Purchase Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
