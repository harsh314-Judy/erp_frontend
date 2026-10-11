import { useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/auth/AuthContext"
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

export function MembersPage() {
  const { canManageMembers, user } = useAuth()
  const [members, setMembers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role_id: "",
  })

  useEffect(() => {
    if (!canManageMembers) return
    void api<Page<UserProfile>>("/api/users?page=1&page_size=100").then((page) =>
      setMembers(page.items),
    )
    void api<Page<RoleRecord>>("/api/roles?page=1&page_size=100").then((page) => {
      const visible = page.items.filter(
        (role) => role.role_name !== "super_admin" || user?.role_name === "super_admin",
      )
      setRoles(visible)
      setForm((current) => ({
        ...current,
        role_id: current.role_id || visible[0]?.id || "",
      }))
    })
  }, [canManageMembers, user?.role_name])

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
      setOpen(false)
      setForm({ email: "", first_name: "", last_name: "", role_id: roles[0]?.id ?? "" })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (!canManageMembers) {
    return <p>Only admins can view members.</p>
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Invite someone by email. They only need to set a password.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Invite member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>They will receive a link to set a password.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={(event) => void invite(event)}>
              <div className="grid gap-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                />
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
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
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
      {notice ? <p className="text-sm">{notice}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                {[member.first_name, member.last_name].filter(Boolean).join(" ")}
              </TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{member.role_name}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
