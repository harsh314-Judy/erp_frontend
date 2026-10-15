import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { IdentityForm, type IdentityValues } from "@/components/IdentityForm"
import { Badge } from "@/components/ui/badge"
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
      setNotice("Profile updated.")
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Roles are in place. Detailed responsibilities can be added later.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>Invite member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>They receive a link and only need to set a password.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={(event) => void invite(event)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">Name</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Surname</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite_email">Email</Label>
                <Input
                  id="invite_email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role_id">Role</Label>
                <select
                  id="role_id"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
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
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="submit">Send invite</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_ORDER.map((roleName) => (
          <article key={roleName} className="rounded-lg border bg-background p-4">
            <h2 className="font-medium">{roleLabel(roleName)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{ROLE_NOTES[roleName]}</p>
          </article>
        ))}
      </section>

      {notice ? <p className="text-sm">{notice}</p> : null}
      {error && !inviteOpen ? <p className="text-sm text-destructive">{error}</p> : null}

      <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground lg:hidden">
        This directory is built for a wide screen. Scroll sideways to read every column.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Surname</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Identity</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const editable = canEditIdentity(user, member)
              return (
                <TableRow key={member.id}>
                  <TableCell>{member.first_name}</TableCell>
                  <TableCell>{member.last_name || "—"}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabel(member.role_name)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.identity_overridden ? "Super admin override" : "Editable"}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing(member)}>
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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              {editing ? `${editing.first_name} · ${roleLabel(editing.role_name)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
