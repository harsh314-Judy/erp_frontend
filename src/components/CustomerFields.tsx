import { Field } from "@/components/plant-ui"
import { Input } from "@/components/ui/input"

export type CustomerForm = {
  name: string
  contact_person_name: string
  email: string
  phone_number: string
  alt_phone_number: string
  address: string
  state: string
  is_company: boolean
  gst_number: string
  whatsapp_mode: string
  whatsapp_number: string
}

export const emptyCustomer: CustomerForm = {
  name: "",
  contact_person_name: "",
  email: "",
  phone_number: "",
  alt_phone_number: "",
  address: "",
  state: "",
  is_company: false,
  gst_number: "",
  whatsapp_mode: "main",
  whatsapp_number: "",
}

const selectClass =
  "h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-2xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

export function customerPayload(form: CustomerForm) {
  return {
    ...form,
    contact_person_name: form.contact_person_name || null,
    alt_phone_number: form.alt_phone_number || null,
    is_company: form.is_company,
    gst_number: form.is_company ? form.gst_number || null : null,
    whatsapp_number: form.whatsapp_mode === "separate" ? form.whatsapp_number || null : null,
    is_whatsapp_different: form.whatsapp_mode !== "main",
  }
}

export function CustomerFields({
  form,
  onChange,
}: {
  form: CustomerForm
  onChange: (form: CustomerForm) => void
}) {
  return (
    <>
      <Field label="Customer / Business Name" required className="sm:col-span-2">
        <Input required placeholder="e.g. Apex Steel Fabricators" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
      </Field>
      <Field label="Contact Person">
        <Input value={form.contact_person_name} onChange={(event) => onChange({ ...form, contact_person_name: event.target.value })} />
      </Field>
      <Field label="Alternate Number">
        <Input value={form.alt_phone_number} onChange={(event) => onChange({ ...form, alt_phone_number: event.target.value })} />
      </Field>
      <Field label="GST status">
        <select className={selectClass} value={form.is_company ? "registered" : "unregistered"} onChange={(event) => onChange({ ...form, is_company: event.target.value === "registered", gst_number: event.target.value === "registered" ? form.gst_number : "" })}>
          <option value="unregistered">Unregistered</option>
          <option value="registered">Registered</option>
        </select>
      </Field>
      <Field label="Email Address" required>
        <Input required type="email" placeholder="billing@apexsteel.in" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
      </Field>
      <Field label="Primary Phone Number" required>
        <Input required placeholder="+91 98765 00000" value={form.phone_number} onChange={(event) => onChange({ ...form, phone_number: event.target.value })} />
      </Field>
      <Field label="State (Tax Jurisdiction)">
        <Input value={form.state} placeholder="Leave blank for Home State" onChange={(event) => onChange({ ...form, state: event.target.value })} />
      </Field>
      {form.is_company ? (
        <Field label="GSTIN Number" required>
          <Input required placeholder="27AAAAA0000A1Z5" value={form.gst_number} onChange={(event) => onChange({ ...form, gst_number: event.target.value })} />
        </Field>
      ) : null}
      <Field label="WhatsApp Notification Route">
        <select className={selectClass} value={form.whatsapp_mode} onChange={(event) => onChange({ ...form, whatsapp_mode: event.target.value })}>
          <option value="main">Use Primary Phone</option>
          <option value="alternate">Use Alternate Phone</option>
          <option value="separate">Dedicated WhatsApp Number</option>
        </select>
      </Field>
      {form.whatsapp_mode === "separate" ? (
        <Field label="Dedicated WhatsApp Number">
          <Input placeholder="+91 99999 88888" value={form.whatsapp_number} onChange={(event) => onChange({ ...form, whatsapp_number: event.target.value })} />
        </Field>
      ) : null}
      <Field label="Full Address / Delivery Destination" className="sm:col-span-2" required>
        <Input required placeholder="Plot 14, MIDC Bhosari, Pune" value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
      </Field>
    </>
  )
}
