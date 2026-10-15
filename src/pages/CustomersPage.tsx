import { useEffect, useState, type FormEvent } from "react"

import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"

type Customer = {
  id: string
  name: string
  state: string
  phone_number: string
  email: string
  gst_number: string | null
  whatsapp_mode: string
  address: string
}

export function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([])
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    address: "",
    state: "",
    gst_number: "",
    whatsapp_mode: "main",
    whatsapp_number: "",
  })

  async function load() {
    const page = await api<Page<Customer>>("/api/customers/?page=1&page_size=100")
    setRows(page.items)
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/customers/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          gst_number: form.gst_number || null,
          whatsapp_number: form.whatsapp_mode === "main" ? null : form.whatsapp_number || null,
          is_whatsapp_different: form.whatsapp_mode !== "main",
          is_company: Boolean(form.gst_number),
        }),
      })
      setForm({ name: "", email: "", phone_number: "", address: "", state: "", gst_number: "", whatsapp_mode: "main", whatsapp_number: "" })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Customers" hint="State decides CGST and SGST versus IGST. WhatsApp can use the main number, the alternate, or a separate one." />
      {error ? <Notice>{error}</Notice> : null}
      <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void create(event)}>
        <Field label="Name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Phone"><Input required value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></Field>
        <Field label="State"><Input value={form.state} placeholder="Same as the plant if left blank" onChange={(event) => setForm({ ...form, state: event.target.value })} /></Field>
        <Field label="GSTIN"><Input value={form.gst_number} onChange={(event) => setForm({ ...form, gst_number: event.target.value })} /></Field>
        <Field label="WhatsApp">
          <select className="h-8 rounded-lg border px-2 text-sm" value={form.whatsapp_mode} onChange={(event) => setForm({ ...form, whatsapp_mode: event.target.value })}>
            <option value="main">Main phone</option>
            <option value="alternate">Alternate phone</option>
            <option value="separate">Separate number</option>
          </select>
        </Field>
        <Field label="Address"><Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
        {form.whatsapp_mode === "separate" ? (
          <Field label="WhatsApp number"><Input value={form.whatsapp_number} onChange={(event) => setForm({ ...form, whatsapp_number: event.target.value })} /></Field>
        ) : null}
        <div className="flex items-end"><Button type="submit">Add customer</Button></div>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.state || "Same state"}</TableCell>
                <TableCell>{row.phone_number}</TableCell>
                <TableCell>{row.gst_number || "–"}</TableCell>
                <TableCell>{row.whatsapp_mode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
