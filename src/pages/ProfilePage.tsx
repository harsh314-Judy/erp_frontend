import { useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  KeyRound,
  Lock,
  Shield,
  User,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { IdentityForm, type IdentityValues } from "@/components/IdentityForm"
import { FormBusy } from "@/components/PlantLoader"
import { Notice, PageTitle } from "@/components/plant-ui"
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
  const identityLock = useRef(false)
  const passwordLock = useRef(false)
  const locked = Boolean(user?.identity_overridden && user.role_name !== "super_admin")

  async function saveIdentity(values: IdentityValues) {
    if (identityLock.current) return
    identityLock.current = true
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
      setNotice("Profile information saved successfully.")
    } catch (caught) {
      setIdentityError(errorMessage(caught))
    } finally {
      identityLock.current = false
      setIdentityPending(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (passwordLock.current) return
    passwordLock.current = true
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
      passwordLock.current = false
      setPending(false)
    }
  }

  if (!user) return null

  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"

  return (
    <div className="space-y-6">
      <PageTitle
        title="Personal Profile & Security"
        hint="Manage your employee identity, contact credentials, and session authentication."
        icon={User}
        badge={roleLabel(user.role_name)}
      />

      {/* User Header Profile Card */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-green-50 text-green-700 border border-green-200 text-xl font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {user.first_name} {user.last_name ?? ""}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500">{user.email}</span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              <Shield className="size-3" />
              {roleLabel(user.role_name)}
            </span>
          </div>
        </div>
      </div>

      {notice ? <Notice variant="success">{notice}</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity Card */}
        <Card className="relative border-gray-200/90 bg-white shadow-xs rounded-2xl">
          <FormBusy show={identityPending} label="Saving" />
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                <User className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Identity & Contact Information
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Update your registered name and primary work email address.
                  {user.role_name === "super_admin"
                    ? " As super admin, changes here automatically lock the record."
                    : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
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

        {/* Password Security Card */}
        <Card className="border-gray-200/90 bg-white shadow-xs rounded-2xl">
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                <KeyRound className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Change Account Password
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Updating your password immediately signs out all active sessions on other devices.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="relative grid gap-4" onSubmit={(event) => void onSubmit(event)}>
              <FormBusy show={pending} label="Updating password" />
              <div className="grid gap-1.5 text-sm">
                <Label htmlFor="old_password" className="text-xs font-semibold text-gray-700">Current Password</Label>
                <Input
                  id="old_password"
                  type="password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5 text-sm">
                <Label htmlFor="new_password" className="text-xs font-semibold text-gray-700">New Password (Min 8 Characters)</Label>
                <Input
                  id="new_password"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  <Lock className="mr-1.5 size-4" />
                  {pending ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
