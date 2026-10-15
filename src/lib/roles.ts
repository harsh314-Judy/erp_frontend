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
