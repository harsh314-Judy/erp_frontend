import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { AuthCard } from "@/components/AuthCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage } from "@/lib/api"

export function ResetPasswordPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [token] = useState(() => params.get("token") ?? "")

  useEffect(() => {
    if (params.get("token")) setParams({}, { replace: true })
  }, [params, setParams])
  const [password, setPassword] = useState("")
  const [error, setError] = useState(token ? "" : "This reset link is missing a token.")
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      })
      navigate("/login", { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="This replaces the password on your account."
      footer={
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending || !token}>
          {pending ? "Saving..." : "Update password"}
        </Button>
      </form>
    </AuthCard>
  )
}
