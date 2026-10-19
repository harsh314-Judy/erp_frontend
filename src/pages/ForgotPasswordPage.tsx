import { useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import { AuthCard } from "@/components/AuthCard"
import { FormBusy } from "@/components/PlantLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage } from "@/lib/api"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const lock = useRef(false)

  async function send(path: string) {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError("")
    try {
      const result = await api<{ message: string }>(path, {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setMessage(result.message)
      setSent(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void send("/api/auth/forgot-password")
  }

  return (
    <AuthCard
      title="Reset password"
      description="We will email a link if this address has an account."
      footer={
        <Link className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="relative grid gap-4" onSubmit={onSubmit}>
        <FormBusy show={pending} label="Sending" />
        <div className="grid gap-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-slate-300">Registered Work Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2.5 text-xs font-semibold text-emerald-300">{message}</p> : null}
        {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-2.5 text-xs font-semibold text-rose-300">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-blue-500 hover:to-indigo-500 transition-all"
        >
          {pending ? "Sending..." : "Send reset link"}
        </Button>
        {sent ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#202737]"
            disabled={pending}
            onClick={() => void send("/api/auth/resend-reset")}
          >
            Resend email
          </Button>
        ) : null}
      </form>
    </AuthCard>
  )
}
