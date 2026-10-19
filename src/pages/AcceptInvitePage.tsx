import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { AuthCard } from "@/components/AuthCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, type UserProfile } from "@/lib/api"

export function AcceptInvitePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [token] = useState(() => params.get("token") ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(token ? "" : "This invite link is missing a token.")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (params.get("token")) setParams({}, { replace: true })
  }, [params, setParams])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const user = await api<UserProfile>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      })
      setUser(user)
      navigate("/", { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="Accept invite"
      description="Choose a password to finish creating your account."
    >
      <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-slate-300">Choose a Secure Password (Min 8 Characters)</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-2.5 text-xs font-semibold text-rose-300">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending || !token}
          className="h-10 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-blue-500 hover:to-indigo-500 transition-all"
        >
          {pending ? "Creating account..." : "Complete Setup & Access ERP"}
        </Button>
      </form>
    </AuthCard>
  )
}
