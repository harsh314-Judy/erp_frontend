import { useEffect, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

export type PaymentLine = {
  id: string
  amount: string
  method: string
  note: string | null
  attachment_id: string | null
  created_at: string
}

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "bank", label: "Bank transfer" },
]

function money(value: number) {
  return `₹${value.toFixed(2)}`
}

export function PaymentSummary({
  total,
  paid,
  status,
}: {
  total: number
  paid: number
  status: string
}) {
  const due = Math.max(0, total - paid)
  const tone = status === "paid" ? "tone-emerald" : status === "partial" ? "tone-amber" : "tone-rose"
  return (
    <div className="flex flex-wrap justify-start gap-2">
      <span className="tone tone-emerald rounded-full px-2.5 py-1 text-[11px] font-semibold">Paid {money(paid)}</span>
      <span className="tone tone-rose rounded-full px-2.5 py-1 text-[11px] font-semibold">Outstanding {money(due)}</span>
      <span className={`tone rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${tone}`}>{status}</span>
    </div>
  )
}

export function PaymentTimeline({ payments }: { payments: PaymentLine[] }) {
  if (payments.length === 0) return null
  const ordered = [...payments].sort((left, right) => left.created_at.localeCompare(right.created_at))
  return (
    <ol className="mx-auto max-w-md space-y-3 border-l border-[var(--line)] py-1 pl-4">
      {ordered.map((payment, index) => (
        <li key={payment.id} className="relative">
          <span className="absolute -left-[1.2rem] top-1 size-2 rounded-full bg-[var(--scheme)]" />
          <p className="text-xs font-semibold text-gray-900">
            Installment {index + 1} · {METHODS.find((item) => item.id === payment.method)?.label ?? payment.method} · {money(Number(payment.amount))}
          </p>
          <p className="text-[11px] text-gray-500">
            {new Date(payment.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {payment.note ? ` · ${payment.note}` : ""}
          </p>
          {payment.attachment_id ? (
            <a className="text-[11px] font-semibold text-[var(--scheme)] hover:underline" href={`/api/attachments/${payment.attachment_id}/file`} target="_blank" rel="noreferrer">
              Payment photo
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function RecordPayment({
  invoiceId,
  due,
  onDone,
  payUrl,
  onPreview,
}: {
  invoiceId?: string
  due: string
  onDone: () => void | Promise<void>
  payUrl?: string
  onPreview?: (url: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(due)
  const [method, setMethod] = useState("upi")
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const previewUrl = useRef<string | null>(null)

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
  }, [])

  function chooseFile(next: File | null) {
    setFile(next)
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    const url = next ? URL.createObjectURL(next) : null
    previewUrl.current = url
    onPreview?.(url)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError("Attach a photo of this payment")
      return
    }
    setBusy(true)
    setError("")
    try {
      const body = new FormData()
      body.append("file", file)
      const stored = await api<{ id: string }>("/api/attachments", { method: "POST", body })
      await api(payUrl ?? `/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount, method, note: note || null, attachment_id: stored.id }),
      })
      await onDone()
      setOpen(false)
      chooseFile(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed")
    } finally {
      setBusy(false)
    }
  }

  const owed = due.trim() === "" ? null : Number(due)
  if (owed !== null && owed <= 0) return null
  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => { setAmount(due); setOpen(true) }}>
        Record payment
      </Button>
    )
  }

  return (
    <form className="mt-2 grid gap-2 text-left" onSubmit={(event) => void save(event)}>
      <Input type="number" min="0.01" step="0.01" required disabled={busy} value={amount} onChange={(event) => setAmount(event.target.value)} />
      <select className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm" value={method} disabled={busy} onChange={(event) => setMethod(event.target.value)}>
        {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <Input placeholder="Note" disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} />
      <label className={`inline-flex h-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-5 text-sm font-medium text-[var(--ink)] ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        {busy ? "Uploading photo…" : file ? file.name : "Choose a photo"}
        <input
          required
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-8 bg-[var(--scheme)] text-xs text-white">{busy ? "Uploading photo…" : "Save installment"}</Button>
        <Button type="button" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => { chooseFile(null); setOpen(false) }}>Cancel</Button>
      </div>
    </form>
  )
}
