import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { IdentityForm, type IdentityValues } from "@/components/IdentityForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, type UserProfile } from "@/lib/api"
import { roleLabel } from "@/lib/roles"

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState("")
  const [identityError, setIdentityError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)
  const [identityPending, setIdentityPending] = useState(false)
  const locked = Boolean(user?.identity_overridden && user.role_name !== "super_admin")

  async function saveIdentity(values: IdentityValues) {
    setIdentityPending(true)
    setIdentityError("")
    setNotice("")
    try {
      const updated = await api<UserProfile>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: values.first_name,
          last_name: values.last_name || null,
          email: values.email,
        }),
      })
      if (updated) setUser(updated)
      setNotice("Profile saved.")
    } catch (caught) {
      setIdentityError(errorMessage(caught))
    } finally {
      setIdentityPending(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/users/me/password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      })
      setUser(null)
      navigate("/login")
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  if (!user) return null

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">{roleLabel(user.role_name)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Name and email</CardTitle>
          <CardDescription>
            You can update your own name, surname, and email.
            {user.role_name === "super_admin"
              ? " Saving a change here also overrides the account, so only a super admin can edit it afterward."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notice ? <p className="mb-3 text-sm">{notice}</p> : null}
          <IdentityForm
            key={`${user.id}-${user.email}-${user.first_name}-${user.last_name ?? ""}`}
            initial={{
              first_name: user.first_name,
              last_name: user.last_name ?? "",
              email: user.email,
            }}
            disabled={locked}
            pending={identityPending}
            error={identityError}
            showOverride={false}
            onSubmit={saveIdentity}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            You can change it three times a day. Other signed-in devices will be signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-2">
              <Label htmlFor="old_password">Current password</Label>
              <Input
                id="old_password"
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending} className="justify-self-start">
              {pending ? "Saving..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
