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
  "h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"

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
    sheet: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    polish: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    other: "bg-slate-800 text-slate-300 border-slate-700",
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
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  Add Raw Material
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <FormBusy show={busy} />
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Boxes className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-white">Register Raw Material Item</DialogTitle>
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
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            placeholder="Search raw materials, alloy grades, kinds..."
            className="pl-9 pr-3 rounded-xl bg-[#1a1f2b] border-[#2b3447] text-slate-200 shadow-xs"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load()
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-[#2b3447] bg-[#1a1f2b] text-slate-300 hover:bg-[#222938] hover:border-slate-600 font-semibold"
          onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}
        >
          Search Materials
        </Button>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading raw materials" variant="table" cols={7} count={6} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Raw Materials Inventory</span>
          </div>
          <span className="text-xs font-semibold text-slate-400">{rows.length} stock items</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead className="text-right">Physical On Hand</TableHead>
                <TableHead className="text-right">Free / Available</TableHead>
                <TableHead className="text-center">Stock Level</TableHead>
                {prices ? <TableHead className="text-right">Purchase Price</TableHead> : null}
                {can("edit_inventory") ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7 + (prices ? 1 : 0) + (can("edit_inventory") ? 1 : 0)} className="py-8 text-center text-xs text-slate-400">
                    No raw materials match the query.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">
                      <div>
                        <p>{row.name}</p>
                        {row.description ? <p className="text-xs font-normal text-slate-400">{row.description}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{categoryName(row.category_id)}</TableCell>
                    <TableCell className="text-slate-300">{supplierName(row.supplier_id)}</TableCell>
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
                    <TableCell className="text-right font-medium text-slate-300">{row.quantity}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">{row.available ?? row.quantity}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.stock_status ?? "normal"} />
                    </TableCell>
                    {prices ? (
                      <TableCell className="text-right font-semibold text-slate-200">
                        {row.purchase_price ? `₹${row.purchase_price}` : "–"}
                      </TableCell>
                    ) : null}
                    {can("edit_inventory") ? (
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(row)}>
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
        <DialogContent className="sm:max-w-2xl">
          <FormBusy show={busy} />
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Edit raw material</DialogTitle>
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
      <DialogFooter className="mt-3 flex items-center justify-end gap-2 border-t border-[#262e3f] pt-4 sm:col-span-2">
        <Button type="button" variant="outline" className="border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#222938]" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/15 hover:from-blue-500 hover:to-indigo-500"
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
