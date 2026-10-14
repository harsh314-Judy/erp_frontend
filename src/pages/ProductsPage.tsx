import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"
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
}

export function ProductsPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [rows, setRows] = useState<Product[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [categories, setCategories] = useState<Named[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
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

  async function createProduct(event: FormEvent) {
    event.preventDefault()
    setError("")
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
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Products" hint="Finished goods and items the plant both makes and buys." />
      <div className="mb-4 flex gap-2">
        <Input value={query} placeholder="Search name or SKU" onChange={(event) => setQuery(event.target.value)} />
        <Button type="button" onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}>
          Search
        </Button>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {can("edit_inventory") ? (
        <div className="mb-6 grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2">
          <MiniCreate label="Unit" onCreate={(name) => addNamed("/api/measurement-units", name)} />
          <MiniCreate label="Category" onCreate={(name) => addNamed("/api/product-categories", name)} />
          <form className="grid gap-3 md:col-span-2 md:grid-cols-3" onSubmit={(event) => void createProduct(event)}>
            <Field label="Name">
              <Input value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} required />
            </Field>
            <Field label="SKU">
              <Input value={form.sku_number} onChange={(event) => setForm({ ...form, sku_number: event.target.value })} required />
            </Field>
            <Field label="Type">
              <select className="h-8 rounded-lg border px-2 text-sm" value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })}>
                <option value="manufactured">Manufactured</option>
                <option value="purchased">Purchased</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="HSN">
              <Input value={form.hsn_code} onChange={(event) => setForm({ ...form, hsn_code: event.target.value })} />
            </Field>
            <Field label="GST %">
              <Input value={form.gst_percent} onChange={(event) => setForm({ ...form, gst_percent: event.target.value })} />
            </Field>
            {prices ? (
              <Field label="Sale price">
                <Input value={form.sale_price_without_gst} onChange={(event) => setForm({ ...form, sale_price_without_gst: event.target.value })} />
              </Field>
            ) : null}
            <Field label="Minimum stock">
              <Input value={form.alert_quantity} onChange={(event) => setForm({ ...form, alert_quantity: event.target.value })} />
            </Field>
            <Field label="Unit">
              <select className="h-8 rounded-lg border px-2 text-sm" value={form.measurement_unit_id} onChange={(event) => setForm({ ...form, measurement_unit_id: event.target.value })}>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="h-8 rounded-lg border px-2 text-sm" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Add product</Button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
              {prices ? <TableHead>Price</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.product_name}</TableCell>
                <TableCell>{row.sku_number}</TableCell>
                <TableCell>{row.product_type}</TableCell>
                <TableCell>{row.hsn_code}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.available ?? row.quantity}</TableCell>
                <TableCell>{row.stock_status ?? "normal"}</TableCell>
                {prices ? <TableCell>{row.sale_price_without_gst ?? "–"}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
      <Field label={`New ${label.toLowerCase()}`}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Button type="submit" variant="outline">Add {label}</Button>
    </form>
  )
}
