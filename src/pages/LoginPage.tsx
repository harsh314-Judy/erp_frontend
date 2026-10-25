import { useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { AuthCard } from "@/components/AuthCard"
import { FormBusy } from "@/components/PlantLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, type UserProfile } from "@/lib/api"

export function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const lock = useRef(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError("")
    try {
      const user = await api<UserProfile>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      setUser(user)
      navigate("/")
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password for your ERP account."
      footer={
        <Link className="text-xs font-semibold text-green-600 hover:text-green-700 underline-offset-4 hover:underline" to="/forgot-password">
          Forgot password?
        </Link>
      }
    >
      <form className="relative grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FormBusy show={pending} label="Signing in" />
        <div className="grid gap-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Work Email Address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all"
        >
          {pending ? "Signing in…" : "Sign in to ERP"}
        </Button>
      </form>
    </AuthCard>
  )
}
