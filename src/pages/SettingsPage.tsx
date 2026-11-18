import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  Building2,
  Save,
  Settings,
  Truck,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ApiError, api, errorMessage, type Page } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

type Company = {
  company_name: string
  gstin: string
  state: string
  address: string
  delivery_charge: string
  invoice_prefix: string
}

type Named = { id: string; name: string; abbreviation?: string | null; detail?: string | null; expires_at?: string | null }

function untilLabel(value: string | null | undefined) {
  if (!value) return ""
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return ""
  const stamp = when.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  return when.getTime() < Date.now() ? `expired ${stamp}` : `until ${stamp}`
}

function CatalogList({
  title,
  hint,
  items,
  placeholder,
  withDetail = false,
  withAbbreviation = false,
  onAdd,
  onSave,
  onRemove,
  onReplace,
}: {
  title: string
  hint: string
  items: Named[]
  placeholder: string
  withDetail?: boolean
  withAbbreviation?: boolean
  onAdd: (name: string, detail: string, abbreviation: string) => Promise<void>
  onSave: (id: string, name: string, detail: string, abbreviation: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onReplace: (id: string, body: { replacement_id?: string; temporary_name?: string; detail?: string }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [abbreviation, setAbbreviation] = useState("")
  const [detail, setDetail] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftAbbreviation, setDraftAbbreviation] = useState("")
  const [draftDetail, setDraftDetail] = useState("")
  const [replacing, setReplacing] = useState<Named | null>(null)
  const [notice, setNotice] = useState("")
  const [mode, setMode] = useState<"existing" | "temporary">("existing")
  const [replacementId, setReplacementId] = useState("")
  const [temporaryName, setTemporaryName] = useState("")
  const sorted = [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))

  async function remove(item: Named) {
    setNotice("")
    try {
      await onRemove(item.id)
      if (replacing?.id === item.id) setReplacing(null)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setReplacing(item)
        setNotice(errorMessage(caught))
        setMode(sorted.some((other) => other.id !== item.id) ? "existing" : "temporary")
        setReplacementId(sorted.find((other) => other.id !== item.id)?.id ?? "")
        return
      }
      setNotice(errorMessage(caught))
    }
  }

  async function confirmReplace() {
    if (!replacing) return
    setNotice("")
    try {
      if (mode === "existing") {
        if (!replacementId) return
        await onReplace(replacing.id, { replacement_id: replacementId })
      } else {
        const next = temporaryName.trim()
        if (!next) return
        await onReplace(replacing.id, { temporary_name: next })
      }
      setReplacing(null)
      setTemporaryName("")
    } catch (caught) {
      setNotice(errorMessage(caught))
    }
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>
          <span className="block text-sm font-medium text-[var(--ink)]">{title}</span>
          <span className="mt-1 block text-xs text-[var(--ink-soft)]">{hint}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-[var(--ink-soft)]">{open ? "Hide" : `${sorted.length} listed`}</span>
      </button>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          void onAdd(next, detail.trim(), abbreviation.trim()).then(() => {
            setName("")
            setAbbreviation("")
            setDetail("")
            setOpen(true)
          }).catch((caught) => setNotice(errorMessage(caught)))
        }}
      >
        <Input value={name} placeholder={placeholder} onChange={(event) => setName(event.target.value)} />
        {withAbbreviation ? <Input value={abbreviation} placeholder="Abbreviation, such as kg" maxLength={16} onChange={(event) => setAbbreviation(event.target.value)} /> : null}
        {withDetail ? <Input value={detail} placeholder="Contains, such as 12 pieces" onChange={(event) => setDetail(event.target.value)} /> : null}
        <Button type="submit" className="h-10 shrink-0 rounded-md bg-[var(--scheme)] text-sm font-medium text-white hover:bg-[var(--scheme-hover)]">Add</Button>
      </form>
      {open ? (
        <div className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {sorted.length === 0 ? <p className="py-3 text-xs text-[var(--ink-soft)]">None yet</p> : sorted.map((item) => {
            const expiry = untilLabel(item.expires_at)
            const editingThis = editing === item.id
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                {editingThis ? (
                  <form
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const next = draftName.trim()
                      if (!next) return
                      void onSave(item.id, next, draftDetail.trim(), draftAbbreviation.trim()).then(() => setEditing(null)).catch((caught) => setNotice(errorMessage(caught)))
                    }}
                  >
                    <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                    {withAbbreviation ? <Input value={draftAbbreviation} placeholder="Abbreviation, such as kg" maxLength={16} onChange={(event) => setDraftAbbreviation(event.target.value)} /> : null}
                    {withDetail ? <Input value={draftDetail} placeholder="Contains, such as 12 pieces" onChange={(event) => setDraftDetail(event.target.value)} /> : null}
                    <Button type="submit" className="h-10 rounded-md bg-[var(--scheme)] text-sm font-medium text-white hover:bg-[var(--scheme-hover)]">Save</Button>
                    <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => setEditing(null)}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 text-sm font-medium text-[var(--ink)]">
                      {item.name}
                      {item.abbreviation ? <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">{item.abbreviation}</span> : null}
                      {item.detail ? <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">contains {item.detail}</span> : null}
                      {expiry ? <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">{expiry}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--scheme)]"
                        onClick={() => {
                          setEditing(item.id)
                          setDraftName(item.name)
                          setDraftAbbreviation(item.abbreviation ?? "")
                          setDraftDetail(item.detail ?? "")
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="text-sm font-medium text-[var(--ink-soft)]" onClick={() => void remove(item)}>Remove</button>
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
      {replacing ? (
        <div className="mt-3 rounded-md border border-[var(--line)] p-3">
          <p className="text-sm text-[var(--ink)]">{notice || `${replacing.name} is still in use.`}</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">Move those goods to a unit that already exists, or hold them on a temporary one for 7 days.</p>
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
              Existing
              <select className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm" value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
                {sorted.filter((item) => item.id !== replacing.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input type="radio" checked={mode === "temporary"} onChange={() => setMode("temporary")} />
              Temporary, 7 days
              <Input value={temporaryName} placeholder="Temporary name" onChange={(event) => setTemporaryName(event.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" className="h-10 rounded-md bg-[var(--scheme)] text-sm font-medium text-white hover:bg-[var(--scheme-hover)]" onClick={() => void confirmReplace()}>Move and remove</Button>
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => setReplacing(null)}>Cancel</Button>
          </div>
        </div>
      ) : notice ? <p className="mt-2 text-xs text-[var(--ink-soft)]">{notice}</p> : null}
    </section>
  )
}

export function SettingsPage() {
  const { can } = useAuth()
  const [form, setForm] = useState<Company | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<Named[]>([])
  const [productCategories, setProductCategories] = useState<Named[]>([])
  const [materialCategories, setMaterialCategories] = useState<Named[]>([])
  const { busy, guard } = useFormBusy()

  function loadCatalog() {
    return Promise.all([
      api<Page<Named>>("/api/measurement-units?page=1&page_size=100"),
      api<Page<Named>>("/api/product-categories?page=1&page_size=100"),
      api<Page<Named>>("/api/raw-materials/categories?page=1&page_size=100"),
    ]).then(([unitPage, productPage, materialPage]) => {
      setUnits(unitPage.items)
      setProductCategories(productPage.items)
      setMaterialCategories(materialPage.items)
    })
  }

  useEffect(() => {
    Promise.all([api<Company>("/api/company"), loadCatalog()])
      .then(([company]) => setForm(company))
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  async function addNamed(path: string, name: string, detail = "", abbreviation = "") {
    setError("")
    const body = path.includes("measurement-units")
      ? { name, detail: detail || null, abbreviation: abbreviation || null }
      : { name }
    await api(path, { method: "POST", body: JSON.stringify(body) })
    await loadCatalog()
  }

  async function saveNamed(path: string, name: string, detail = "", abbreviation = "") {
    setError("")
    const body = path.includes("measurement-units") ? { name, detail, abbreviation } : { name }
    await api(path, { method: "PATCH", body: JSON.stringify(body) })
    await loadCatalog()
  }

  async function removeNamed(path: string) {
    await api(path, { method: "DELETE" })
    await loadCatalog()
  }

  async function replaceNamed(path: string, body: { replacement_id?: string; temporary_name?: string; detail?: string }) {
    await api(path, { method: "POST", body: JSON.stringify(body) })
    await loadCatalog()
  }

  if (!can("manage_company")) return <Navigate to="/dashboard" replace />

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setError("")
    setSaved(false)
    await guard(async () => {
    try {
      setForm(await api<Company>("/api/company", { method: "PATCH", body: JSON.stringify(form) }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Plant & Company Profile"
        hint="Legal entity details, units of measurement, and the categories used by products and materials."
        icon={Settings}
        badge={form?.company_name ?? "Company"}
      />

      {loading ? <PageLoading label="Loading company settings" /> : null}
      {error ? <Notice variant="error">{error}</Notice> : null}
      {saved ? <Notice variant="success">Company settings saved successfully.</Notice> : null}

      {form ? (
        <Card className="relative max-w-2xl border-gray-200/90 bg-white shadow-xs rounded-2xl">
          <FormBusy show={busy} />
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="tone tone-emerald grid size-10 place-items-center rounded-xl">
                <Building2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Manufacturing Entity Details
                </CardTitle>
                <p className="text-xs text-gray-500">Configure global tax and legal identity</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <form className="grid gap-5" onSubmit={(event) => void save(event)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company Registered Name" required>
                  <Input
                    required
                    value={form.company_name}
                    onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                  />
                </Field>
                <Field label="GSTIN Identification" required>
                  <Input
                    required
                    value={form.gstin}
                    onChange={(event) => setForm({ ...form, gstin: event.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Home State Jurisdiction" required>
                  <Input
                    required
                    value={form.state}
                    onChange={(event) => setForm({ ...form, state: event.target.value })}
                  />
                </Field>
                <Field label="Invoice Number Prefix" required>
                  <Input
                    required
                    placeholder="e.g. SDS-2026-"
                    value={form.invoice_prefix}
                    onChange={(event) => setForm({ ...form, invoice_prefix: event.target.value })}
                  />
                </Field>
              </div>

              <Field label="Plant Operating Address" required>
                <Input
                  required
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </Field>

              <div className="rounded-xl border border-gray-200/90 bg-gray-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-700">
                  <Truck className="size-4 text-green-600" />
                  <span>Logistics & Freight Defaults</span>
                </div>
                <Field label="Flat Dispatch Delivery Charge (₹, Tax-Exempt)">
                  <Input
                    value={form.delivery_charge}
                    onChange={(event) => setForm({ ...form, delivery_charge: event.target.value })}
                  />
                </Field>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-3">
                <Button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  <Save className="mr-1.5 size-4" />
                  Save Company Configuration
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <CatalogList
          title="Units of measurement"
          hint="Open the list to set the abbreviation used beside a quantity, such as kg or ft, or to say a dozen contains 12 pieces."
          items={units}
          placeholder="New unit"
          withDetail
          withAbbreviation
          onAdd={(name, detail) => addNamed("/api/measurement-units", name, detail)}
          onSave={(id, name, detail) => saveNamed(`/api/measurement-units/${id}`, name, detail)}
          onRemove={(id) => removeNamed(`/api/measurement-units/${id}`)}
          onReplace={(id, body) => replaceNamed(`/api/measurement-units/${id}/replace`, body)}
        />
        <CatalogList
          title="Product categories"
          hint="Groups for finished and traded goods."
          items={productCategories}
          placeholder="New product category"
          onAdd={(name) => addNamed("/api/product-categories", name)}
          onSave={(id, name) => saveNamed(`/api/product-categories/${id}`, name)}
          onRemove={(id) => removeNamed(`/api/product-categories/${id}`)}
          onReplace={(id, body) => replaceNamed(`/api/product-categories/${id}/replace`, body)}
        />
        <CatalogList
          title="Material categories"
          hint="Groups for raw materials."
          items={materialCategories}
          placeholder="New material category"
          onAdd={(name) => addNamed("/api/raw-materials/categories", name)}
          onSave={(id, name) => saveNamed(`/api/raw-materials/categories/${id}`, name)}
          onRemove={(id) => removeNamed(`/api/raw-materials/categories/${id}`)}
          onReplace={(id, body) => replaceNamed(`/api/raw-materials/categories/${id}/replace`, body)}
        />
      </div>
    </div>
  )
}
