import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  Search,
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
import { api, errorMessage, type AttendanceRow, type Page, type RoleRecord, type UserProfile } from "@/lib/api"
import { holidayName } from "@/lib/holidays"
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
  const [query, setQuery] = useState("")
  const [month, setMonth] = useState(() => indiaMonth())
  const [selectedDay, setSelectedDay] = useState(() => indiaDayKey())
  const [sessions, setSessions] = useState<AttendanceRow[]>([])
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
    if (!canAccessAdmin) return
    void api<AttendanceRow[]>(`/api/attendance?year=${month.year}&month=${month.month}`)
      .then(setSessions)
      .catch((caught) => setError(errorMessage(caught)))
  }, [canAccessAdmin, month.year, month.month])

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

  const ownRole = user.role_name ?? "staff"
  const ownTheme = ROLE_THEME[ownRole] ?? ROLE_THEME.staff
  const visibleMembers = members.filter((member) => {
    if (member.role_name !== tab) return false
    const haystack = `${member.first_name} ${member.last_name ?? ""} ${member.email}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="space-y-6">
      <PageTitle
        title="Plant Personnel & Access Control"
        hint="Only super admins and admins see this page. The calendar shows sign-in and sign-out for every role."
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

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Roles">
        {ROLE_ORDER.map((roleName) => {
          const style = ROLE_THEME[roleName]
          const selected = tab === roleName
          const count = members.filter((member) => member.role_name === roleName).length
          return (
            <button
              key={roleName}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "inline-flex items-center gap-2 rounded-none border px-3.5 py-2 text-sm font-semibold transition-colors",
                selected ? style.tab : style.idle,
              )}
              onClick={() => {
                setQuery("")
                setTab(roleName)
              }}
            >
              {roleLabel(roleName)}
              <span className={cn("px-1.5 text-[11px] font-mono", selected ? "bg-white/20" : "bg-black/5")}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <article className={cn("max-w-2xl border p-5 shadow-xs", ownTheme.banner)}>
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">Your role</p>
        <div className="mt-1 flex items-center gap-2">
          <Shield className={cn("size-5", ownTheme.title)} />
          <h2 className={cn("text-lg font-bold tracking-tight", ownTheme.title)}>{roleLabel(ownRole)}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{ROLE_NOTES[ownRole]}</p>
      </article>

      {notice ? <Notice variant="success">{notice}</Notice> : null}
      {error && !inviteOpen ? <Notice variant="error">{error}</Notice> : null}

      {loading ? (
        <PageLoading label="Loading people" variant="table" cols={5} count={5} />
      ) : (
        <div className="overflow-hidden border border-black bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                {roleLabel(tab)} directory
              </span>
              <label className="relative block">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or email"
                  className="h-9 w-56 border border-black bg-white pr-3 pl-8 text-xs text-gray-900 outline-none"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-gray-50/50">
                  <TableRow className="border-gray-100">
                    <TableHead className="text-xs font-bold text-gray-700">Member</TableHead>
                    <TableHead className="text-xs font-bold text-gray-700">Email</TableHead>
                    <TableHead className="text-xs font-bold text-gray-700">Identity</TableHead>
                    <TableHead className="w-24 text-right text-xs font-bold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-xs text-gray-500">
                        No one in this role matches that search.
                      </TableCell>
                    </TableRow>
                  ) : visibleMembers.map((member) => {
                    const editable = canEditIdentity(user, member)
                    const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
                    const chip = ROLE_THEME[member.role_name || ""] ?? ROLE_THEME.staff
                    return (
                      <TableRow key={member.id} className="border-gray-100 hover:bg-gray-50/80">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("grid size-9 shrink-0 place-items-center border text-xs font-bold", chip.chip)}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {member.first_name} {member.last_name ?? ""}
                                {member.id === user.id ? (
                                  <span className="ml-2 border border-black bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white">You</span>
                                ) : null}
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
                          {member.identity_overridden ? (
                            <span className="inline-flex items-center gap-1.5 border border-violet-700 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-900">
                              <KeyRound className="size-3" />
                              Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <UserCheck className="size-3 text-green-700" />
                              Self-managed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editable ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-none border-black bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50"
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

      <AttendanceCalendar
        month={month}
        selectedDay={selectedDay}
        sessions={sessions}
        onMonth={(next) => {
          setMonth(next)
          setSelectedDay(`${next.year}-${String(next.month).padStart(2, "0")}-01`)
        }}
        onSelectDay={setSelectedDay}
      />

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

type MonthCursor = { year: number; month: number }

function AttendanceCalendar({
  month,
  selectedDay,
  sessions,
  onMonth,
  onSelectDay,
}: {
  month: MonthCursor
  selectedDay: string
  sessions: AttendanceRow[]
  onMonth: (next: MonthCursor) => void
  onSelectDay: (day: string) => void
}) {
  const cells = monthCells(month.year, month.month)
  const marked = new Set(sessions.map((row) => indiaDayKey(new Date(row.signed_in_at))))
  const dayRows = sessions
    .filter((row) => indiaDayKey(new Date(row.signed_in_at)) === selectedDay)
    .sort((left, right) => left.signed_in_at.localeCompare(right.signed_in_at))
  const label = new Date(month.year, month.month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })

  function shift(delta: number) {
    const date = new Date(month.year, month.month - 1 + delta, 1)
    onMonth({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }

  return (
    <section className="overflow-hidden border-2 border-black bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-5 py-3.5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Attendance</h2>
          <p className="mt-1 text-xs text-gray-500">Sign-in and sign-out for every role. India time. Amber days are gazetted public holidays.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="grid size-8 place-items-center border border-black" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-gray-900">{label}</span>
          <button type="button" className="grid size-8 place-items-center border border-black" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b-2 border-black text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <div key={name} className="px-1 py-2">{name}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const key = day ? dayKey(month.year, month.month, day) : `empty-${index}`
          const selected = day !== null && key === selectedDay
          const holiday = day !== null ? holidayName(key) : null
          return (
            <button
              key={key}
              type="button"
              disabled={day === null}
              title={holiday ?? undefined}
              onClick={() => day !== null && onSelectDay(key)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center border-r border-b border-gray-400 px-0.5 py-1 text-sm disabled:bg-transparent",
                selected
                  ? "bg-gray-900 font-bold text-white"
                  : holiday
                    ? "bg-amber-50 text-gray-900 hover:bg-amber-100"
                    : "text-gray-800 hover:bg-gray-100",
              )}
            >
              <span>{day ?? ""}</span>
              {holiday ? (
                <span className={cn("max-w-full truncate text-[9px] font-medium leading-tight", selected ? "text-amber-200" : "text-amber-800")}>
                  {holiday}
                </span>
              ) : null}
              {day !== null && marked.has(key) && !selected ? (
                <span className="mt-0.5 block size-1.5 bg-gray-900" />
              ) : null}
            </button>
          )
        })}
      </div>
      <ul className="divide-y divide-gray-100">
        {dayRows.length === 0 ? (
          <li className="px-5 py-4 text-xs text-gray-500">No sign-in on this day.</li>
        ) : dayRows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {row.person}
              <span className="ml-2 text-xs font-medium text-gray-500">{roleLabel(row.role_name)}</span>
            </p>
            <p className="text-xs text-gray-600">
              In {clockTime(row.signed_in_at)}
              <span className="mx-1.5 text-gray-300">/</span>
              {row.signed_out_at ? `Out ${clockTime(row.signed_out_at)}` : "Still signed in"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function indiaMonth(): MonthCursor {
  const key = indiaDayKey()
  const [year, month] = key.split("-").map(Number)
  return { year, month }
}

function indiaDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function monthCells(year: number, month: number): Array<number | null> {
  const first = new Date(`${dayKey(year, month, 1)}T12:00:00+05:30`)
  const lead = (first.getUTCDay() + 6) % 7
  const count = new Date(year, month, 0).getDate()
  return [...Array<number | null>(lead).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
}

function clockTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  })
}
