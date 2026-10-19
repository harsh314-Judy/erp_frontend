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
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role_id: "",
  })

  async function load() {
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
  }

  useEffect(() => {
    if (!canAccessAdmin) return
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, user?.role_name])

  async function invite(event: FormEvent) {
    event.preventDefault()
    setError("")
    setNotice("")
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
  }

  async function saveIdentity(values: IdentityValues) {
    if (!editing || !user) return
    setPending(true)
    setEditError("")
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
  }

  if (!canAccessAdmin || !user) {
    return <Navigate to="/" replace />
  }

  const orderedRoles = [...roles].sort(
    (left, right) => ROLE_ORDER.indexOf(left.role_name as (typeof ROLE_ORDER)[number]) -
      ROLE_ORDER.indexOf(right.role_name as (typeof ROLE_ORDER)[number]),
  )

  const roleCardStyles: Record<string, { bg: string; text: string; border: string }> = {
    super_admin: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30" },
    admin: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/30" },
    accountant: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30" },
    staff: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30" },
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
              <Button className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40">
                <UserPlus className="mr-1.5 size-4" />
                Invite New Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
                    <UserPlus className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-100">Invite Plant Member</DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                      An email invitation will be dispatched with single-click setup.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <form className="mt-4 grid gap-4" onSubmit={(event) => void invite(event)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm">
                    <Label htmlFor="first_name" className="text-xs font-semibold text-slate-300">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="e.g. Vikram"
                      value={form.first_name}
                      onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5 text-sm">
                    <Label htmlFor="last_name" className="text-xs font-semibold text-slate-300">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="e.g. Patil"
                      value={form.last_name}
                      onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5 text-sm">
                  <Label htmlFor="invite_email" className="text-xs font-semibold text-slate-300">Work Email Address</Label>
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
                  <Label htmlFor="role_id" className="text-xs font-semibold text-slate-300">Assigned Plant Role</Label>
                  <select
                    id="role_id"
                    className="h-10 rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm font-medium text-slate-200 shadow-2xs focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
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
                {error ? <p className="text-xs font-semibold text-rose-400">{error}</p> : null}
                <DialogFooter className="mt-2 border-t border-[#262e3f] pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#2b3447] bg-[#151924] text-slate-300 hover:bg-[#202737]"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-blue-500 hover:to-indigo-500"
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
          const style = roleCardStyles[roleName] || { bg: "bg-[#1a1f2b]", text: "text-slate-300", border: "border-[#262e3f]" }
          return (
            <article
              key={roleName}
              className={cn(
                "rounded-2xl border p-4 shadow-lg transition-all hover:scale-[1.01]",
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
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{ROLE_NOTES[roleName]}</p>
            </article>
          )
        })}
      </section>

      {notice ? <Notice variant="success">{notice}</Notice> : null}
      {error && !inviteOpen ? <Notice variant="error">{error}</Notice> : null}

      {/* Members Table */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-lg">
        <div className="border-b border-[#262e3f] bg-[#161a25]/70 px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Active User Directory
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-[#161a25]">
              <TableRow className="border-[#262e3f]">
                <TableHead className="text-xs font-bold text-slate-300">Member</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Email Address</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Role</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Permission Status</TableHead>
                <TableHead className="w-24 text-xs font-bold text-slate-300 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const editable = canEditIdentity(user, member)
                const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
                const roleStyle = roleCardStyles[member.role_name || ""] || { bg: "bg-[#161a25]", text: "text-slate-300", border: "border-[#2b3447]" }

                return (
                  <TableRow key={member.id} className="border-[#1f2636] hover:bg-[#202737]/60">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-xs font-bold text-white shadow-md shadow-indigo-500/20">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">
                            {member.first_name} {member.last_name ?? ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3 text-slate-400" />
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
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-300">
                          <KeyRound className="size-3" />
                          Super Admin Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <UserCheck className="size-3 text-emerald-400" />
                          Self-Managed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-[#2b3447] bg-[#151924] text-xs font-semibold text-slate-300 hover:bg-[#202737] hover:text-slate-100"
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

      {/* Edit Profile Modal */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-100">Edit Member Account</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
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
