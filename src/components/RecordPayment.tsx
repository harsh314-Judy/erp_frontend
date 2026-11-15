import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

export function RecordPayment({
  invoiceId,
  due,
  onDone,
}: {
  invoiceId: string
  due: string
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(due)
  const [method, setMethod] = useState("cash")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount, method, note: note || null }),
      })
      setOpen(false)
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    )
  }

  return (
    <form className="mt-2 grid gap-2" onSubmit={(event) => void save(event)}>
      <Input type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
      <select className="h-9 rounded-xl border border-gray-200 px-2 text-sm" value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="cash">Cash</option>
        <option value="online">Online</option>
      </select>
      <Input placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-8 bg-green-700 text-xs text-white">Save payment</Button>
        <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
