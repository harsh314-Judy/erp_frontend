import { useEffect, useState, type FormEvent } from "react"
import { Boxes, Pencil, PlusCircle, Search } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { CategoryManager, Field, Notice, PageTitle, StatusBadge } from "@/components/plant-ui"
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
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { cn } from "@/lib/utils"

type Named = { id: string; name: string }
type Supplier = { id: string; supplier_company_name: string; supply_kind: string }
type Material = {
  id: string
  name: string
  kind: string
  quantity: string
  alert_quantity: string
  available?: string | null
  stock_status?: string | null
  purchase_price?: string | null
  description: string | null
  measurement_unit_id: string
  category_id: string | null
  supplier_id: string | null
}

const selectClass =
  "h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

const emptyForm = {
  name: "",
  kind: "sheet",
  quantity: "0",
  purchase_price: "0",
  alert_quantity: "0",
  measurement_unit_id: "",
  category_id: "",
  supplier_id: "",
  description: "",
}

export function MaterialsPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [rows, setRows] = useState<Material[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [categories, setCategories] = useState<Named[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [form, setForm] = useState(emptyForm)

  async function load(search = query) {
    try {
    const [materials, unitPage, categoryPage, supplierPage] = await Promise.all([
      api<Page<Material>>(`/api/raw-materials/?page=1&page_size=100&q=${encodeURIComponent(search)}`),
      api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
      api<Page<Named>>("/api/raw-materials/categories?page=1&page_size=100"),
      api<Page<Supplier>>("/api/suppliers?page=1&page_size=100"),
    ])
    setRows(materials.items)
    setUnits(unitPage.items)
    setCategories(categoryPage.items)
    setSuppliers(supplierPage.items.filter((item) => item.supply_kind !== "products"))
    setForm((current) => ({
      ...current,
      measurement_unit_id: current.measurement_unit_id || unitPage.items[0]?.id || "",
      category_id: current.category_id || categoryPage.items[0]?.id || "",
    }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load("").catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function addCategory(name: string) {
    setError("")
    try {
      const created = await api<Named>("/api/raw-materials/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      setForm((current) => ({ ...current, category_id: created.id }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removeCategory(id: string) {
    setError("")
    try {
      await api(`/api/raw-materials/categories/${id}`, { method: "DELETE" })
      setForm((current) => ({ ...current, category_id: current.category_id === id ? "" : current.category_id }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  function payload() {
    return {
      name: form.name,
      kind: form.kind,
      quantity: form.quantity,
      alert_quantity: form.alert_quantity,
      measurement_unit_id: form.measurement_unit_id,
      category_id: form.category_id,
      supplier_id: form.supplier_id || null,
      price: form.purchase_price,
      purchase_price: form.purchase_price,
      description: form.description || null,
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    await guard(async () => {
      try {
        await api("/api/raw-materials/", { method: "POST", body: JSON.stringify(payload()) })
        setForm((current) => ({ ...current, name: "", description: "", quantity: "0" }))
        setShowCreate(false)
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setError("")
    await guard(async () => {
      try {
        await api(`/api/raw-materials/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload()) })
        setEditing(null)
        await load()
      } catch (caught) {
        setError(errorMessage(caught))
      }
    })
  }

  function openEdit(row: Material) {
    setForm({
      name: row.name,
      kind: row.kind,
      quantity: row.quantity,
      purchase_price: row.purchase_price ?? "0",
      alert_quantity: row.alert_quantity ?? "0",
      measurement_unit_id: row.measurement_unit_id,
      category_id: row.category_id ?? "",
      supplier_id: row.supplier_id ?? "",
      description: row.description ?? "",
    })
    setEditing(row)
  }

  const kindColors: Record<string, string> = {
    sheet: "bg-emerald-50 text-emerald-700 border-emerald-200",
    polish: "bg-blue-50 text-blue-700 border-blue-200",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  }

  const categoryName = (id: string | null) => categories.find((item) => item.id === id)?.name ?? "—"
  const supplierName = (id: string | null) =>
    suppliers.find((item) => item.id === id)?.supplier_company_name ?? "None"

  return (
    <div className="space-y-6">
      <PageTitle
        title="Raw Materials & Stock"
        hint="Raw steel coils, sheets, polishing consumables, and coatings used across floor operations."
        icon={Boxes}
        badge={`${rows.length} Materials`}
        action={
          can("edit_inventory") ? (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  Add Raw Material
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl border-gray-200 bg-white">
                <FormBusy show={busy} />
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-600">
                      <Boxes className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-gray-900">Register Raw Material Item</DialogTitle>
                  </div>
                </DialogHeader>
                <MaterialForm
                  form={form}
                  setForm={setForm}
                  units={units}
                  categories={categories}
                  suppliers={suppliers}
                  prices={prices}
                  submitLabel="Save Material to Inventory"
                  onSubmit={create}
                  onCancel={() => setShowCreate(false)}
                  onAddCategory={addCategory}
                  onRemoveCategory={removeCategory}
                  busy={busy}
                />
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {can("edit_inventory") ? (
        <CategoryManager categories={categories} onAdd={addCategory} onRemove={(id) => void removeCategory(id)} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            placeholder="Search raw materials, alloy grades, kinds..."
            className="pl-9 pr-3 rounded-xl bg-white border-gray-200 text-gray-900 shadow-xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load()
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-semibold shadow-xs"
          onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}
        >
          Search Materials
        </Button>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading raw materials" variant="table" cols={7} count={6} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Raw Materials Inventory</span>
          </div>
          <span className="text-xs font-semibold text-gray-500">{rows.length} stock items</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-100 bg-gray-50/30">
                <TableHead className="font-semibold text-gray-600">Material Name</TableHead>
                <TableHead className="font-semibold text-gray-600">Category</TableHead>
                <TableHead className="font-semibold text-gray-600">Supplier</TableHead>
                <TableHead className="font-semibold text-gray-600">Classification</TableHead>
                <TableHead className="text-right font-semibold text-gray-600">Physical On Hand</TableHead>
                <TableHead className="text-right font-semibold text-gray-600">Free / Available</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Stock Level</TableHead>
                {prices ? <TableHead className="text-right font-semibold text-gray-600">Purchase Price</TableHead> : null}
                {can("edit_inventory") ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7 + (prices ? 1 : 0) + (can("edit_inventory") ? 1 : 0)} className="py-8 text-center text-xs text-gray-400">
                    No raw materials match the query.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors">
                    <TableCell className="font-semibold text-gray-900">
                      <div>
                        <p>{row.name}</p>
                        {row.description ? <p className="text-xs font-normal text-gray-500">{row.description}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{categoryName(row.category_id)}</TableCell>
                    <TableCell className="text-gray-600">{supplierName(row.supplier_id)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold capitalize",
                          kindColors[row.kind] || kindColors.other,
                        )}
                      >
                        {row.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-700">{row.quantity}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{row.available ?? row.quantity}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.stock_status ?? "normal"} />
                    </TableCell>
                    {prices ? (
                      <TableCell className="text-right font-semibold text-gray-900">
                        {row.purchase_price ? `₹${row.purchase_price}` : "–"}
                      </TableCell>
                    ) : null}
                    {can("edit_inventory") ? (
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100" onClick={() => openEdit(row)}>
                          <Pencil className="mr-1 size-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl border-gray-200 bg-white">
          <FormBusy show={busy} />
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Edit raw material</DialogTitle>
          </DialogHeader>
          <MaterialForm
            form={form}
            setForm={setForm}
            units={units}
            categories={categories}
            suppliers={suppliers}
            prices={prices}
            submitLabel="Save changes"
            onSubmit={saveEdit}
            onCancel={() => setEditing(null)}
            onAddCategory={addCategory}
            onRemoveCategory={removeCategory}
            busy={busy}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MaterialForm({
  form,
  setForm,
  units,
  categories,
  suppliers,
  prices,
  submitLabel,
  onSubmit,
  onCancel,
  onAddCategory,
  onRemoveCategory,
  busy,
}: {
  form: typeof emptyForm
  setForm: (value: typeof emptyForm) => void
  units: Named[]
  categories: Named[]
  suppliers: Supplier[]
  prices: boolean
  submitLabel: string
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
  onAddCategory: (name: string) => void
  onRemoveCategory: (id: string) => void
  busy: boolean
}) {
  return (
    <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
      <div className="sm:col-span-2">
        <CategoryManager categories={categories} onAdd={onAddCategory} onRemove={onRemoveCategory} />
      </div>
      <Field label="Material Name" required className="sm:col-span-2">
        <Input
          value={form.name}
          placeholder="e.g. SS 304 Sheet 2mm (8x4 ft)"
          required
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Category" required>
        <select
          className={selectClass}
          required
          value={form.category_id}
          onChange={(event) => setForm({ ...form, category_id: event.target.value })}
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Supplier" hint="None leaves it unlinked">
        <select
          className={selectClass}
          value={form.supplier_id}
          onChange={(event) => setForm({ ...form, supplier_id: event.target.value })}
        >
          <option value="">None</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.supplier_company_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Material Classification" required>
        <select className={selectClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
          <option value="sheet">Steel Sheet / Plate / Coil</option>
          <option value="polish">Polishing Paste / Compound</option>
          <option value="color">Powder Coat / Colour Finish</option>
          <option value="other">Hardware / Fastener / Other</option>
        </select>
      </Field>
      <Field label="Unit of Measurement">
        <select
          className={selectClass}
          value={form.measurement_unit_id}
          onChange={(event) => setForm({ ...form, measurement_unit_id: event.target.value })}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity on hand" required>
        <Input
          type="number"
          min="0"
          step="0.001"
          required
          value={form.quantity}
          onChange={(event) => setForm({ ...form, quantity: event.target.value })}
        />
      </Field>
      <Field label="Reorder Threshold (Alert Qty)">
        <Input value={form.alert_quantity} onChange={(event) => setForm({ ...form, alert_quantity: event.target.value })} />
      </Field>
      {prices ? (
        <Field label="Procurement Price (₹/unit)">
          <Input value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} />
        </Field>
      ) : null}
      <Field label="Specification Notes" className="sm:col-span-2">
        <Input
          placeholder="Alloy specifications, standard thickness, supplier code..."
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </Field>
      <DialogFooter className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 sm:col-span-2">
        <Button type="button" variant="outline" className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
