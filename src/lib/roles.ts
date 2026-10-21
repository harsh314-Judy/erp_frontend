export const ROLE_ORDER = ["super_admin", "admin", "accountant", "staff"] as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  accountant: "Accountant",
  staff: "Staff",
}

export const ROLE_THEME: Record<string, { chip: string; tab: string; idle: string; banner: string }> = {
  super_admin: {
    chip: "bg-violet-500/15 text-violet-100 ring-violet-400/40",
    tab: "bg-violet-600 text-white shadow-md shadow-violet-950/50",
    idle: "bg-[#1a1f2b] text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/10",
    banner: "border-violet-400/40 bg-gradient-to-r from-violet-600/25 via-violet-500/10 to-[#1a1f2b]",
  },
  admin: {
    chip: "bg-sky-500/15 text-sky-100 ring-sky-400/40",
    tab: "bg-sky-600 text-white shadow-md shadow-sky-950/50",
    idle: "bg-[#1a1f2b] text-sky-200 ring-1 ring-sky-500/30 hover:bg-sky-500/10",
    banner: "border-sky-400/40 bg-gradient-to-r from-sky-600/25 via-sky-500/10 to-[#1a1f2b]",
  },
  accountant: {
    chip: "bg-teal-500/15 text-teal-100 ring-teal-400/40",
    tab: "bg-teal-600 text-white shadow-md shadow-teal-950/50",
    idle: "bg-[#1a1f2b] text-teal-200 ring-1 ring-teal-500/30 hover:bg-teal-500/10",
    banner: "border-teal-400/40 bg-gradient-to-r from-teal-600/25 via-teal-500/10 to-[#1a1f2b]",
  },
  staff: {
    chip: "bg-orange-500/15 text-orange-50 ring-orange-400/40",
    tab: "bg-orange-700 text-white shadow-md shadow-orange-950/50",
    idle: "bg-[#1a1f2b] text-orange-200 ring-1 ring-orange-500/30 hover:bg-orange-500/10",
    banner: "border-orange-400/40 bg-gradient-to-r from-orange-700/25 via-orange-500/10 to-[#1a1f2b]",
  },
}

export const ROLE_NOTES: Record<string, string> = {
  super_admin: "Overrides any name, surname, or email.",
  admin: "Edits accountant and staff names and emails until a super admin overrides them.",
  accountant: "Edits their own name, surname, and email.",
  staff: "Edits their own name, surname, and email.",
}

export function roleLabel(roleName: string | null | undefined): string {
  if (!roleName) return "Member"
  return ROLE_LABELS[roleName] ?? roleName
}

export function canEditIdentity(
  actor: { id: string; role_name: string | null },
  target: { id: string; role_name: string | null; identity_overridden: boolean },
): boolean {
  if (actor.role_name === "super_admin") return true
  if (target.identity_overridden) return false
  if (actor.id === target.id) return true
  return (
    actor.role_name === "admin" &&
    (target.role_name === "accountant" || target.role_name === "staff")
  )
}
