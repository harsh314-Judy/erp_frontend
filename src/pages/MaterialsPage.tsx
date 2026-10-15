import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { canSeePrices } from "@/lib/access"
import { api, errorMessage, type Page } from "@/lib/api"

type Named = { id: string; name: string }
type Material = {
  id: string
  name: string
  kind: string
  quantity: string
  available?: string | null
  stock_status?: string | null
  purchase_price?: string | null
  description: string | null
}

export function MaterialsPage() {
  const { user, can } = useAuth()
  const prices = canSeePrices(user?.role_name)
  const [rows, setRows] = useState<Material[]>([])
  const [units, setUnits] = useState<Named[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    kind: "sheet",
    purchase_price: "0",
    alert_quantity: "0",
    measurement_unit_id: "",
    description: "",
  })

  async function load(search = query) {
    const [materials, unitPage] = await Promise.all([
      api<Page<Material>>(`/api/raw-materials/?page=1&page_size=100&q=${encodeURIComponent(search)}`),
      api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
    ])
    setRows(materials.items)
    setUnits(unitPage.items)
    setForm((current) => ({
      ...current,
      measurement_unit_id: current.measurement_unit_id || unitPage.items[0]?.id || "",
    }))
  }

  useEffect(() => {
    void load("").catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/raw-materials/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          price: form.purchase_price,
          description: form.description || null,
        }),
      })
      setForm((current) => ({ ...current, name: "", description: "" }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Raw materials" hint="Sheets, polish, and colour used on the floor." />
      <div className="mb-4 flex gap-2">
        <Input value={query} placeholder="Search materials" onChange={(event) => setQuery(event.target.value)} />
        <Button type="button" onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}>Search</Button>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {can("edit_inventory") ? (
        <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void create(event)}>
          <Field label="Name"><Input value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Kind">
            <select className="h-8 rounded-lg border px-2 text-sm" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              <option value="sheet">Sheet</option>
              <option value="polish">Polish</option>
              <option value="color">Colour</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Unit">
            <select className="h-8 rounded-lg border px-2 text-sm" value={form.measurement_unit_id} onChange={(event) => setForm({ ...form, measurement_unit_id: event.target.value })}>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </Field>
          {prices ? (
            <Field label="Purchase price"><Input value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></Field>
          ) : null}
          <Field label="Minimum stock"><Input value={form.alert_quantity} onChange={(event) => setForm({ ...form, alert_quantity: event.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit">Add material</Button></div>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
              {prices ? <TableHead>Purchase price</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.available ?? row.quantity}</TableCell>
                <TableCell>{row.stock_status ?? "normal"}</TableCell>
                {prices ? <TableCell>{row.purchase_price ?? "–"}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
