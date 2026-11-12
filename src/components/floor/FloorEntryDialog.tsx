import { useEffect, useState, type FormEvent } from "react"

import type { FloorEntry } from "@/components/floor/format"
import { istToday } from "@/components/floor/dates"
import { Field } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, errorMessage, type Page } from "@/lib/api"
import { cn } from "@/lib/utils"

type Department = { id: string; name: string }
type Person = { id: string; operation_id: string; name: string; employment_type?: string }
type Named = { id: string; product_name?: string; name?: string }

const UNITS = ["pcs", "kg", "g", "m"]

export function FloorEntryDialog({
  open,
  onOpenChange,
  departments,
  presetOperationId,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: Department[]
  presetOperationId: string
  initial: FloorEntry | null
  onSaved: () => void
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [products, setProducts] = useState<Named[]>([])
  const [materials, setMaterials] = useState<Named[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() =>
    initial
      ? fromEntry(initial)
      : blank(presetOperationId && presetOperationId !== "all" ? presetOperationId : departments[0]?.id ?? ""),
  )

  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([
      api<Person[]>("/api/departments/workers"),
      api<Page<Named>>("/api/products?page=1&page_size=100&brief=true"),
      api<Page<Named>>("/api/raw-materials?page=1&page_size=100"),
    ])
      .then(([workers, productPage, materialPage]) => {
        if (!alive) return
        setPeople(workers)
        setProducts(productPage.items)
        setMaterials(materialPage.items)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  const here = people.filter((person) => person.operation_id === form.operation_id)
  const elsewhere = people.filter((person) => person.operation_id !== form.operation_id)

  function toggle(id: string) {
    setForm((current) => {
      const has = current.worker_ids.includes(id)
      const worker_ids = has ? current.worker_ids.filter((item) => item !== id) : current.worker_ids.length >= 3 ? current.worker_ids : [...current.worker_ids, id]
      return { ...current, worker_ids }
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const body = {
      entry_date: form.entry_date,
      operation_id: form.operation_id,
      worker_ids: form.worker_ids,
      output_name: form.output_name.trim(),
      output_quantity: form.output_quantity || "0",
      output_unit: form.output_unit,
      output_product_id: form.output_product_id || null,
      input_name: form.input_name.trim() || null,
      input_quantity: form.input_name.trim() ? form.input_quantity || "0" : null,
      input_unit: form.input_name.trim() ? form.input_unit : null,
      input_product_id: form.input_product_id || null,
      input_raw_material_id: form.input_raw_material_id || null,
      scrap_quantity: form.scrap_quantity || "0",
      scrap_unit: Number(form.scrap_quantity) > 0 ? form.scrap_unit : null,
      notes: form.notes.trim() || null,
    }
    try {
      await api(initial ? `/api/floor/entries/${initial.id}` : "/api/floor/entries", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      })
      onOpenChange(false)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!initial) return
    setBusy(true)
    setError("")
    try {
      await api(`/api/floor/entries/${initial.id}`, { method: "DELETE" })
      onOpenChange(false)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function chips(rows: Person[]) {
    return rows.map((person) => {
      const on = form.worker_ids.includes(person.id)
      return (
        <button
          key={person.id}
          type="button"
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold",
            on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700",
          )}
          onClick={() => toggle(person.id)}
        >
          {person.name}
          {person.employment_type === "temporary" ? " · Temp" : ""}
        </button>
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-200 bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">{initial ? "Edit log line" : "Log today's work"}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" required>
              <Input type="date" value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} required />
            </Field>
            <Field label="Department" required>
              <select
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                value={form.operation_id}
                onChange={(event) => setForm({ ...form, operation_id: event.target.value })}
                required
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-gray-800">People · up to 3</p>
            <div className="flex flex-wrap gap-1.5">{chips(here)}</div>
            {elsewhere.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full text-[10px] font-bold uppercase tracking-wider text-gray-400">Other departments</span>
                {chips(elsewhere)}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_5rem_5.5rem]">
            <Field label="Made" required>
              <Input
                list="floor-output-items"
                value={form.output_name}
                placeholder="2-number vati base"
                onChange={(event) => setForm({ ...form, output_name: event.target.value, output_product_id: "" })}
                required
              />
              <datalist id="floor-output-items">
                {products.map((item) => (
                  <option key={item.id} value={item.product_name ?? item.name ?? ""} />
                ))}
              </datalist>
            </Field>
            <Field label="Qty">
              <Input type="number" min="0" step="any" value={form.output_quantity} onChange={(event) => setForm({ ...form, output_quantity: event.target.value })} required />
            </Field>
            <Field label="Unit">
              <UnitSelect value={form.output_unit} onChange={(output_unit) => setForm({ ...form, output_unit })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_5rem_5.5rem]">
            <Field label="Used">
              <Input
                list="floor-input-items"
                value={form.input_name}
                placeholder="Optional"
                onChange={(event) => setForm({ ...form, input_name: event.target.value, input_product_id: "", input_raw_material_id: "" })}
              />
              <datalist id="floor-input-items">
                {materials.map((item) => (
                  <option key={item.id} value={item.name ?? ""} />
                ))}
                {products.map((item) => (
                  <option key={`p-${item.id}`} value={item.product_name ?? ""} />
                ))}
              </datalist>
            </Field>
            <Field label="Qty">
              <Input type="number" min="0" step="any" value={form.input_quantity} onChange={(event) => setForm({ ...form, input_quantity: event.target.value })} />
            </Field>
            <Field label="Unit">
              <UnitSelect value={form.input_unit} onChange={(input_unit) => setForm({ ...form, input_unit })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scrap">
              <Input type="number" min="0" step="any" value={form.scrap_quantity} onChange={(event) => setForm({ ...form, scrap_quantity: event.target.value })} />
            </Field>
            <Field label="Scrap unit">
              <UnitSelect value={form.scrap_unit} onChange={(scrap_unit) => setForm({ ...form, scrap_unit })} />
            </Field>
          </div>
          <Field label="Note">
            <Input value={form.notes} placeholder="Optional" onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          <DialogFooter className="gap-2">
            {initial && !initial.from_job ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>Delete</Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || form.worker_ids.length === 0} className="bg-green-600 text-white hover:bg-green-700">Save line</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UnitSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const known = UNITS.includes(value)
  return (
    <select className="h-10 w-full rounded-xl border border-gray-200 bg-white px-2 text-sm" value={known ? value : "other"} onChange={(event) => onChange(event.target.value === "other" ? "" : event.target.value)}>
      {UNITS.map((unit) => (
        <option key={unit} value={unit}>{unit}</option>
      ))}
      <option value="other">{known ? "Other" : value || "Other"}</option>
    </select>
  )
}

function blank(operationId: string) {
  return {
    entry_date: istToday(),
    operation_id: operationId,
    worker_ids: [] as string[],
    output_name: "",
    output_quantity: "",
    output_unit: "pcs",
    output_product_id: "",
    input_name: "",
    input_quantity: "",
    input_unit: "kg",
    input_product_id: "",
    input_raw_material_id: "",
    scrap_quantity: "",
    scrap_unit: "kg",
    notes: "",
  }
}

function fromEntry(entry: FloorEntry) {
  return {
    entry_date: entry.entry_date,
    operation_id: entry.operation_id,
    worker_ids: entry.workers.map((worker) => worker.id),
    output_name: entry.output_name,
    output_quantity: String(Number(entry.output_quantity)),
    output_unit: entry.output_unit,
    output_product_id: entry.output_product_id ?? "",
    input_name: entry.input_name ?? "",
    input_quantity: entry.input_quantity != null ? String(Number(entry.input_quantity)) : "",
    input_unit: entry.input_unit || "kg",
    input_product_id: entry.input_product_id ?? "",
    input_raw_material_id: entry.input_raw_material_id ?? "",
    scrap_quantity: String(Number(entry.scrap_quantity || 0)),
    scrap_unit: entry.scrap_unit || entry.output_unit,
    notes: entry.notes ?? "",
  }
}
