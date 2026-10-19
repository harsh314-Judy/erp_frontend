import { useEffect, useState } from "react"
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  GitCommit,
  PlusCircle,
  Save,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api, errorMessage, type Page } from "@/lib/api"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string }
type Product = { id: string; product_name: string }
type Material = { id: string; name: string }
type Operation = { id: string; name: string }
type Component = {
  id: string
  component_product_id: string | null
  component_raw_material_id: string | null
  quantity_per_unit: string
  item_name: string | null
}

export function BomPage() {
  const { can } = useAuth()
  const [products, setProducts] = useState<Option[]>([])
  const [materials, setMaterials] = useState<Option[]>([])
  const [operations, setOperations] = useState<Option[]>([])
  const [productId, setProductId] = useState("")
  const [recipe, setRecipe] = useState<Component[]>([])
  const [route, setRoute] = useState<string[]>([])
  const [line, setLine] = useState({ kind: "material", itemId: "", quantity: "1" })
  const [error, setError] = useState("")
  const [savedRouteMsg, setSavedRouteMsg] = useState(false)

  useEffect(() => {
    async function load() {
      const [productPage, materialPage, operationPage] = await Promise.all([
        api<Page<Product>>("/api/products?page=1&page_size=100"),
        api<Page<Material>>("/api/raw-materials/?page=1&page_size=100"),
        api<Page<Operation>>("/api/operations?page=1&page_size=100"),
      ])
      const productOptions = productPage.items.map((item) => ({ id: item.id, label: item.product_name }))
      setProducts(productOptions)
      setMaterials(materialPage.items.map((item) => ({ id: item.id, label: item.name })))
      setOperations(operationPage.items.map((item) => ({ id: item.id, label: item.name })))
      setProductId((current) => current || productOptions[0]?.id || "")
    }
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  useEffect(() => {
    if (!productId) return
    Promise.all([
      api<Component[]>(`/api/products/${productId}/recipe`),
      api<string[]>(`/api/products/${productId}/route`),
    ])
      .then(([items, steps]) => {
        setRecipe(items)
        setRoute(steps)
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [productId])

  async function saveRecipe(next: Component[]) {
    const payload = next.map((item) => ({
      component_product_id: item.component_product_id,
      component_raw_material_id: item.component_raw_material_id,
      quantity_per_unit: item.quantity_per_unit,
    }))
    const saved = await api<Component[]>(`/api/products/${productId}/recipe`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
    setRecipe(saved)
  }

  async function addLine() {
    setError("")
    const next = [
      ...recipe,
      {
        id: "new",
        component_product_id: line.kind === "product" ? line.itemId : null,
        component_raw_material_id: line.kind === "material" ? line.itemId : null,
        quantity_per_unit: line.quantity,
        item_name: null,
      },
    ]
    try {
      await saveRecipe(next)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function saveRoute() {
    setError("")
    setSavedRouteMsg(false)
    try {
      const saved = await api<string[]>(`/api/products/${productId}/route`, {
        method: "PUT",
        body: JSON.stringify({ operation_ids: route }),
      })
      setRoute(saved)
      setSavedRouteMsg(true)
      window.setTimeout(() => setSavedRouteMsg(false), 3000)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)

  return (
    <div className="space-y-6">
      <PageTitle
        title="Bill of Materials & Route Mapping"
        hint="Define the precise component recipe per 1 unit of output and sequential floor routing stages."
        icon={ClipboardList}
        badge={selectedProduct?.label ?? "Recipe Manager"}
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* Product Selector Card */}
      <Card className="border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg">
        <div className="max-w-md">
          <SearchSelect
            label="Select Product to Configure"
            options={products}
            value={productId}
            onChange={setProductId}
            required
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Component Recipe Card */}
        <section className="space-y-4 rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-[#262e3f] pb-3">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
              <Boxes className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Component Recipe (Per 1 Unit)</h2>
              <p className="text-[11px] text-slate-400">Auto-consumed when production starts</p>
            </div>
          </div>

          <div className="space-y-2">
            {recipe.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2b3447] bg-[#161a25]/50 p-6 text-center text-xs text-slate-500">
                No components added to this recipe yet.
              </p>
            ) : (
              recipe.map((item, idx) => (
                <div
                  key={item.id === "new" ? idx : item.id}
                  className="flex items-center justify-between rounded-xl border border-[#262e3f] bg-[#161a25] p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-5 place-items-center rounded-md bg-[#262e3f] text-[10px] font-bold text-slate-300">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">{item.item_name ?? "Selected Component"}</span>
                  </div>
                  <span className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-xs font-bold text-blue-300">
                    {item.quantity_per_unit} units required
                  </span>
                </div>
              ))
            )}
          </div>

          {can("edit_inventory") ? (
            <div className="mt-4 rounded-xl border border-[#262e3f] bg-[#161a25] p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Add Component to Recipe
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Item Classification">
                  <select
                    className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-xs font-medium text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    value={line.kind}
                    onChange={(event) => setLine({ ...line, kind: event.target.value, itemId: "" })}
                  >
                    <option value="material">Raw Material (Sheet/Consumable)</option>
                    <option value="product">Sub-Assembly / Product</option>
                  </select>
                </Field>
                <Field label="Quantity Required">
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    value={line.quantity}
                    onChange={(event) => setLine({ ...line, quantity: event.target.value })}
                  />
                </Field>
              </div>
              <SearchSelect
                label="Select Component Item"
                options={line.kind === "product" ? products : materials}
                value={line.itemId}
                onChange={(itemId) => setLine({ ...line, itemId })}
                required
              />
              <Button
                type="button"
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.01] hover:shadow-indigo-500/40"
                onClick={() => void addLine()}
              >
                <PlusCircle className="mr-1.5 size-4" />
                Add Component to Bill of Materials
              </Button>
            </div>
          ) : null}
        </section>

        {/* Manufacturing Operations Route */}
        <section className="space-y-4 rounded-2xl border border-[#262e3f] bg-[#1a1f2b] p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#262e3f] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
                <GitCommit className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Sequential Operation Route</h2>
                <p className="text-[11px] text-slate-400">Plant floor stage flow for this product</p>
              </div>
            </div>
            {savedRouteMsg ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                Route Saved!
              </span>
            ) : null}
          </div>

          {/* Current Ordered Sequence */}
          <div className="space-y-2">
            {route.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2b3447] bg-[#161a25]/50 p-6 text-center text-xs text-slate-500">
                No stages assigned to this route yet. Select operations below.
              </p>
            ) : (
              route.map((id, index) => {
                const op = operations.find((item) => item.id === id)
                return (
                  <div
                    key={`${id}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-6 place-items-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-2xs">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-slate-200">{op?.label ?? id}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Stage {index + 1}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Operations Checkbox Grid */}
          {can("edit_inventory") ? (
            <div className="mt-4 rounded-xl border border-[#262e3f] bg-[#161a25] p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Configure Stages Included in Route
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {operations.map((operation) => {
                  const isChecked = route.includes(operation.id)
                  return (
                    <label
                      key={operation.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium transition-all",
                        isChecked
                          ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200 shadow-2xs font-semibold"
                          : "border-[#262e3f] bg-[#1a1f2b] text-slate-400 hover:border-[#323d54] hover:text-slate-200",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border-[#2b3447] bg-[#151924] text-indigo-600 accent-indigo-600"
                        checked={isChecked}
                        onChange={(event) => {
                          setRoute((current) =>
                            event.target.checked
                              ? [...current, operation.id]
                              : current.filter((id) => id !== operation.id),
                          )
                        }}
                      />
                      <span>{operation.label}</span>
                    </label>
                  )
                })}
              </div>
              <Button
                type="button"
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
                onClick={() => void saveRoute()}
              >
                <Save className="mr-1.5 size-4" />
                Save Operation Sequence
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
