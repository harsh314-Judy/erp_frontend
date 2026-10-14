import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"

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

  useEffect(() => {
    api<Company>("/api/company")
      .then(setForm)
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  if (!can("manage_company")) return <Navigate to="/dashboard" replace />

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setError("")
    setSaved(false)
    try {
      setForm(await api<Company>("/api/company", { method: "PATCH", body: JSON.stringify(form) }))
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Company" hint="Invoice prefix, GSTIN, and the flat delivery charge. Delivery is not taxed." />
      {error ? <Notice>{error}</Notice> : null}
      {saved ? <p className="mb-3 text-sm text-muted-foreground">Saved.</p> : null}
      {form ? (
        <form className="grid max-w-xl gap-3 rounded-xl border bg-white p-4" onSubmit={(event) => void save(event)}>
          <Field label="Name"><Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} /></Field>
          <Field label="State"><Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          <Field label="Delivery charge"><Input value={form.delivery_charge} onChange={(event) => setForm({ ...form, delivery_charge: event.target.value })} /></Field>
          <Field label="Invoice prefix"><Input value={form.invoice_prefix} onChange={(event) => setForm({ ...form, invoice_prefix: event.target.value })} /></Field>
          <Button type="submit">Save company</Button>
        </form>
      ) : null}
    </div>
  )
}
