import { useEffect, useState } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage, type Page } from "@/lib/api"

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
    try {
      const saved = await api<string[]>(`/api/products/${productId}/route`, {
        method: "PUT",
        body: JSON.stringify({ operation_ids: route }),
      })
      setRoute(saved)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Bill of materials" hint="Recipe is the input needed for one unit of output. The route is the stage order." />
      {error ? <Notice>{error}</Notice> : null}
      <div className="mb-4 max-w-md">
        <SearchSelect label="Product" options={products} value={productId} onChange={setProductId} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-medium">Recipe per 1 unit</h2>
          <ul className="mb-3 grid gap-2 text-sm">
            {recipe.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>{item.item_name ?? "Component"}</span>
                <span>{item.quantity_per_unit}</span>
              </li>
            ))}
          </ul>
          {can("edit_inventory") ? (
            <div className="grid gap-2">
              <Field label="Component type">
                <select className="h-8 rounded-lg border px-2 text-sm" value={line.kind} onChange={(event) => setLine({ ...line, kind: event.target.value, itemId: "" })}>
                  <option value="material">Raw material</option>
                  <option value="product">Product</option>
                </select>
              </Field>
              <SearchSelect
                label="Item"
                options={line.kind === "product" ? products : materials}
                value={line.itemId}
                onChange={(itemId) => setLine({ ...line, itemId })}
              />
              <Field label="Quantity per unit">
                <Input value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} />
              </Field>
              <Button type="button" onClick={() => void addLine()}>Add to recipe</Button>
            </div>
          ) : null}
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-medium">Default route</h2>
          <ul className="mb-3 grid gap-2 text-sm">
            {route.map((id, index) => (
              <li key={`${id}-${index}`}>{index + 1}. {operations.find((item) => item.id === id)?.label ?? id}</li>
            ))}
          </ul>
          {can("edit_inventory") ? (
            <div className="grid gap-2">
              {operations.map((operation) => (
                <label key={operation.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={route.includes(operation.id)}
                    onChange={(event) => {
                      setRoute((current) =>
                        event.target.checked
                          ? [...current, operation.id]
                          : current.filter((id) => id !== operation.id),
                      )
                    }}
                  />
                  {operation.label}
                </label>
              ))}
              <Button type="button" onClick={() => void saveRoute()}>Save route</Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
