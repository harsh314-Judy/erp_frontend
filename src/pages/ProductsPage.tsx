import { useEffect, useState, type FormEvent } from "react"
import {
  Boxes,
  Eye,
  Package,
  Pencil,
  PlusCircle,
  Search,
  Tag,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { ProductRecipeEditor, type Option, type RecipeLine } from "@/components/ProductRecipeEditor"
import { CategoryManager, Field, Notice, PageTitle, StatusBadge } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { canSeePrices } from "@/lib/access"
import { cn } from "@/lib/utils"

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
  alert_quantity: string
  measurement_unit_id: string
  category_id: string
  description: string | null
}
type Component = RecipeLine & { id: string }
type Mode = "create" | "edit" | "view"

const selectClass =
  "h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

const blankForm = {
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
}

export function ProductsPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const editor = can("edit_inventory")
  const [rows, setRows] = useState<Product[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [categories, setCategories] = useState<Named[]>([])
  const [materials, setMaterials] = useState<Option[]>([])
  const [productOptions, setProductOptions] = useState<Option[]>([])
  const [operations, setOperations] = useState<Option[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [mode, setMode] = useState<Mode | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [recipeOn, setRecipeOn] = useState(true)
  const [recipeTouched, setRecipeTouched] = useState(false)
  const [lines, setLines] = useState<RecipeLine[]>([])
  const [route, setRoute] = useState<string[]>([])

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
    } finally {
      setLoading(false)
    }
  }

  function loadRecipeOptions() {
    return Promise.all([
      api<Page<Named>>("/api/raw-materials/?page=1&page_size=100&brief=true"),
      api<Page<Product>>("/api/products?page=1&page_size=100&brief=true"),
      api<Page<Named>>("/api/operations?page=1&page_size=100"),
    ]).then(([materialPage, productPage, operationPage]) => {
      setMaterials(materialPage.items.map((item) => ({ id: item.id, label: item.name })))
      setProductOptions(productPage.items.map((item) => ({ id: item.id, label: item.product_name })))
      setOperations(operationPage.items.map((item) => ({ id: item.id, label: item.name })))
    })
  }

  useEffect(() => {
    void load("").catch((caught) => setError(errorMessage(caught)))
    loadRecipeOptions().catch((caught) => setError(errorMessage(caught)))
  }, [])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      measurement_unit_id: current.measurement_unit_id || units[0]?.id || "",
      category_id: current.category_id || categories[0]?.id || "",
    }))
  }, [units, categories])

  async function addNamed(path: string, name: string) {
    setError("")
    try {
      const created = await api<{ id: string }>(path, { method: "POST", body: JSON.stringify({ name }) })
      await load()
      return created.id
    } catch (caught) {
      setError(errorMessage(caught))
      return ""
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

  function openCreate() {
    setFormError("")
    setEditingId(null)
    setForm({
      ...blankForm,
      measurement_unit_id: units[0]?.id ?? "",
      category_id: categories[0]?.id ?? "",
    })
    setLines([])
    setRoute([])
    setRecipeOn(true)
    setRecipeTouched(false)
    setMode("create")
  }

  async function openExisting(row: Product, next: Mode) {
    setFormError("")
    setEditingId(row.id)
    setForm({
      product_name: row.product_name,
      sku_number: row.sku_number,
      product_type: row.product_type,
      hsn_code: row.hsn_code ?? "",
      gst_percent: String(row.gst_percent),
      sale_price_without_gst: row.sale_price_without_gst ?? "0",
      alert_quantity: row.alert_quantity,
      measurement_unit_id: row.measurement_unit_id,
      category_id: row.category_id,
      description: row.description ?? "",
    })
    setLines([])
    setRoute([])
    setRecipeOn(row.product_type !== "purchased")
    setRecipeTouched(true)
    setMode(next)
    try {
      const [recipe, steps] = await Promise.all([
        api<Component[]>(`/api/products/${row.id}/recipe`),
        api<string[]>(`/api/products/${row.id}/route`),
      ])
      setLines(
        recipe.map((item) => ({
          component_product_id: item.component_product_id,
          component_raw_material_id: item.component_raw_material_id,
          quantity_per_unit: item.quantity_per_unit,
        })),
      )
      setRoute(steps)
      setRecipeOn(recipe.length > 0 || steps.length > 0 || row.product_type !== "purchased")
    } catch (caught) {
      setFormError(errorMessage(caught))
    }
  }

  function changeType(value: string) {
    setForm({ ...form, product_type: value })
    if (!recipeTouched) setRecipeOn(value !== "purchased")
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    setFormError("")
    if (!form.measurement_unit_id || !form.category_id) {
      setFormError("Add a measurement unit and a category before saving this product.")
      return
    }
    const gstPercent = Number(form.gst_percent)
    if (!Number.isFinite(gstPercent)) {
      setFormError("GST percent must be a number.")
      return
    }
    if (recipeOn && lines.some((line) => !(Number(line.quantity_per_unit) > 0))) {
      setFormError("Every recipe input needs a quantity above zero.")
      return
    }
    await guard(async () => {
      try {
        const body = JSON.stringify({
          ...form,
          gst: gstPercent > 0,
          gst_percent: gstPercent,
          sale_price_without_gst: form.sale_price_without_gst.trim() || "0",
          alert_quantity: form.alert_quantity.trim() || "0",
          description: form.description || null,
        })
        const saved =
          mode === "edit" && editingId
            ? await api<Product>(`/api/products/${editingId}`, { method: "PATCH", body })
            : await api<Product>("/api/products", { method: "POST", body })
        if (recipeOn || mode === "edit") {
          await api(`/api/products/${saved.id}/recipe`, {
            method: "PUT",
            body: JSON.stringify(recipeOn ? lines : []),
          })
          await api(`/api/products/${saved.id}/route`, {
            method: "PUT",
            body: JSON.stringify({ operation_ids: recipeOn ? route : [] }),
          })
        }
        setMode(null)
        await load()
        await loadRecipeOptions()
      } catch (caught) {
        setFormError(errorMessage(caught))
      }
    })
  }

  const readOnly = mode === "view"
  const title =
    mode === "create" ? "Add New Product" : mode === "edit" ? `Edit ${form.product_name}` : form.product_name

  return (
    <div className="space-y-6">
      <PageTitle
        title="Finished Products Catalog"
        hint="Products, their recipe for one unit, and the stage route the floor follows."
        icon={Package}
        badge={`${rows.length} Items`}
        action={
          editor ? (
            <Button
              type="button"
              className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
              onClick={openCreate}
            >
              <PlusCircle className="mr-1.5 size-4" />
              Add New Product
            </Button>
          ) : null
        }
      />

      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : setMode(null))}>
        <DialogContent className="sm:max-w-4xl border-gray-200 bg-white">
          <FormBusy show={busy} />
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-600">
                <Package className="size-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {readOnly ? null : (
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniCreate
                  label="Unit"
                  onCreate={async (name) => {
                    const id = await addNamed("/api/measurement-units", name)
                    if (id) setForm((current) => ({ ...current, measurement_unit_id: id }))
                  }}
                />
                <CategoryManager
                  categories={categories}
                  onAdd={async (name) => {
                    const id = await addNamed("/api/product-categories", name)
                    if (id) setForm((current) => ({ ...current, category_id: id }))
                  }}
                  onRemove={(id) => void removeCategory(id)}
                />
              </div>
            )}

            {formError ? <Notice variant="error">{formError}</Notice> : null}

            <form onSubmit={(event) => void saveProduct(event)}>
              <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-3">
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
                    className={selectClass}
                    value={form.product_type}
                    onChange={(event) => changeType(event.target.value)}
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
                <Field label="Product Category">
                  <select
                    className={selectClass}
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

                <div className="space-y-3 border-t border-gray-100 pt-4 sm:col-span-3">
                  <label className="flex cursor-pointer items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Made in-house (recipe and route)
                      </span>
                      <span className="block text-xs text-gray-500">
                        {recipeOn
                          ? "Production jobs for this product hold these inputs and follow these stages."
                          : mode === "edit"
                            ? "Off: saving clears this product's recipe and route."
                            : "Off: this product is bought ready-made and has no recipe."}
                      </span>
                    </span>
                    <span className="relative mt-0.5 inline-flex shrink-0">
                      <input
                        type="checkbox"
                        role="switch"
                        className="peer sr-only"
                        checked={recipeOn}
                        onChange={(event) => {
                          setRecipeOn(event.target.checked)
                          setRecipeTouched(true)
                        }}
                      />
                      <span
                        className={cn(
                          "h-6 w-11 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-green-500/50",
                          recipeOn ? "bg-green-600" : "bg-gray-200",
                        )}
                      />
                      <span
                        className={cn(
                          "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                          recipeOn && "translate-x-5",
                        )}
                      />
                    </span>
                  </label>

                  {recipeOn ? (
                    <>
                      {lines.length === 0 && !readOnly ? (
                        <Notice variant="warning">
                          No recipe inputs yet, so a production job will not hold any stock for this
                          product. You can save now and add them later.
                        </Notice>
                      ) : null}
                      <ProductRecipeEditor
                        lines={lines}
                        route={route}
                        materials={materials}
                        products={productOptions.filter((item) => item.id !== editingId)}
                        operations={operations}
                        readOnly={readOnly}
                        onLinesChange={setLines}
                        onRouteChange={setRoute}
                      />
                    </>
                  ) : null}
                </div>
              </fieldset>

              <DialogFooter className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => setMode(null)}
                >
                  {readOnly ? "Close" : "Cancel"}
                </Button>
                {readOnly ? null : (
                  <Button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-green-600 font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-all"
                  >
                    {mode === "edit" ? "Save Changes" : "Save Product to Catalog"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            placeholder="Filter by product name, SKU, or HSN code..."
            className="rounded-xl border-gray-200 bg-white pl-9 pr-3 text-gray-900 shadow-xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load()
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 shadow-xs"
          onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}
        >
          Search Catalog
        </Button>
      </div>

      {editor ? (
        <CategoryManager
          categories={categories}
          onAdd={(name) => addNamed("/api/product-categories", name)}
          onRemove={(id) => void removeCategory(id)}
        />
      ) : null}

      {error ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading products" variant="table" cols={6} count={5} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-green-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Inventory Stock
              </span>
            </div>
            <span className="text-xs font-semibold text-gray-500">{rows.length} items recorded</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-gray-50/30">
                  <TableHead className="font-semibold text-gray-600">Product</TableHead>
                  <TableHead className="font-semibold text-gray-600">SKU</TableHead>
                  <TableHead className="font-semibold text-gray-600">Category</TableHead>
                  <TableHead className="font-semibold text-gray-600">Sourcing</TableHead>
                  <TableHead className="font-semibold text-gray-600">HSN</TableHead>
                  <TableHead className="text-right font-semibold text-gray-600">Physical On Hand</TableHead>
                  <TableHead className="text-right font-semibold text-gray-600">Free / Available</TableHead>
                  <TableHead className="text-center font-semibold text-gray-600">Stock Level</TableHead>
                  {prices ? <TableHead className="text-right font-semibold text-gray-600">Unit Price</TableHead> : null}
                  <TableHead className="text-right font-semibold text-gray-600">Recipe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={prices ? 10 : 9} className="py-8 text-center text-xs text-gray-400">
                      No products matching search query.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors">
                      <TableCell className="font-semibold text-gray-900">{row.product_name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{row.sku_number}</TableCell>
                      <TableCell className="text-gray-600">
                        {categories.find((category) => category.id === row.category_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.product_type} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{row.hsn_code || "–"}</TableCell>
                      <TableCell className="text-right font-medium text-gray-700">{row.quantity}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {row.available ?? row.quantity}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={row.stock_status ?? "normal"} />
                      </TableCell>
                      {prices ? (
                        <TableCell className="text-right font-semibold text-gray-900">
                          {row.sale_price_without_gst ? `₹${row.sale_price_without_gst}` : "–"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                          onClick={() => void openExisting(row, editor ? "edit" : "view")}
                        >
                          {editor ? <Pencil className="mr-1 size-3.5" /> : <Eye className="mr-1 size-3.5" />}
                          {editor ? "Edit" : "View"}
                        </Button>
                      </TableCell>
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
      <Button type="submit" variant="outline" size="sm" className="h-9 rounded-xl">
        <Tag className="mr-1 size-3.5" />
        Add
      </Button>
    </form>
  )
}
