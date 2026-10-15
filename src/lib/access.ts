const CAPABILITIES: Record<string, string[]> = {
  super_admin: [
    "manage_admins",
    "manage_staff_users",
    "view_financials",
    "approve_jobs",
    "edit_inventory",
    "view_inventory",
    "view_assigned_work",
    "manage_sales",
    "manage_purchasing",
    "view_suppliers",
    "manage_company",
    "view_reports",
  ],
  admin: [
    "manage_staff_users",
    "view_financials",
    "approve_jobs",
    "edit_inventory",
    "view_inventory",
    "view_assigned_work",
    "manage_sales",
    "manage_purchasing",
    "view_suppliers",
    "manage_company",
    "view_reports",
  ],
  accountant: [
    "approve_jobs",
    "edit_inventory",
    "view_inventory",
    "view_assigned_work",
    "manage_sales",
    "manage_purchasing",
    "view_suppliers",
    "view_reports",
  ],
  staff: ["view_assigned_work", "view_inventory"],
}

export function roleCan(roleName: string | null | undefined, capability: string): boolean {
  if (!roleName) return false
  return (CAPABILITIES[roleName] ?? []).includes(capability)
}

export function canSeePrices(roleName: string | null | undefined): boolean {
  return roleCan(roleName, "edit_inventory") || roleCan(roleName, "view_financials")
}
