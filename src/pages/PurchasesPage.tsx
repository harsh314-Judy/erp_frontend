import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Building2,
  CheckCircle2,
  FileText,
  Pencil,
  PlusCircle,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
  XCircle,
  Zap,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { SlipUpload, type SlipFile } from "@/components/SlipUpload"
import { CardListSkeleton, FormBusy } from "@/components/PlantLoader"
import { Field, FilterPanel, Notice, PageTitle, SearchPill, SearchSelect, StatusBadge } from "@/components/plant-ui"
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
import { api, errorMessage, peek, plain, rupees, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { useRefreshWhenShown } from "@/lib/visible"
import { cn } from "@/lib/utils"

type Named = { id: string; name: string; abbreviation?: string | null }
type Option = { id: string; label: string }
type Supplier = {
  id: string
  supplier_company_name: string
  supply_kind: string
  raw_material_ids?: string[]
  product_ids?: string[]
}
type Material = { id: string; name: string; category_id: string | null; measurement_unit_id?: string; price?: string | null; purchase_price?: string | null }
type Product = { id: string; product_name: string; category_id: string; measurement_unit_id?: string; gst?: boolean; gst_percent?: number; sale_price_without_gst?: string | null; last_purchase_price?: string | null }
type Line = {
  id?: string
  item_name?: string | null
  product_id: string | null
  raw_material_id: string | null
  quantity: string
  unit_price: string | null
  purchase_rate?: string | null
  selling_rate?: string | null
  gst?: boolean
  gst_percent?: number
  measurement_unit_id?: string | null
  product_type?: string | null
}
type OrderFile = SlipFile & { kind: string }
type Order = {
  id: string
  supplier_id: string | null
  supplier_name: string | null
  status: string
  notes: string | null
  stock_received: boolean
  amount_paid?: string | null
  receipt_fail_reason?: string | null
  receipt_fail_note?: string | null
  expected_vehicle_plate: string | null
  transport_mode?: string | null
  driver_name?: string | null
  carrier_phone?: string | null
  pickup_user_id?: string | null
  cancel_reason?: string | null
  status_before_cancel?: string | null
  lines: Line[]
  attachments?: OrderFile[]
}
type DraftLine = {
  key: string
  kind: "material" | "product"
  category_id: string
  item_id: string
  quantity: string
  unit_id: string
  purchase_rate: string
  selling_rate: string
  gst: boolean
  gst_percent: string
}

const FLOW = [
  { id: "arrived", label: "Arrived" },
  { id: "accounted", label: "Material accounted" },
  { id: "paid", label: "Payment done" },
]

function purchaseStage(order: { status: string; stock_received: boolean; amount_paid?: string | null; lines: { quantity: string; unit_price: string | null }[] }) {
  if (order.status === "cancelled") return "cancelled"
  const total = order.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0)
  const paid = Number(order.amount_paid || 0)
  if (order.stock_received && total > 0 && paid >= total - 0.009) return "paid"
  if (order.stock_received) return "accounted"
  return "arrived"
}

