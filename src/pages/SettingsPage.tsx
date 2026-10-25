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
import { api, errorMessage } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"

type Company = {
  company_name: string
  gstin: string
  state: string
  address: string
  delivery_charge: string
  invoice_prefix: string
}

export function SettingsPage() {
  const { can } = useAuth()
  const [form, setForm] = useState<Company | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()

  useEffect(() => {
    api<Company>("/api/company")
      .then(setForm)
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

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
        hint="Legal entity details, GSTIN tax credentials, invoice numbering series, and flat delivery rates."
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
              <div className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
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
    </div>
  )
}
