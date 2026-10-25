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
        <Link className="text-xs font-semibold text-green-700 hover:text-green-800 underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="relative grid gap-4" onSubmit={onSubmit}>
        <FormBusy show={pending} label="Sending" />
        <div className="grid gap-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Registered Work Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="border-gray-200 bg-white"
          />
        </div>
        {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
        >
          {pending ? "Sending..." : "Send reset link"}
        </Button>
        {sent ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
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
