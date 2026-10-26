export const ROLE_ORDER = ["super_admin", "admin", "accountant", "staff"] as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  accountant: "Accountant",
  staff: "Staff",
}

export const ROLE_NOTES: Record<string, string> = {
  super_admin: "Overrides any name, surname, or email.",
  admin: "Edits accountant and staff names and emails until a super admin overrides them.",
  accountant: "Edits their own name, surname, and email.",
  staff: "Edits their own name, surname, and email.",
}

export const ROLE_THEME: Record<
  string,
  { tab: string; idle: string; banner: string; chip: string; title: string }
> = {
  super_admin: {
    tab: "border-black bg-violet-700 text-white",
    idle: "border-violet-700 bg-white text-violet-900 hover:bg-violet-50",
    banner: "border-black bg-violet-50",
    chip: "border-violet-700 bg-violet-50 text-violet-900",
    title: "text-violet-950",
  },
  admin: {
    tab: "border-black bg-sky-700 text-white",
    idle: "border-sky-700 bg-white text-sky-950 hover:bg-sky-50",
    banner: "border-black bg-sky-50",
    chip: "border-sky-700 bg-sky-50 text-sky-950",
    title: "text-sky-950",
  },
  accountant: {
    tab: "border-black bg-teal-700 text-white",
    idle: "border-teal-700 bg-white text-teal-950 hover:bg-teal-50",
    banner: "border-black bg-teal-50",
    chip: "border-teal-700 bg-teal-50 text-teal-950",
    title: "text-teal-950",
  },
  staff: {
    tab: "border-black bg-orange-600 text-white",
    idle: "border-orange-600 bg-white text-orange-950 hover:bg-orange-50",
    banner: "border-black bg-orange-50",
    chip: "border-orange-600 bg-orange-50 text-orange-950",
    title: "text-orange-950",
  },
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
