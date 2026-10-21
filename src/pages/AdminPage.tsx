import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  Download,
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
import { api, downloadActivity, errorMessage, type ActivityBoard, type BreakRosterItem, type Page, type PersonStatus, type RoleRecord, type UserProfile } from "@/lib/api"
import { useFormBusy } from "@/lib/busy"
import { ROLE_NOTES, ROLE_ORDER, ROLE_THEME, canEditIdentity, roleLabel } from "@/lib/roles"
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
  const [tab, setTab] = useState(user?.role_name ?? "staff")
  const [board, setBoard] = useState<ActivityBoard | null>(null)
  const [roster, setRoster] = useState<BreakRosterItem[]>([])
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
    if (!canAccessAdmin) return
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, user?.role_name])

  useEffect(() => {
    if (!canAccessAdmin || tab === "breaks") return
    void api<ActivityBoard>(`/api/activity/board?role=${encodeURIComponent(tab)}`)
      .then(setBoard)
      .catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, tab, notice])

  useEffect(() => {
    if (!canAccessAdmin || tab !== "breaks") return
    void api<BreakRosterItem[]>("/api/activity/breaks")
      .then(setRoster)
      .catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, tab])

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

  async function saveBreak(userId: string, minutes: number | null) {
    setError("")
    try {
      const updated = await api<BreakRosterItem>(`/api/activity/breaks/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ minutes }),
      })
      setRoster((current) => current.map((row) => (row.user_id === userId ? updated : row)))
    } catch (caught) {
      setError(errorMessage(caught))
    }
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

  const theme = ROLE_THEME[user.role_name ?? ""] ?? ROLE_THEME.staff
  const visibleMembers = members.filter((member) => member.role_name === tab)
  const presence = new Map((board?.people ?? []).map((person) => [person.user_id, person]))

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
              <FormBusy show={busy} label="Sending invite" />
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
                    disabled={busy}
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

      <article className={cn("flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-lg", theme.banner)}>
        <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl ring-1", theme.chip)}>
          <Shield className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Your role</p>
          <h2 className="text-xl font-semibold tracking-tight text-white">{roleLabel(user.role_name)}</h2>
          <p className="mt-0.5 text-sm text-slate-300">{ROLE_NOTES[user.role_name ?? ""]}</p>
        </div>
      </article>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Roles">
        {ROLE_ORDER.map((roleName) => {
          const style = ROLE_THEME[roleName]
          const count = members.filter((member) => member.role_name === roleName).length
          const selected = tab === roleName
          return (
            <button
              key={roleName}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                selected ? style.tab : style.idle,
              )}
              onClick={() => {
                setBoard(null)
                setTab(roleName)
              }}
            >
              {roleLabel(roleName)}
              <span className={cn("rounded-full px-1.5 text-[11px]", selected ? "bg-white/20" : "bg-black/20")}>
                {count}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "breaks"}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
            tab === "breaks"
              ? "bg-amber-600 text-white shadow-md shadow-amber-950/40"
              : "bg-[#1a1f2b] text-amber-100 ring-1 ring-amber-500/35 hover:bg-amber-500/10",
          )}
          onClick={() => setTab("breaks")}
        >
          Breaks
        </button>
        {tab === "breaks" ? null : (
        <Button
          type="button"
          variant="outline"
          className="ml-auto rounded-full border-[#2b3447] bg-[#151924] text-slate-200"
          onClick={() => void downloadActivity(tab).catch((caught) => setError(errorMessage(caught)))}
        >
          <Download className="mr-1.5 size-4" />
          Excel this year
        </Button>
        )}
      </div>

      {tab === "breaks" ? null : (
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
        <span className="rounded-full bg-[#1a1f2b] px-3 py-1 ring-1 ring-[#2b3447]">
          Seen today {board?.seen_today ?? 0}
        </span>
      </div>
      )}

      {notice ? <Notice variant="success">{notice}</Notice> : null}
      {error && !inviteOpen ? <Notice variant="error">{error}</Notice> : null}

      {tab === "breaks" ? (
        <BreakAllocations rows={roster} onChange={(userId, minutes) => void saveBreak(userId, minutes)} />
      ) : (
      <>
      {/* Members Table */}
      {loading ? (
        <PageLoading label="Loading people" variant="table" cols={5} count={5} />
      ) : (
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
                <TableHead className="text-xs font-bold text-slate-300">Floor</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Permission Status</TableHead>
                <TableHead className="w-24 text-xs font-bold text-slate-300 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No {roleLabel(tab).toLowerCase()} accounts yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {visibleMembers.map((member) => {
                const editable = canEditIdentity(user, member)
                const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
                const roleStyle = ROLE_THEME[member.role_name || ""] ?? ROLE_THEME.staff
                const floor = presence.get(member.id)

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
                          <p className="text-[11px] text-slate-500">{floor?.device_label ?? "No device recorded yet"}</p>
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
                      <span className={cn("inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1", roleStyle.chip)}>
                        {roleLabel(member.role_name)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">{floorText(floor)}</TableCell>
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
      )}

      <section className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b]">
        <div className="border-b border-[#262e3f] px-5 py-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {roleLabel(tab)} activity this year
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sign-in, sign-out, and the area of the plant they opened. A repeat visit to the same area within 15 minutes is not stored again. Phone model numbers appear only when the browser shares them. Break time is not recorded here.
          </p>
        </div>
        <ul className="divide-y divide-[#262e3f]">
          {(board?.events ?? []).length === 0 ? (
            <li className="px-5 py-6 text-xs text-slate-500">No activity recorded for this role yet.</li>
          ) : (
            board?.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {event.person}
                    <span className="ml-2 text-xs font-medium text-slate-400">{actionLabel(event.action)}</span>
                  </p>
                  <p className="text-xs text-slate-400">{event.summary}</p>
                  <p className="text-[11px] text-slate-500">{deviceText(event)}</p>
                </div>
                <time className="text-xs text-slate-400" dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))
          )}
        </ul>
      </section>
      </>
      )}

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

function BreakAllocations({
  rows,
  onChange,
}: {
  rows: BreakRosterItem[]
  onChange: (userId: string, minutes: number | null) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b]">
      <div className="border-b border-[#262e3f] px-5 py-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Daily break allowance</h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose 30, 45, or 60 minutes for each person. They start the timer themselves and can split the time however they like. Nothing is logged about when they take it.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Daily break</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.user_id}>
                <TableCell>
                  <p className="font-semibold text-slate-100">{row.person}</p>
                  <p className="text-xs text-slate-500">{row.email}</p>
                </TableCell>
                <TableCell className="text-slate-300">{roleLabel(row.role_name)}</TableCell>
                <TableCell>
                  <select
                    className="h-9 rounded-xl border border-[#2b3447] bg-[#151924] px-3 text-sm text-slate-200"
                    value={row.minutes ?? ""}
                    onChange={(event) => onChange(row.user_id, event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">No break</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function floorText(floor: PersonStatus | undefined): string {
  if (!floor?.last_seen_at) return "No session yet"
  const minutes = Math.round((Date.now() - new Date(floor.last_seen_at).getTime()) / 60000)
  if (minutes < 2) return "Active now"
  if (minutes < 60) return `Seen ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `Seen ${hours}h ago`
  return `Seen ${new Date(floor.last_seen_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
}

const ACTION_LABEL: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  failed_login: "Failed sign-in",
  break_start: "Started a break",
  break_end: "Ended a break",
  visit: "Opened an area",
  invite: "Sent an invite",
  profile: "Updated a profile",
  password: "Changed a password",
  remove: "Removed an account",
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

function deviceText(event: {
  browser: string | null
  os_name: string | null
  device_type: string | null
  device_model: string | null
}): string {
  const parts = [event.browser, event.os_name].filter(Boolean)
  const base = parts.length > 0 ? parts.join(" on ") : "Device not recorded"
  return `${base}${event.device_type ? ` · ${event.device_type}` : ""}${event.device_model ? ` · ${event.device_model}` : ""}`
}
