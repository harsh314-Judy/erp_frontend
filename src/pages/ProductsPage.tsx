import { useEffect, useState, type FormEvent } from "react"
import {
  Boxes,
  Package,
  PlusCircle,
  Search,
  Tag,
} from "lucide-react"

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
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { canSeePrices } from "@/lib/access"

type Named = { id: string; name: string }
type Product = {
  id: string
  product_name: string
  sku_number: string
  product_type: string
  hsn_code: string
  quantity: string
  available?: string | null
  stock_status?: string | null
  sale_price_without_gst?: string | null
  gst_percent: number
  category_id: string
}

export function ProductsPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [rows, setRows] = useState<Product[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [categories, setCategories] = useState<Named[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    product_name: "",
    sku_number: "",
    product_type: "manufactured",
    hsn_code: "",
    gst_percent: "18",
    sale_price_without_gst: "0",
    alert_quantity: "0",
    measurement_unit_id: "",
    category_id: "",
    description: "",
  })

  async function load(search = query) {
    try {
    const [products, unitPage, categoryPage] = await Promise.all([
      api<Page<Product>>(`/api/products?page=1&page_size=100&q=${encodeURIComponent(search)}`),
      api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
      api<Page<Named>>("/api/product-categories?page=1&page_size=100"),
    ])
    setRows(products.items)
    setUnits(unitPage.items)
    setCategories(categoryPage.items)
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

  async function addNamed(path: string, name: string) {
    setError("")
    try {
      await api(path, { method: "POST", body: JSON.stringify({ name }) })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removeCategory(id: string) {
    setError("")
    try {
      await api(`/api/product-categories/${id}`, { method: "DELETE" })
      setForm((current) => ({ ...current, category_id: current.category_id === id ? "" : current.category_id }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function createProduct(event: FormEvent) {
    event.preventDefault()
    setError("")
    await guard(async () => {
    try {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          gst: Number(form.gst_percent) > 0,
          gst_percent: Number(form.gst_percent),
          sale_price_without_gst: form.sale_price_without_gst,
          alert_quantity: form.alert_quantity,
          description: form.description || null,
        }),
      })
      setForm((current) => ({ ...current, product_name: "", sku_number: "", hsn_code: "" }))
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Finished Products Catalog"
        hint="Inventory of manufactured goods and items the plant procures for direct distribution."
        icon={Package}
        badge={`${rows.length} Items`}
        action={
          can("edit_inventory") ? (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                >
                  <PlusCircle className="mr-1.5 size-4" />
                  Add New Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <FormBusy show={busy} />
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Package className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-slate-100">Catalog New Finished Product</DialogTitle>
                  </div>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniCreate label="Unit" onCreate={(name) => addNamed("/api/measurement-units", name)} />
                    <CategoryManager
                      categories={categories}
                      onAdd={(name) => addNamed("/api/product-categories", name)}
                      onRemove={(id) => void removeCategory(id)}
                    />
                  </div>

                  <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => void createProduct(event)}>
                    <Field label="Product Name" required className="sm:col-span-2">
                      <Input
                        value={form.product_name}
                        placeholder="e.g. Stainless Steel Laser Cut Grill"
                        onChange={(event) => setForm({ ...form, product_name: event.target.value })}
                        required
                      />
                    </Field>
                    <Field label="SKU Identifier" required>
                      <Input
                        value={form.sku_number}
                        placeholder="e.g. SS-GRILL-001"
                        onChange={(event) => setForm({ ...form, sku_number: event.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Sourcing Type" required>
                      <select
                        className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"
                        value={form.product_type}
                        onChange={(event) => setForm({ ...form, product_type: event.target.value })}
                      >
                        <option value="manufactured">Manufactured In-House</option>
                        <option value="purchased">Purchased Direct</option>
                        <option value="both">Both (Make or Buy)</option>
                      </select>
                    </Field>
                    <Field label="HSN Code">
                      <Input
                        value={form.hsn_code}
                        placeholder="e.g. 7308"
                        onChange={(event) => setForm({ ...form, hsn_code: event.target.value })}
                      />
                    </Field>
                    <Field label="GST Percentage (%)">
                      <Input
                        value={form.gst_percent}
                        onChange={(event) => setForm({ ...form, gst_percent: event.target.value })}
                      />
                    </Field>
                    {prices ? (
                      <Field label="Base Sale Price (₹ excl. GST)">
                        <Input
                          value={form.sale_price_without_gst}
                          onChange={(event) => setForm({ ...form, sale_price_without_gst: event.target.value })}
                        />
                      </Field>
                    ) : null}
                    <Field label="Reorder Threshold (Alert Qty)">
                      <Input
                        value={form.alert_quantity}
                        onChange={(event) => setForm({ ...form, alert_quantity: event.target.value })}
                      />
                    </Field>
                    <Field label="Measurement Unit">
                      <select
                        className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"
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
                    <Field label="Product Category">
                      <select
                        className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"
                        value={form.category_id}
                        onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Description / Specs" className="sm:col-span-2">
                      <Input
                        value={form.description}
                        placeholder="Specifications, alloy grade, surface finish notes..."
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                      />
                    </Field>
                    <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-3 border-t border-[#262e3f] pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#222938]"
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/15 hover:from-blue-500 hover:to-indigo-500"
                      >
                        Save Product to Catalog
                      </Button>
                    </DialogFooter>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            placeholder="Filter by product name, SKU, or HSN code..."
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
          Search Catalog
        </Button>
      </div>

      {can("edit_inventory") ? (
        <CategoryManager
          categories={categories}
          onAdd={(name) => addNamed("/api/product-categories", name)}
          onRemove={(id) => void removeCategory(id)}
        />
      ) : null}

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* Products Table */}
      {loading ? (
        <PageLoading label="Loading products" variant="table" cols={6} count={5} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Inventory Stock
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">{rows.length} items recorded</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sourcing</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">Physical On Hand</TableHead>
                <TableHead className="text-right">Free / Available</TableHead>
                <TableHead className="text-center">Stock Level</TableHead>
                {prices ? <TableHead className="text-right">Unit Price</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={prices ? 9 : 8} className="py-8 text-center text-xs text-slate-400">
                    No products matching search query.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">{row.product_name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{row.sku_number}</TableCell>
                    <TableCell className="text-slate-300">
                      {categories.find((category) => category.id === row.category_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.product_type} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{row.hsn_code || "–"}</TableCell>
                    <TableCell className="text-right font-medium text-slate-300">{row.quantity}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">
                      {row.available ?? row.quantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.stock_status ?? "normal"} />
                    </TableCell>
                    {prices ? (
                      <TableCell className="text-right font-semibold text-slate-200">
                        {row.sale_price_without_gst ? `₹${row.sale_price_without_gst}` : "–"}
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
    </div>
  )
}

function MiniCreate({ label, onCreate }: { label: string; onCreate: (name: string) => void }) {
  const [name, setName] = useState("")
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onCreate(name.trim())
        setName("")
      }}
    >
      <div className="flex-1">
        <Field label={`Create ${label}`}>
          <Input
            value={name}
            placeholder={`New ${label.toLowerCase()} name...`}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" variant="outline" size="sm" className="rounded-xl h-9">
        <Tag className="mr-1 size-3.5" />
        Add
      </Button>
    </form>
  )
}
