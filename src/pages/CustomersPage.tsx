import { useEffect, useState, type FormEvent } from "react"
import {
  Mail,
  MessageSquare,
  Phone,
  PlusCircle,
  UserRound,
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
  const [showCreate, setShowCreate] = useState(false)
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
      setShowCreate(false)
      await load()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Customer Client Accounts"
        hint="Client registry. Customer state governs automated CGST+SGST versus IGST taxation rules."
        icon={UserRound}
        badge={`${rows.length} Clients`}
        action={
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
              >
                <PlusCircle className="mr-1.5 size-4" />
                Add New Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <UserRound className="size-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-white">Register New Customer Client</DialogTitle>
                </div>
              </DialogHeader>
              <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
                <Field label="Customer / Business Name" required className="sm:col-span-2">
                  <Input
                    required
                    placeholder="e.g. Apex Steel Fabricators"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </Field>
                <Field label="Email Address" required>
                  <Input
                    required
                    type="email"
                    placeholder="billing@apexsteel.in"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="Primary Phone Number" required>
                  <Input
                    required
                    placeholder="+91 98765 00000"
                    value={form.phone_number}
                    onChange={(event) => setForm({ ...form, phone_number: event.target.value })}
                  />
                </Field>
                <Field label="State (Tax Jurisdiction)">
                  <Input
                    value={form.state}
                    placeholder="Leave blank for Home State"
                    onChange={(event) => setForm({ ...form, state: event.target.value })}
                  />
                </Field>
                <Field label="GSTIN Number">
                  <Input
                    placeholder="27AAAAA0000A1Z5"
                    value={form.gst_number}
                    onChange={(event) => setForm({ ...form, gst_number: event.target.value })}
                  />
                </Field>
                <Field label="WhatsApp Notification Route">
                  <select
                    className="h-9 w-full rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200 shadow-2xs focus:border-blue-500/80 focus:outline-none"
                    value={form.whatsapp_mode}
                    onChange={(event) => setForm({ ...form, whatsapp_mode: event.target.value })}
                  >
                    <option value="main">Use Primary Phone</option>
                    <option value="alternate">Use Alternate Phone</option>
                    <option value="separate">Dedicated WhatsApp Number</option>
                  </select>
                </Field>
                {form.whatsapp_mode === "separate" ? (
                  <Field label="Dedicated WhatsApp Number">
                    <Input
                      placeholder="+91 99999 88888"
                      value={form.whatsapp_number}
                      onChange={(event) => setForm({ ...form, whatsapp_number: event.target.value })}
                    />
                  </Field>
                ) : null}
                <Field label="Full Address / Delivery Destination" className="sm:col-span-2" required>
                  <Input
                    required
                    placeholder="Plot 14, MIDC Bhosari, Pune"
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
                    Save Customer Account
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* Customers Table */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-sm">
        <div className="border-b border-[#262e3f] bg-[#161a25] px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Client Directory
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>State / Tax Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>WhatsApp Alert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No customers registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-200">
                      <div>
                        <p>{row.name}</p>
                        <p className="text-xs text-slate-400 font-normal">{row.address}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
                        {row.state || "Home State (CGST+SGST)"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <a
                          href={`tel:${row.phone_number}`}
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Phone className="size-3" />
                          {row.phone_number}
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
                        <span className="text-xs text-slate-500">Unregistered / Retail</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-400 capitalize">
                        <MessageSquare className="size-3" />
                        {row.whatsapp_mode}
                      </span>
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