function OrderFlow({ status, compact = false }: { status: string; compact?: boolean }) {
  const steps = FLOW
  const current = steps.findIndex((step) => step.id === status)
  const cancelled = status === "cancelled"
  return (
    <ol className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1", compact ? "py-1" : "px-5 py-2")}>
      {cancelled ? (
        <li className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">Cancelled</li>
      ) : null}
      {steps.map((step, index) => {
        const reached = !cancelled && index <= current
        const active = !cancelled && index === current
        return (
          <li key={step.id} className="flex items-center gap-1">
            <span
              title={step.label}
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
  state: "",
  payment_terms: "",
  supply_kind: "materials",
}

function blankLine(kind: DraftLine["kind"] = "material"): DraftLine {
  return {
    key: crypto.randomUUID(),
    kind,
    category_id: "",
    item_id: "",
    quantity: "1",
    unit_id: "",
    purchase_rate: "",
    selling_rate: "",
    gst: false,
    gst_percent: "18",
  }
}

function billedRate(line: DraftLine) {
  const rate = Number(line.purchase_rate) || 0
  if (!line.gst) return rate
  const percent = Number(line.gst_percent) || 0
  return Math.round(rate * (100 + percent)) / 100
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
  const [receiptNotice, setReceiptNotice] = useState<{ id: string; message: string } | null>(null)

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [goodsFilter, setGoodsFilter] = useState("all")
  const [kept, setKept] = useState<string[]>([])

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
    status: "received",
    notes: "",
    transport_mode: "truck",
    driver_name: "",
    carrier_phone: "",
    pickup_user_id: "",
  })
  const [pickupStaff, setPickupStaff] = useState<Array<{ id: string; first_name: string; last_name: string | null }>>([])
  const [lines, setLines] = useState<DraftLine[]>([blankLine()])
  const [invoicePhotos, setInvoicePhotos] = useState<SlipFile[]>([])
  const [receiveOrder, setReceiveOrder] = useState<Order | null>(null)
  const [failOrder, setFailOrder] = useState<Order | null>(null)
  const [failReason, setFailReason] = useState("wrong thickness")
  const [failNote, setFailNote] = useState("")
  const [challanNumber, setChallanNumber] = useState("")
  const [challanNote, setChallanNote] = useState("")
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState("")

  // Quick update modal
  const [quickOrder, setQuickOrder] = useState<Order | null>(null)
  const [quickForm, setQuickForm] = useState({ status: "initiated", expected_vehicle_plate: "" })
  const [quickSaving, setQuickSaving] = useState(false)

  async function load() {
    try {
      const orderRows = await api<Order[]>("/api/purchase-orders")
      setOrders(orderRows)
      if (!can("manage_purchasing")) return
      const [supplierPage, materialPage, productPage, materialCategoryPage, productCategoryPage, unitPage, people] = await Promise.all([
        api<Page<Supplier>>("/api/suppliers?page=1&page_size=500"),
        api<Page<Material>>("/api/raw-materials/?page=1&page_size=500&brief=true"),
        api<Page<Product>>("/api/products?page=1&page_size=500&brief=true"),
        api<Page<Named>>("/api/raw-materials/categories?page=1&page_size=100"),
        api<Page<Named>>("/api/product-categories?page=1&page_size=100"),
        api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
        api<Array<{ id: string; first_name: string; last_name: string | null }>>("/api/users/options"),
      ])
      setSuppliers(supplierPage.items)
      setMaterials(materialPage.items)
      setProducts(productPage.items)
      setMaterialCategories(materialCategoryPage.items)
      setProductCategories(productCategoryPage.items)
      setUnits(unitPage.items)
      setPickupStaff(people)
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
      return (allowed ?? []).includes(item)
    })
    if (!supplier) {
      setError(
        kind === "product"
          ? "No supplier is linked to this product. Add a supplier here, or link the product on the supplier page."
          : "No supplier is linked to this material. Add a supplier here, or link the material on the supplier page.",
      )
    }
    setEditing(null)
    setHeader({
      supplier_id: supplier?.id || "",
      expected_vehicle_plate: "",
      status: "received",
      notes: "",
      transport_mode: "truck",
      driver_name: "",
      carrier_phone: "",
      pickup_user_id: "",
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

  function optionsFor(): Option[] {
    if (!currentSupplier) return []
    const rawIds = Array.isArray(currentSupplier.raw_material_ids) ? currentSupplier.raw_material_ids : []
    const prodIds = Array.isArray(currentSupplier.product_ids) ? currentSupplier.product_ids : []
    const materialOptions = allowedKind === "product" ? [] : materials
      .filter((item) => rawIds.includes(item.id))
      .map((item) => ({ id: item.id, label: item.name }))
    const productOptions = allowedKind === "material" ? [] : products
      .filter((item) => prodIds.includes(item.id))
      .map((item) => ({ id: item.id, label: item.product_name }))
    return [...materialOptions, ...productOptions]
  }

  function fillFromItem(line: DraftLine, itemId: string): Partial<DraftLine> {
    const product = products.find((item) => item.id === itemId)
    if (product) {
      return {
        kind: "product",
        item_id: itemId,
        category_id: product.category_id,
        unit_id: product.measurement_unit_id || "",
        purchase_rate: product.last_purchase_price ?? line.purchase_rate,
        selling_rate: product.sale_price_without_gst ?? line.selling_rate,
        gst: Boolean(product.gst),
        gst_percent: String(product.gst_percent || 18),
      }
    }
    const material = materials.find((item) => item.id === itemId)
    return {
      kind: "material",
      item_id: itemId,
      category_id: material?.category_id || "",
      unit_id: material?.measurement_unit_id || "",
      purchase_rate: material?.purchase_price ?? line.purchase_rate,
      selling_rate: material?.price ?? line.selling_rate,
    }
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
      status: "received",
      notes: "",
      transport_mode: "truck",
      driver_name: "",
      carrier_phone: "",
      pickup_user_id: "",
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
      transport_mode: order.transport_mode || "truck",
      driver_name: order.driver_name || "",
      carrier_phone: order.carrier_phone || "",
      pickup_user_id: order.pickup_user_id || "",
    })
    setLines(
      order.lines.length > 0
        ? order.lines.map((line) => ({
            key: line.id || crypto.randomUUID(),
            kind: line.product_id ? "product" : "material",
            category_id: "",
            item_id: line.product_id || line.raw_material_id || "",
            quantity: String(line.quantity),
            unit_id: line.measurement_unit_id || "",
            purchase_rate: String(line.purchase_rate ?? line.unit_price ?? ""),
            selling_rate: line.selling_rate == null ? "" : String(line.selling_rate),
            gst: Boolean(line.gst),
            gst_percent: String(line.gst_percent ?? 0),
          }))
        : [blankLine()],
    )
    setShowCreate(true)
  }

  function openQuickUpdate(order: Order) {
    setQuickOrder(order)
    setQuickForm({
      status: purchaseStage(order) === "cancelled" ? "arrived" : purchaseStage(order),
      expected_vehicle_plate: order.expected_vehicle_plate || "",
    })
  }

  async function handleQuickSave(event: FormEvent) {
    event.preventDefault()
    if (!quickOrder) return
    setError("")
    setQuickSaving(true)
    try {
        if (quickForm.status === "accounted" && !quickOrder.stock_received) {
          await api(`/api/purchase-orders/${quickOrder.id}/account`, { method: "POST" })
        }
        await api(`/api/purchase-orders/${quickOrder.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_vehicle_plate: quickForm.expected_vehicle_plate.trim().toUpperCase() || null,
          }),
        })
        remember(quickOrder.id)
      setQuickOrder(null)
      void load().catch((caught) => setError(errorMessage(caught)))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setQuickSaving(false)
    }
  }

  async function linkFile(order: Order, file: SlipFile, kind: string) {
    await api(`/api/purchase-orders/${order.id}/attachments`, {
      method: "POST",
      body: JSON.stringify({ attachment_id: file.attachment_id, kind }),
    })
    setReceiptNotice((current) => (current?.id === order.id ? null : current))
    void load().catch((caught) => setError(errorMessage(caught)))
  }

  async function confirmFail() {
    if (!failOrder) return
    setError("")
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${failOrder.id}/inspect`, {
          method: "POST",
          body: JSON.stringify({ result: "fail", reason: failReason, note: failNote || null }),
        })
        setFailOrder(null)
        setFailNote("")
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function confirmReceive() {
    if (!receiveOrder) return
    if (!invoicePhotos.length) return
    setError("")
    await guard(async () => {
      try {
        for (const file of invoicePhotos) {
          if (!(receiveOrder.attachments ?? []).some((row) => row.attachment_id === file.attachment_id)) {
            await api(`/api/purchase-orders/${receiveOrder.id}/attachments`, {
              method: "POST",
              body: JSON.stringify({ attachment_id: file.attachment_id, kind: "supplier_invoice" }),
            })
          }
        }
        await api(`/api/purchase-orders/${receiveOrder.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "delivered", challan_number: challanNumber || null, challan_note: challanNote || null }),
        })
        setReceiveOrder(null)
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
      !supplierForm.address ||
      !supplierForm.state
    ) {
      setError("Fill in the new supplier's company, contact, phone, email, address, and state.")
      return
    }
    await guard(async () => {
      try {
        setError("")
        const created = await api<Supplier>("/api/suppliers", {
          method: "POST",
          body: JSON.stringify({ ...supplierForm, gst_number: null, is_gst: false, raw_material_ids: [], product_ids: [] }),
        })
        setSupplierForm(emptySupplier)
        setPanel(null)
    setHeader((current) => ({ ...current, supplier_id: created.id }))
    const productIds = lines.filter((line) => line.kind === "product" && line.item_id).map((line) => line.item_id)
    const materialIds = lines.filter((line) => line.kind === "material" && line.item_id).map((line) => line.item_id)
    if (productIds.length || materialIds.length) {
      await api(`/api/suppliers/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ product_ids: productIds, raw_material_ids: materialIds }),
      })
    }
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
      purchase_rate: line.purchase_rate.trim() || "0",
      selling_rate: line.selling_rate.trim() ? line.selling_rate.trim() : null,
      gst: line.gst,
      gst_percent: line.gst ? Number(line.gst_percent) || 0 : 0,
      measurement_unit_id: line.unit_id || null,
      unit_price: String(billedRate(line)),
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
        const attachments = [
          ...invoicePhotos.map((file) => ({ attachment_id: file.attachment_id, kind: "supplier_invoice" })),
        ]
        if (!editing && !invoicePhotos.length) {
          setError("Upload the receipt photo.")
          return
        }
        if (header.transport_mode === "truck" && (!header.expected_vehicle_plate.trim() || !header.driver_name.trim())) {
          setError("A truck needs the licence plate and the driver's name.")
          return
        }
        if (header.transport_mode === "handcart" && (!header.driver_name.trim() || !header.carrier_phone.trim())) {
          setError("A hand cart needs the person's name and phone.")
          return
        }
        if (header.transport_mode === "staff_vehicle" && !header.pickup_user_id) {
          setError("Choose the staff member who will pick this up.")
          return
        }
        const body = {
          supplier_id: header.supplier_id,
          notes: header.notes || null,
          status: editing ? header.status : "received",
          transport_mode: header.transport_mode,
          driver_name: header.driver_name.trim() || null,
          carrier_phone: header.carrier_phone.trim() || null,
          pickup_user_id: header.pickup_user_id || null,
          expected_vehicle_plate: header.transport_mode === "handcart" ? null : header.expected_vehicle_plate.trim().toUpperCase() || null,
          lines: payloadLines(),
          attachments,
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

  async function confirmCancel() {
    if (!cancelTarget) return
    const reason = cancelReason.trim()
    if (!reason) {
      setError("Write why this order is being cancelled.")
      return
    }
    const order = cancelTarget
    remember(order.id)
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${order.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", cancel_reason: reason }),
        })
        setCancelTarget(null)
        setCancelReason("")
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function restoreOrder(order: Order) {
    remember(order.id)
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${order.id}/restore`, { method: "POST" })
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function accountMaterials(order: Order) {
    remember(order.id)
    await guard(async () => {
      try {
        await api(`/api/purchase-orders/${order.id}/account`, { method: "POST" })
        setReceiptNotice((current) => (current?.id === order.id ? null : current))
        void load().catch((caught) => setError(errorMessage(caught)))
      } catch (caught) {
        const message = errorMessage(caught)
        if (message.toLowerCase().includes("receipt")) {
          setReceiptNotice({ id: order.id, message })
          setError("")
        } else {
          setError(message)
        }
      }
    })
  }

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || purchaseStage(order) === statusFilter || kept.includes(order.id)
      if (!matchesStatus) return false
      const traded = order.lines.some((line) => line.product_type === "purchased")
      const material = order.lines.some((line) => line.raw_material_id)
      const other = order.lines.some((line) => line.product_id && line.product_type !== "purchased")
      if (goodsFilter === "traded" && !traded) return false
      if (goodsFilter === "material" && !material) return false
      if (goodsFilter === "other" && !other) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const supplierMatch = (order.supplier_name || "").toLowerCase().includes(q)
      const plateMatch = (order.expected_vehicle_plate || "").toLowerCase().includes(q)
      const itemMatch = order.lines.some((line) => (line.item_name || "").toLowerCase().includes(q))
      const notesMatch = (order.notes || "").toLowerCase().includes(q)
      return supplierMatch || plateMatch || itemMatch || notesMatch
    })
  }, [orders, statusFilter, goodsFilter, searchQuery, kept])

  function chooseStatus(next: string) {
    setStatusFilter(next)
    setKept([])
  }

  function remember(id: string) {
    setKept((current) => (current.includes(id) ? current : [...current, id]))
  }

  // Count metrics
  const counts = useMemo(() => {
    const total = orders.length
    const arrived = orders.filter((order) => purchaseStage(order) === "arrived").length
    const accounted = orders.filter((order) => purchaseStage(order) === "accounted").length
    const paid = orders.filter((order) => purchaseStage(order) === "paid").length
    const cancelled = orders.filter((order) => purchaseStage(order) === "cancelled").length
    return { total, arrived, accounted, paid, cancelled }
  }, [orders])

  return (
    <div className="space-y-6">
      <PageTitle
        title="Purchase Orders"
        hint="Procure raw materials & manufactured parts from verified suppliers. Track shipment status, logistics vehicle numbers, and warehouse stock receipts."
        guide={[
          {
            heading: "How an order moves",
            items: [
              { label: "Initiated", detail: "The purchase is logged with the supplier." },
              { label: "In Process", detail: "The supplier is preparing the goods. Quick Update can set this step." },
              { label: "In Delivery", detail: "The shipment is on the way to the plant. Step back returns it to Initiated, and stock stays unchanged." },
              { label: "Delivered", detail: "Received and stocked adds the quantity to inventory." },
              { label: "Cancelled", detail: "The order is voided and no stock is credited." },
            ],
          },
          {
            heading: "The card",
            items: [
              { label: "Supplier and lines", detail: "Each card shows the supplier, every raw material or manufactured part, and the order total." },
              { label: "Vehicle", detail: "Set the vehicle plate expected at the gate, then record the receipt note when it arrives." },
              { label: "Tabs", detail: "A status change stays on the current tab until you switch tabs." },
            ],
          },
        ]}
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

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterPanel title="Status">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              statusFilter === "all"
                ? "bg-green-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => chooseStatus("all")}
          >
            All ({counts.total})
          </button>
          {([
            ["arrived", `Arrived (${counts.arrived})`],
            ["accounted", `Material accounted (${counts.accounted})`],
            ["paid", `Payment done (${counts.paid})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                statusFilter === id ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
              )}
              onClick={() => chooseStatus(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              statusFilter === "cancelled"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => chooseStatus("cancelled")}
          >
            Cancelled ({counts.cancelled})
          </button>
        </FilterPanel>
        <FilterPanel title="Items">
          {([
            ["all", "All items", orders.length],
            ["traded", "Traded products", orders.filter((order) => order.lines.some((line) => line.product_type === "purchased")).length],
            ["material", "Raw materials", orders.filter((order) => order.lines.some((line) => line.raw_material_id)).length],
            ["other", "Other products", orders.filter((order) => order.lines.some((line) => line.product_id && line.product_type !== "purchased")).length],
          ] as const).filter(([id, , count]) => id !== "other" || count > 0).map(([id, label, count]) => (
            <button key={id} type="button" className={cn("rounded-md px-3 py-1.5 text-sm font-medium", goodsFilter === id ? "bg-violet-700 text-white" : "text-gray-600 hover:bg-gray-50")} onClick={() => setGoodsFilter(id)}>
              {label} ({count})
            </button>
          ))}
        </FilterPanel>
        </div>
        <SearchPill value={searchQuery} onChange={setSearchQuery} placeholder="Supplier, item, vehicle" />
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
                chooseStatus("all")
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="tone tone-emerald grid size-9 place-items-center rounded-xl">
                      <Building2 className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">
                          {staff ? "Incoming Material Shipment" : (order.supplier_name || "General Supplier")}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          {order.lines.some((line) => line.gst) ? "GST" : "NON-GST"}
                          {order.transport_mode === "handcart"
                            ? ` · Hand cart${order.driver_name ? ` · ${order.driver_name}` : ""}`
                            : order.transport_mode === "staff_vehicle"
                              ? ` · Staff vehicle${order.driver_name ? ` · ${order.driver_name}` : ""}`
                              : order.transport_mode === "truck"
                                ? ` · Truck${order.driver_name ? ` · ${order.driver_name}` : ""}`
                                : ""}
                          {order.carrier_phone ? ` · ${order.carrier_phone}` : ""}
                        </p>
                        <span className="font-mono text-[11px] font-medium text-gray-500">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                        <span>
                          {order.lines.length} {order.lines.length === 1 ? "line item" : "line items"}
                        </span>
                        {prices && orderTotal > 0 ? <span>Total {rupees(orderTotal)}</span> : null}
                        {order.expected_vehicle_plate ? <span>Vehicle {order.expected_vehicle_plate}</span> : null}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={purchaseStage(order) === "paid" ? "paid" : purchaseStage(order) === "accounted" ? "delivered" : purchaseStage(order)} label={FLOW.find((step) => step.id === purchaseStage(order))?.label || "Cancelled"} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-white">
                  <OrderFlow status={purchaseStage(order)} />
                  {can("manage_purchasing") && !order.stock_received && order.status !== "cancelled" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mr-3 h-7 rounded-md bg-[var(--scheme)] px-2.5 text-[11px] font-semibold text-white hover:bg-[var(--scheme-hover)]"
                      onClick={() => void accountMaterials(order)}
                      disabled={busy}
                    >
                      Mark stage done
                    </Button>
                  ) : null}
                </div>
                {order.status === "in_delivery" && order.receipt_fail_reason ? (
                  <p className="px-5 pt-3 text-xs text-rose-700">
                    Failed inspection: {order.receipt_fail_reason}
                    {order.receipt_fail_note ? ` — ${order.receipt_fail_note}` : ""}. Stock was not credited.
                  </p>
                ) : null}

                <div className="flex items-start gap-4 p-5">
                  {can("manage_purchasing") && !locked ? (
                    <div className="flex w-28 shrink-0 flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 w-full justify-start rounded-md border border-green-200 bg-green-50 px-2 text-[11px] font-semibold text-green-700 hover:bg-green-100"
                        onClick={() => openQuickUpdate(order)}
                      >
                        <Zap className="mr-1 size-3 text-amber-500" />
                        Quick Update
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full justify-start rounded-md border-gray-200 bg-white px-2 text-[11px] text-gray-700 hover:bg-gray-50"
                        onClick={() => openEdit(order)}
                      >
                        <Pencil className="mr-1 size-3" />
                        Full Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full justify-start rounded-md border-rose-200 bg-rose-50 px-2 text-[11px] text-rose-700 hover:bg-rose-100"
                        disabled={busy}
                        onClick={() => {
                          setCancelReason("")
                          setCancelTarget(order)
                        }}
                      >
                        <XCircle className="mr-1 size-3" />
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-4">
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
                          const unitName = units.find((unit) => unit.id === line.measurement_unit_id)?.abbreviation
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
                                      ? "tone tone-violet"
                                      : "tone tone-blue",
                                  )}
                                >
                                  {isProduct ? "Product" : "Raw Material"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                                {plain(line.quantity)}{unitName ? ` ${unitName}` : ""}
                              </td>
                              {prices ? (
                                <td className="px-4 py-2.5 text-right text-slate-300">
                                  {line.unit_price ? `₹${line.unit_price}` : "–"}
                                </td>
                              ) : null}
                              {prices ? (
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                                  {rupees(subtotal)}
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-start gap-3 text-xs">
                    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                      {/* Vehicle Number pill */}
                      {order.expected_vehicle_plate ? (
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-800">
                          <Truck className="size-3.5" />
                          <span>Vehicle: <strong>{order.expected_vehicle_plate}</strong></span>
                          {can("manage_purchasing") && !locked ? (
                            <button
                              type="button"
                              className="ml-1 text-gray-500 hover:text-gray-900"
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

                      {(() => {
                        const receipts = (order.attachments ?? []).filter((file) => file.kind === "supplier_invoice" || file.kind === "received_slip")
                        const needsReceipt = !order.stock_received && order.status !== "cancelled" && receipts.length === 0
                        return (
                          <div className="grid min-w-56 flex-1 gap-2">
                            <div
                              className={cn(
                                "grid gap-2 rounded-xl border p-3",
                                needsReceipt
                                  ? "border-[var(--scheme)] bg-[var(--scheme-soft)] shadow-[0_0_0_3px_var(--scheme-soft)]"
                                  : "border-gray-100",
                              )}
                            >
                              <SlipUpload label="Receipt" files={receipts} onUploaded={(file) => linkFile(order, file, "supplier_invoice")} required={needsReceipt} />
                            </div>
                            {receiptNotice?.id === order.id ? <Notice variant="error">{receiptNotice.message}</Notice> : null}
                          </div>
                        )
                      })()}
                      {order.stock_received ? (
                        <span className="tone tone-emerald inline-flex items-center gap-1.5 rounded-xl px-3 py-1 font-semibold">
                          <CheckCircle2 className="size-3.5" />
                          <span>Inventory Stock Credited</span>
                          <span>Verified · {(order.attachments ?? []).filter((file) => file.kind === "cargo_photo").length} cargo photos</span>
                          <Link className="font-semibold text-[var(--scheme)]" to={`/accountant/payments?purchase=${order.id}`}>
                            Paid ₹{plain(Number(order.amount_paid || 0).toFixed(2))} · Due ₹{plain(Math.max(0, order.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price || 0), 0) - Number(order.amount_paid || 0)).toFixed(2))}
                          </Link>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Cancelled Notice Banner */}
                  {order.status === "cancelled" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                      <div className="flex items-start gap-2.5">
                        <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                        <div>
                          <p className="font-semibold text-rose-900">Purchase order cancelled</p>
                          <p className="text-[11px] text-rose-700">{order.cancel_reason || "No reason was recorded."}</p>
                        </div>
                      </div>
                      {can("manage_purchasing") ? (
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl border-rose-200 bg-white text-xs text-rose-800" disabled={busy} onClick={() => void restoreOrder(order)}>
                          Restore previous step
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {order.notes ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-700 flex items-start gap-2">
                      <FileText className="size-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>{order.notes}</span>
                    </div>
                  ) : null}
                  </div>
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
              <div className="tone tone-amber grid size-9 place-items-center rounded-xl">
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

              <Field label="Step">
                <select
                  className={selectClass}
                  value={quickForm.status}
                  onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}
                >
                  {FLOW.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
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

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="sm:max-w-md border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle>Cancel this purchase</DialogTitle>
            <DialogDescription>The order stays cancelled until you restore it. Stock is not credited.</DialogDescription>
          </DialogHeader>
          <Field label="Reason" required>
            <textarea
              className="min-h-20 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Why is this arrival being cancelled?"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>Keep the order</Button>
            <Button type="button" className="bg-rose-700 text-white" disabled={busy || !cancelReason.trim()} onClick={() => void confirmCancel()}>Cancel the order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failOrder !== null} onOpenChange={(open) => { if (!open) setFailOrder(null) }}>
        <DialogContent className="sm:max-w-md border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle>Fail this delivery</DialogTitle>
            <DialogDescription>The order stays in delivery and stock is not credited. A short count is not a partial receipt.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <select className="h-10 rounded-xl border border-gray-200 px-3 text-sm" value={failReason} onChange={(event) => setFailReason(event.target.value)}>
              <option value="wrong thickness">wrong thickness</option>
              <option value="rust">rust</option>
              <option value="short count">short count</option>
              <option value="other">other</option>
            </select>
            <Input placeholder="Optional note" value={failNote} onChange={(event) => setFailNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFailOrder(null)}>Cancel</Button>
            <Button type="button" className="bg-rose-700 text-white" disabled={busy} onClick={() => void confirmFail()}>Save the fail</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOrder !== null} onOpenChange={(open) => { if (!open) setReceiveOrder(null) }}>
        <DialogContent className="sm:max-w-lg border-gray-200 bg-white">
          {error ? <Notice variant="error">{error}</Notice> : null}
          <DialogHeader>
            <DialogTitle>Receive Goods</DialogTitle>
            <DialogDescription>The first payment on Payment approval credits the full quantity. This step only keeps the receipt with the bill.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <SlipUpload label="Receipt" required files={invoicePhotos} onUploaded={(file) => setInvoicePhotos((current) => [...current, file])} />
            <Field label="Challan / slip number"><Input value={challanNumber} onChange={(event) => setChallanNumber(event.target.value)} /></Field>
            <Field label="Note from the slip"><Input value={challanNote} onChange={(event) => setChallanNote(event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOrder(null)}>Cancel</Button>
            <Button type="button" disabled={!invoicePhotos.length || busy} onClick={() => void confirmReceive()}>
              Save receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FULL CREATE / EDIT PURCHASE ORDER MODAL */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-3xl border-gray-200 bg-white">
          <FormBusy show={busy} label={editing ? "Updating order" : "Placing orders"} />
          {error ? <Notice variant="error">{error}</Notice> : null}
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="tone tone-emerald grid size-9 place-items-center rounded-xl">
                <ShoppingCart className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  {editing ? "Edit Purchase Order" : "Create Purchase Order"}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {editing
                    ? "Modify ordered items, supplier credentials, or shipment status."
                    : "One arrival, every line on that shipment. Stock is credited once, when the first payment is recorded."}
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
                  <Field label="State" required>
                    <Input required value={supplierForm.state} onChange={(event) => setSupplierForm({ ...supplierForm, state: event.target.value })} />
                  </Field>
                  <Field label="Payment terms">
                    <Input value={supplierForm.payment_terms} placeholder="Against delivery" onChange={(event) => setSupplierForm({ ...supplierForm, payment_terms: event.target.value })} />
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

              <Field label="How it arrived">
                <select
                  className={selectClass}
                  value={header.transport_mode}
                  onChange={(event) => setHeader({ ...header, transport_mode: event.target.value })}
                >
                  <option value="truck">Truck</option>
                  <option value="handcart">Hand cart</option>
                  <option value="staff_vehicle">Staff pickup</option>
                </select>
              </Field>
              {header.transport_mode !== "handcart" ? (
                <Field label="Licence plate" hint={header.transport_mode === "staff_vehicle" ? "Optional" : "Required"}>
                  <Input
                    value={header.expected_vehicle_plate}
                    placeholder="MH12AB1234"
                    onChange={(event) => setHeader({ ...header, expected_vehicle_plate: event.target.value.toUpperCase() })}
                  />
                </Field>
              ) : null}
              {header.transport_mode !== "staff_vehicle" ? (
                <Field label={header.transport_mode === "truck" ? "Driver name" : "Person name"} required>
                  <Input
                    value={header.driver_name}
                    onChange={(event) => setHeader({ ...header, driver_name: event.target.value })}
                  />
                </Field>
              ) : (
                <Field label="Staff member" required>
                  <select
                    className={selectClass}
                    value={header.pickup_user_id}
                    onChange={(event) => setHeader({ ...header, pickup_user_id: event.target.value })}
                  >
                    <option value="">Choose staff</option>
                    {pickupStaff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {[person.first_name, person.last_name].filter(Boolean).join(" ")}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {header.transport_mode === "handcart" ? (
                <Field label="Phone" required>
                  <Input
                    value={header.carrier_phone}
                    onChange={(event) => setHeader({ ...header, carrier_phone: event.target.value })}
                  />
                </Field>
              ) : null}

              <Field label="Notes" className="sm:col-span-2">
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

                  <div className="sm:col-span-2">
                    <SearchSelect
                      label="Item"
                      options={optionsFor()}
                      value={line.item_id}
                      onChange={(item_id) => updateLine(line.key, fillFromItem(line, item_id))}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 sm:col-span-2">
                    {line.item_id
                      ? `${line.kind === "product" ? "Product" : "Raw material"} · ${(line.kind === "product" ? productCategories : materialCategories).find((category) => category.id === line.category_id)?.name || "Uncategorised"} · ${units.find((unit) => unit.id === line.unit_id)?.abbreviation || units.find((unit) => unit.id === line.unit_id)?.name || "unit locked"}`
                      : "Choose the item first. Kind, category, and unit fill in and stay locked."}
                  </p>

                  <Field label="Quantity" required>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      required
                    />
                  </Field>
                  <p className="self-end pb-2 text-sm font-medium text-gray-700">
                    {line.quantity || "0"} {units.find((unit) => unit.id === line.unit_id)?.abbreviation || units.find((unit) => unit.id === line.unit_id)?.name || ""}
                  </p>
                  {prices ? (
                    <Field label="Purchase rate (₹)">
                      <Input
                        value={line.purchase_rate}
                        placeholder="0"
                        onChange={(event) => updateLine(line.key, { purchase_rate: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  {prices ? (
                    <Field label="Selling rate (₹)">
                      <Input
                        value={line.selling_rate}
                        placeholder="0"
                        onChange={(event) => updateLine(line.key, { selling_rate: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  {prices ? (
                    <p className="text-xs text-gray-500 sm:col-span-2">
                      {line.gst
                        ? `GST ${plain(line.gst_percent) || 0}% changes the purchase rate to ${rupees(billedRate(line))}. The selling rate stays as entered.`
                        : "Non-GST leaves the purchase rate unchanged. The selling rate is never adjusted."}
                    </p>
                  ) : null}
                  <Field label="Tax">
                    <select
                      className={selectClass}
                      value={line.gst ? "gst" : "non"}
                      onChange={(event) => updateLine(line.key, { gst: event.target.value === "gst" })}
                    >
                      <option value="non">Non-GST</option>
                      <option value="gst">GST</option>
                    </select>
                  </Field>
                  {line.gst ? (
                    <Field label="GST percent">
                      <Input
                        value={line.gst_percent}
                        onChange={(event) => updateLine(line.key, { gst_percent: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </section>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SlipUpload label="Receipt photo" required files={invoicePhotos} onUploaded={(file) => setInvoicePhotos((current) => [...current, file])} />
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
                {editing ? "Save Purchase Order" : "Record arrival"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
