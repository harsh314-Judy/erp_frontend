import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { AuthCard } from "@/components/AuthCard"
import { FormBusy } from "@/components/PlantLoader"
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
  const lock = useRef(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
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
      lock.current = false
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="This replaces the password on your account."
      footer={
        <Link className="text-xs font-semibold text-green-700 hover:text-green-800 underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="relative grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FormBusy show={pending} label="Saving" />
        <div className="grid gap-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-gray-700">New Password (Min 8 Characters)</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="border-gray-200 bg-white"
          />
        </div>
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending || !token}
          className="h-10 rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
        >
          {pending ? "Saving..." : "Update password"}
        </Button>
      </form>
    </AuthCard>
  )
}
