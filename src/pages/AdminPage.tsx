import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  KeyRound,
  Mail,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { IdentityForm, type IdentityValues } from "@/components/IdentityForm"
import { FormBusy, PageLoading } from "@/components/PlantLoader"
import { Notice, PageTitle } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, errorMessage, type Page, type RoleRecord, type UserProfile } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { ROLE_NOTES, ROLE_ORDER, canEditIdentity, roleLabel } from "@/lib/roles"
import { cn } from "@/lib/utils"

export function AdminPage() {
  const { user, canAccessAdmin } = useAuth()
  const [members, setMembers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [error, setError] = useState("")
  const [editError, setEditError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const { busy, guard } = useFormBusy()
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role_id: "",
  })

  async function load() {
    try {
    const [userPage, rolePage] = await Promise.all([
      api<Page<UserProfile>>("/api/users?page=1&page_size=100"),
      api<Page<RoleRecord>>("/api/roles?page=1&page_size=100"),
    ])
    const visible = rolePage.items.filter((role) => {
      if (user?.role_name === "super_admin") return true
      return role.role_name === "accountant" || role.role_name === "staff"
    })
    setMembers(userPage.items)
    setRoles(visible)
    setForm((current) => ({
      ...current,
      role_id: current.role_id || visible.find((role) => role.role_name === "staff")?.id || visible[0]?.id || "",
    }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canAccessAdmin) {
      setLoading(false)
      return
    }
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, user?.role_name])

  async function invite(event: FormEvent) {
    event.preventDefault()
    setError("")
    setNotice("")
    await guard(async () => {
    try {
      const result = await api<{ message: string }>("/api/auth/invites", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          last_name: form.last_name || null,
        }),
      })
      setNotice(result.message)
      setInviteOpen(false)
      setForm({
        email: "",
        first_name: "",
        last_name: "",
        role_id: roles.find((role) => role.role_name === "staff")?.id ?? roles[0]?.id ?? "",
      })
    } catch (caught) {
      setError(errorMessage(caught))
    }
    })
  }

  async function saveIdentity(values: IdentityValues) {
    if (!editing || !user) return
    setEditError("")
    await guard(async () => {
    setPending(true)
    try {
      const updated = await api<UserProfile>(`/api/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: values.first_name,
          last_name: values.last_name || null,
          email: values.email,
          ...(user.role_name === "super_admin"
            ? { identity_overridden: values.identity_overridden ?? true }
            : {}),
        }),
      })
      setMembers((current) => current.map((member) => (member.id === updated.id ? updated : member)))
      setEditing(null)
      setNotice("Profile updated successfully.")
    } catch (caught) {
      setEditError(errorMessage(caught))
    } finally {
      setPending(false)
    }
    })
  }

  if (!canAccessAdmin || !user) {
    return <Navigate to="/" replace />
  }

  const orderedRoles = [...roles].sort(
    (left, right) => ROLE_ORDER.indexOf(left.role_name as (typeof ROLE_ORDER)[number]) -
      ROLE_ORDER.indexOf(right.role_name as (typeof ROLE_ORDER)[number]),
  )

  const roleCardStyles: Record<string, { bg: string; text: string; border: string }> = {
    super_admin: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    admin: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    accountant: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    staff: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Plant Personnel & Access Control"
        hint="Enterprise access management. Manage roles, invitation links, and profile identity permissions."
        icon={Users}
        badge={`${members.length} Members`}
        action={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs transition-all active:scale-[0.98]">
                <UserPlus className="mr-1.5 size-4" />
                Invite New Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-white border-gray-200/90 shadow-xl">
              <FormBusy show={busy} label="Sending invite" />
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200">
                    <UserPlus className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-gray-900">Invite Plant Member</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                      An email invitation will be dispatched with single-click setup.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <form className="mt-4 grid gap-4" onSubmit={(event) => void invite(event)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm">
                    <Label htmlFor="first_name" className="text-xs font-semibold text-gray-700">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="e.g. Vikram"
                      value={form.first_name}
                      onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5 text-sm">
                    <Label htmlFor="last_name" className="text-xs font-semibold text-gray-700">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="e.g. Patil"
                      value={form.last_name}
                      onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5 text-sm">
                  <Label htmlFor="invite_email" className="text-xs font-semibold text-gray-700">Work Email Address</Label>
                  <Input
                    id="invite_email"
                    type="email"
                    placeholder="vikram@saidayasteel.com"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5 text-sm">
                  <Label htmlFor="role_id" className="text-xs font-semibold text-gray-700">Assigned Plant Role</Label>
                  <select
                    id="role_id"
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 shadow-2xs focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                    value={form.role_id}
                    onChange={(event) => setForm({ ...form, role_id: event.target.value })}
                    required
                  >
                    {orderedRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {roleLabel(role.role_name)}
                      </option>
                    ))}
                  </select>
                </div>
                {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
                <DialogFooter className="mt-2 border-t border-gray-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-white shadow-xs"
                  >
                    Send Invitation
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Role Descriptions Grid */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_ORDER.map((roleName) => {
          const style = roleCardStyles[roleName] || { bg: "bg-white", text: "text-gray-700", border: "border-gray-200" }
          return (
            <article
              key={roleName}
              className={cn(
                "rounded-2xl border p-4 shadow-xs transition-all hover:shadow-sm",
                style.border,
                style.bg,
              )}
            >
              <div className="flex items-center gap-2">
                <Shield className={cn("size-4", style.text)} />
                <h2 className={cn("text-xs font-bold uppercase tracking-wider", style.text)}>
                  {roleLabel(roleName)}
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{ROLE_NOTES[roleName]}</p>
            </article>
          )
        })}
      </section>

      {notice ? <Notice variant="success">{notice}</Notice> : null}
      {error && !inviteOpen ? <Notice variant="error">{error}</Notice> : null}

      {/* Members Table */}
      {loading ? (
        <PageLoading label="Loading people" variant="table" cols={5} count={5} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs">
        <div className="border-b border-gray-100 bg-gray-50/75 px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Active User Directory
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-gray-100">
                <TableHead className="text-xs font-bold text-gray-700">Member</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Email Address</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Role</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Permission Status</TableHead>
                <TableHead className="w-24 text-xs font-bold text-gray-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const editable = canEditIdentity(user, member)
                const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
                const roleStyle = roleCardStyles[member.role_name || ""] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" }

                return (
                  <TableRow key={member.id} className="border-gray-100 hover:bg-gray-50/80">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 border border-green-200 text-xs font-bold">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {member.first_name} {member.last_name ?? ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3 text-gray-400" />
                        <span>{member.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold capitalize",
                          roleStyle.bg,
                          roleStyle.text,
                          roleStyle.border,
                        )}
                      >
                        {roleLabel(member.role_name)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {member.identity_overridden ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          <KeyRound className="size-3" />
                          Super Admin Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <UserCheck className="size-3 text-green-600" />
                          Self-Managed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          onClick={() => setEditing(member)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* Edit Profile Modal */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg bg-white border-gray-200/90 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Edit Member Account</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {editing ? `${editing.first_name} ${editing.last_name ?? ""} · ${roleLabel(editing.role_name)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="mt-4">
              <IdentityForm
                key={editing.id}
                initial={{
                  first_name: editing.first_name,
                  last_name: editing.last_name ?? "",
                  email: editing.email,
                  identity_overridden: user.role_name === "super_admin" ? true : editing.identity_overridden,
                }}
                disabled={false}
                pending={pending}
                error={editError}
                showOverride={user.role_name === "super_admin"}
                onSubmit={saveIdentity}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
