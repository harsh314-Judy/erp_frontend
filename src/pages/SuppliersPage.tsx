import { useEffect, useState, type FormEvent } from "react"
import { Mail, Pencil, Phone, PlusCircle, Truck } from "lucide-react"

import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { Field, Notice, PageTitle } from "@/components/plant-ui"
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
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

type Named = { id: string; name: string }
type Product = { id: string; product_name: string; category_id?: string }
type Supplier = {
  id: string
  supplier_company_name: string
  contact_person_name: string
  phone: string
  email: string
  gst_number: string | null
  address: string
  supply_kind: "materials" | "products" | "both"
  raw_material_ids: string[]
  product_ids: string[]
}

const emptyForm = {
  supplier_company_name: "",
  contact_person_name: "",
  phone: "",
  email: "",
  gst_number: "",
  address: "",
  supply_kind: "both" as Supplier["supply_kind"],
  raw_material_ids: [] as string[],
  product_ids: [] as string[],
}

const selectClass =
  "h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"

export function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<Named[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [materialCategories, setMaterialCategories] = useState<Named[]>([])
  const [productCategories, setProductCategories] = useState<Named[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newMaterial, setNewMaterial] = useState(false)
  const [newProduct, setNewProduct] = useState(false)
  const [draftMaterial, setDraftMaterial] = useState({ name: "", category_id: "", measurement_unit_id: "" })
  const [draftProduct, setDraftProduct] = useState({ product_name: "", sku_number: "", category_id: "", measurement_unit_id: "" })
  const { busy, guard } = useFormBusy()

  async function load() {
    try {
      const [supplierPage, materialPage, productPage, unitPage, materialCategoryPage, productCategoryPage] = await Promise.all([
        api<Page<Supplier>>("/api/suppliers?page=1&page_size=100"),
        api<Page<Named>>("/api/raw-materials/?page=1&page_size=500&brief=true"),
        api<Page<Product>>("/api/products?page=1&page_size=500&brief=true"),
        api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
        api<Page<Named>>("/api/raw-materials/categories?page=1&page_size=100"),
        api<Page<Named>>("/api/product-categories?page=1&page_size=100"),
      ])
      setRows(supplierPage.items)
      setMaterials(materialPage.items)
      setProducts(productPage.items)
      setUnits(unitPage.items)
      setMaterialCategories(materialCategoryPage.items)
      setProductCategories(productCategoryPage.items)
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(row: Supplier) {
    setEditing(row)
    setForm({
      supplier_company_name: row.supplier_company_name,
      contact_person_name: row.contact_person_name,
      phone: row.phone,
      email: row.email,
      gst_number: row.gst_number ?? "",
      address: row.address,
      supply_kind: row.supply_kind,
      raw_material_ids: row.raw_material_ids,
      product_ids: row.product_ids,
    })
    setShowForm(true)
  }

  function setKind(supply_kind: Supplier["supply_kind"]) {
    setForm((current) => ({
      ...current,
      supply_kind,
      raw_material_ids: supply_kind === "products" ? [] : current.raw_material_ids,
      product_ids: supply_kind === "materials" ? [] : current.product_ids,
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError("")
    const body = {
      ...form,
      gst_number: form.gst_number || null,
      is_gst: Boolean(form.gst_number),
      raw_material_ids: form.supply_kind === "products" ? [] : form.raw_material_ids,
      product_ids: form.supply_kind === "materials" ? [] : form.product_ids,
    }
    await guard(async () => {
      try {
        if (editing) {
          await api(`/api/suppliers/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        } else {
          await api("/api/suppliers", { method: "POST", body: JSON.stringify(body) })
        }
        setShowForm(false)
        setForm(emptyForm)
        setEditing(null)
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function addMaterial() {
    if (!draftMaterial.name.trim() || !draftMaterial.category_id || !draftMaterial.measurement_unit_id) {
      setError("Name, category, and unit are required for a new raw material.")
      return
    }
    await guard(async () => {
      try {
        const created = await api<Named>("/api/raw-materials/", {
          method: "POST",
          body: JSON.stringify({
            name: draftMaterial.name.trim(),
            kind: "other",
            quantity: "0",
            alert_quantity: "0",
            measurement_unit_id: draftMaterial.measurement_unit_id,
            category_id: draftMaterial.category_id,
            supplier_id: null,
            price: "0",
            purchase_price: "0",
            description: null,
          }),
        })
        setForm((current) => ({ ...current, raw_material_ids: [...current.raw_material_ids, created.id] }))
        setDraftMaterial((current) => ({ ...current, name: "" }))
        setNewMaterial(false)
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function addProduct() {
    if (!draftProduct.product_name.trim() || !draftProduct.sku_number.trim() || !draftProduct.category_id || !draftProduct.measurement_unit_id) {
      setError("Name, SKU, category, and unit are required for a new product.")
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
        setForm((current) => ({ ...current, product_ids: [...current.product_ids, created.id] }))
        setDraftProduct((current) => ({ ...current, product_name: "", sku_number: "" }))
        setNewProduct(false)
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  function labels(ids: string[], options: { id: string; label: string }[]) {
    const names = ids.map((id) => options.find((option) => option.id === id)?.label).filter(Boolean)
    return names.length ? names.join(", ") : "None yet"
  }

  const materialOptions = materials.map((item) => ({ id: item.id, label: item.name }))
  const productOptions = products.map((item) => ({ id: item.id, label: item.product_name }))

  return (
    <div className="space-y-6">
      <PageTitle
        title="Supplier Vendor Directory"
        hint="Record whether each supplier sells raw materials, products, or both."
        icon={Truck}
        badge={`${rows.length} Vendors`}
        action={
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                onClick={openCreate}
              >
                <PlusCircle className="mr-1.5 size-4" />
                Register Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <FormBusy show={busy} />
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                    <Truck className="size-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-white">
                    {editing ? "Edit Supplier" : "Register New Supplier Partner"}
                  </DialogTitle>
                </div>
              </DialogHeader>
              <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
                <Field label="Supplier Company Name" required className="sm:col-span-2">
                  <Input
                    required
                    placeholder="e.g. Jindal Steel & Power Ltd"
                    value={form.supplier_company_name}
                    onChange={(event) => setForm({ ...form, supplier_company_name: event.target.value })}
                  />
                </Field>
                <Field label="Key Contact Person" required>
                  <Input
                    required
                    value={form.contact_person_name}
                    onChange={(event) => setForm({ ...form, contact_person_name: event.target.value })}
                  />
                </Field>
                <Field label="Contact Phone" required>
                  <Input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </Field>
                <Field label="Email Address" required>
                  <Input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="GSTIN Number">
                  <Input value={form.gst_number} onChange={(event) => setForm({ ...form, gst_number: event.target.value })} />
                </Field>
                <Field label="What this supplier sells" required className="sm:col-span-2">
                  <select className={selectClass} value={form.supply_kind} onChange={(event) => setKind(event.target.value as Supplier["supply_kind"])}>
                    <option value="materials">Raw materials only</option>
                    <option value="products">Products only</option>
                    <option value="both">Raw materials and products</option>
                  </select>
                </Field>
                {form.supply_kind !== "products" ? (
                  <div className="space-y-3 sm:col-span-2">
                    <CatalogPicker
                      label="Raw materials we can buy"
                      options={materialOptions}
                      selected={form.raw_material_ids}
                      onChange={(raw_material_ids) => setForm({ ...form, raw_material_ids })}
                    />
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setNewMaterial((open) => !open)}>
                      {newMaterial ? "Hide new raw material" : "Add a new raw material"}
                    </Button>
                    {newMaterial ? (
                      <div className="grid gap-4 rounded-2xl border border-amber-500/20 bg-[#121826] p-5 sm:grid-cols-2">
                        <p className="text-base font-semibold text-slate-100 sm:col-span-2">New raw material</p>
                        <Field label="Name" required className="sm:col-span-2">
                          <Input value={draftMaterial.name} onChange={(event) => setDraftMaterial({ ...draftMaterial, name: event.target.value })} />
                        </Field>
                        <Field label="Category" required>
                          <select className={selectClass} value={draftMaterial.category_id} onChange={(event) => setDraftMaterial({ ...draftMaterial, category_id: event.target.value })}>
                            {materialCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Unit" required>
                          <select className={selectClass} value={draftMaterial.measurement_unit_id} onChange={(event) => setDraftMaterial({ ...draftMaterial, measurement_unit_id: event.target.value })}>
                            {units.map((unit) => (
                              <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Button type="button" className="rounded-xl sm:col-span-2" disabled={busy} onClick={() => void addMaterial()}>
                          Save raw material and select it
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {form.supply_kind !== "materials" ? (
                  <div className="space-y-3 sm:col-span-2">
                    <CatalogPicker
                      label="Products we can buy"
                      options={productOptions}
                      selected={form.product_ids}
                      onChange={(product_ids) => setForm({ ...form, product_ids })}
                    />
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setNewProduct((open) => !open)}>
                      {newProduct ? "Hide new product" : "Add a new product"}
                    </Button>
                    {newProduct ? (
                      <div className="grid gap-4 rounded-2xl border border-blue-500/20 bg-[#121826] p-5 sm:grid-cols-2">
                        <p className="text-base font-semibold text-slate-100 sm:col-span-2">New product</p>
                        <Field label="Product name" required>
                          <Input value={draftProduct.product_name} onChange={(event) => setDraftProduct({ ...draftProduct, product_name: event.target.value })} />
                        </Field>
                        <Field label="SKU" required>
                          <Input value={draftProduct.sku_number} onChange={(event) => setDraftProduct({ ...draftProduct, sku_number: event.target.value })} />
                        </Field>
                        <Field label="Category" required>
                          <select className={selectClass} value={draftProduct.category_id} onChange={(event) => setDraftProduct({ ...draftProduct, category_id: event.target.value })}>
                            {productCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Unit" required>
                          <select className={selectClass} value={draftProduct.measurement_unit_id} onChange={(event) => setDraftProduct({ ...draftProduct, measurement_unit_id: event.target.value })}>
                            {units.map((unit) => (
                              <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Button type="button" className="rounded-xl sm:col-span-2" disabled={busy} onClick={() => void addProduct()}>
                          Save product and select it
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Field label="Plant / Billing Address" required className="sm:col-span-2">
                  <Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                </Field>
                <DialogFooter className="mt-3 flex items-center justify-end gap-2 border-t border-[#262e3f] pt-4 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white"
                  >
                    Save Supplier
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? <PageLoading label="Loading suppliers" variant="table" cols={5} count={5} /> : null}

      {error ? <Notice variant="error">{error}</Notice> : null}

      {!loading ? (

      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Registered Vendor Accounts</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Direct Contact</TableHead>
                <TableHead>Supplies</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No suppliers registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">
                      <div>
                        <p>{row.supplier_company_name}</p>
                        <p className="text-xs font-normal text-slate-400">{row.address}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-300">{row.contact_person_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1.5 text-blue-400">
                          <Phone className="size-3" />
                          {row.phone}
                        </a>
                        <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1.5 text-slate-400">
                          <Mail className="size-3" />
                          {row.email}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-slate-300">
                      <p className="font-semibold capitalize text-slate-200">
                        {row.supply_kind === "both" ? "Materials and products" : row.supply_kind === "materials" ? "Raw materials" : "Products"}
                      </p>
                      {row.supply_kind !== "products" ? <p>Materials: {labels(row.raw_material_ids, materialOptions)}</p> : null}
                      {row.supply_kind !== "materials" ? <p>Products: {labels(row.product_ids, productOptions)}</p> : null}
                      {row.gst_number ? <p className="mt-1 font-mono text-emerald-400">{row.gst_number}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(row)}>
                        <Pencil className="mr-1 size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      ) : null}
    </div>
  )
}

function CatalogPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-medium text-slate-200">{label}</p>
      <div className="form-scroll max-h-44 space-y-1 overflow-auto rounded-xl border border-[#2b3447] bg-[#151924] p-2">
        {options.length === 0 ? (
          <p className="px-1 text-xs text-slate-500">Nothing to choose yet. You can link items after they are created.</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-[#222938]">
              <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} />
              {option.label}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
