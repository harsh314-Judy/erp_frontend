import { useEffect, useState, type FormEvent } from "react"
import {
  Boxes,
  PlusCircle,
  Search,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle, StatusBadge } from "@/components/plant-ui"
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
import { cn } from "@/lib/utils"

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
  const [showCreate, setShowCreate] = useState(false)
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
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const kindColors: Record<string, string> = {
    sheet: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    polish: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    other: "bg-slate-800 text-slate-300 border-slate-700",
  }

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
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Boxes className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-bold text-white">Register Raw Material Item</DialogTitle>
                  </div>
                </DialogHeader>
                <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                  <Field label="Material Name" required className="sm:col-span-2">
                    <Input
                      value={form.name}
                      placeholder="e.g. SS 304 Sheet 2mm (8x4 ft)"
                      required
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </Field>
                  <Field label="Material Classification" required>
                    <select
                      className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"
                      value={form.kind}
                      onChange={(event) => setForm({ ...form, kind: event.target.value })}
                    >
                      <option value="sheet">Steel Sheet / Plate / Coil</option>
                      <option value="polish">Polishing Paste / Compound</option>
                      <option value="color">Powder Coat / Colour Finish</option>
                      <option value="other">Hardware / Fastener / Other</option>
                    </select>
                  </Field>
                  <Field label="Unit of Measurement">
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
                  {prices ? (
                    <Field label="Procurement Price (₹/unit)">
                      <Input
                        value={form.purchase_price}
                        onChange={(event) => setForm({ ...form, purchase_price: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  <Field label="Reorder Threshold (Alert Qty)">
                    <Input
                      value={form.alert_quantity}
                      onChange={(event) => setForm({ ...form, alert_quantity: event.target.value })}
                    />
                  </Field>
                  <Field label="Specification Notes" className="sm:col-span-2">
                    <Input
                      placeholder="Alloy specifications, standard thickness, supplier code..."
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                    />
                  </Field>
                  <DialogFooter className="mt-3 flex items-center justify-end gap-2 sm:col-span-2 border-t border-[#262e3f] pt-4">
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
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/15 hover:from-blue-500 hover:to-indigo-500"
                    >
                      Save Material to Inventory
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Search Bar */}
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

      {/* Materials Table */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Raw Materials Inventory
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">{rows.length} stock items</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead className="text-right">Physical On Hand</TableHead>
                <TableHead className="text-right">Free / Available</TableHead>
                <TableHead className="text-center">Stock Level</TableHead>
                {prices ? <TableHead className="text-right">Purchase Price</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={prices ? 6 : 5} className="py-8 text-center text-xs text-slate-400">
                    No raw materials match the query.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">
                      <div>
                        <p>{row.name}</p>
                        {row.description ? <p className="text-xs text-slate-400 font-normal">{row.description}</p> : null}
                      </div>
                    </TableCell>
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
                    <TableCell className="text-right font-bold text-emerald-400">
                      {row.available ?? row.quantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.stock_status ?? "normal"} />
                    </TableCell>
                    {prices ? (
                      <TableCell className="text-right font-semibold text-slate-200">
                        {row.purchase_price ? `₹${row.purchase_price}` : "–"}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
