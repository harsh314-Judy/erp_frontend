import { useEffect, useState, type FormEvent } from "react"
import {
  Mail,
  Phone,
  PlusCircle,
  Truck,
} from "lucide-react"

import { Field, Notice, PageTitle } from "@/components/plant-ui"
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
  const [showCreate, setShowCreate] = useState(false)
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
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Supplier Vendor Directory"
        hint="Approved raw material vendors, coil providers, and finishing chemical suppliers."
        icon={Truck}
        badge={`${rows.length} Vendors`}
        action={
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
              >
                <PlusCircle className="mr-1.5 size-4" />
                Register Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Truck className="size-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-white">Register New Supplier Partner</DialogTitle>
                </div>
              </DialogHeader>
              <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                <Field label="Supplier Company Name" required className="sm:col-span-2">
                  <Input
                    required
                    placeholder="e.g. Jindal Steel & Power Ltd"
                    value={form.supplier_company_name}
                    onChange={(event) => setForm({ ...form, supplier_company_name: event.target.value })}
                  />
                </Field>
                <Field label="Key Contact Person" required>
                  <Input
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={form.contact_person_name}
                    onChange={(event) => setForm({ ...form, contact_person_name: event.target.value })}
                  />
                </Field>
                <Field label="Contact Phone" required>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
                <Field label="Email Address" required>
                  <Input
                    required
                    type="email"
                    placeholder="orders@vendor.com"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="GSTIN Number">
                  <Input
                    placeholder="27AAAAA0000A1Z5"
                    value={form.gst_number}
                    onChange={(event) => setForm({ ...form, gst_number: event.target.value })}
                  />
                </Field>
                <Field label="Plant / Billing Address" required className="sm:col-span-2">
                  <Input
                    required
                    placeholder="Industrial Area, Phase 2, Pune"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
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
                    Save Supplier
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* Suppliers Table */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registered Vendor Accounts
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Direct Contact</TableHead>
                <TableHead>GSTIN Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    No suppliers registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">
                      <div>
                        <p>{row.supplier_company_name}</p>
                        <p className="text-xs text-slate-400 font-normal">{row.address}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-300">{row.contact_person_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <a
                          href={`tel:${row.phone}`}
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Phone className="size-3" />
                          {row.phone}
                        </a>
                        <a
                          href={`mailto:${row.email}`}
                          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Mail className="size-3" />
                          {row.email}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.gst_number ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-bold text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" />
                          {row.gst_number}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Non-GST Vendor</span>
                      )}
                    </TableCell>
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
