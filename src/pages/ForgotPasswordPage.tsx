import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import { AuthCard } from "@/components/AuthCard"
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

  async function send(path: string) {
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
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>
        {sent ? (
          <Button
            type="button"
            variant="outline"
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
