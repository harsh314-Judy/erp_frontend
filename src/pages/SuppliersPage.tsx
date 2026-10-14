import { useEffect, useState, type FormEvent } from "react"

import { Field, Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage, type Page } from "@/lib/api"

type Supplier = {
  id: string
  supplier_company_name: string
  contact_person_name: string
  phone: string
  email: string
  gst_number: string | null
  address: string
}

export function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([])
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    supplier_company_name: "",
    contact_person_name: "",
    phone: "",
    email: "",
    gst_number: "",
    address: "",
  })

  async function load() {
    setRows((await api<Page<Supplier>>("/api/suppliers?page=1&page_size=100")).items)
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          gst_number: form.gst_number || null,
          is_gst: Boolean(form.gst_number),
        }),
      })
      setForm({ supplier_company_name: "", contact_person_name: "", phone: "", email: "", gst_number: "", address: "" })
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageTitle title="Suppliers" hint="Accountants can see suppliers. Staff only see incoming shipment details." />
      {error ? <Notice>{error}</Notice> : null}
      <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={(event) => void create(event)}>
        <Field label="Company"><Input required value={form.supplier_company_name} onChange={(event) => setForm({ ...form, supplier_company_name: event.target.value })} /></Field>
        <Field label="Contact"><Input required value={form.contact_person_name} onChange={(event) => setForm({ ...form, contact_person_name: event.target.value })} /></Field>
        <Field label="Phone"><Input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="Email"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="GSTIN"><Input value={form.gst_number} onChange={(event) => setForm({ ...form, gst_number: event.target.value })} /></Field>
        <Field label="Address"><Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
        <div className="flex items-end"><Button type="submit">Add supplier</Button></div>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>GSTIN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.supplier_company_name}</TableCell>
                <TableCell>{row.contact_person_name}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>{row.gst_number || "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
