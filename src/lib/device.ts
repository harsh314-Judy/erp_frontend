export async function readDevice(): Promise<{
  device_model: string | null
  device_platform: string | null
  device_mobile: boolean | null
}> {
  const hints = navigator.userAgentData
  let platform = hints?.platform ?? null
  let model: string | null = null
  try {
    const high = await hints?.getHighEntropyValues?.(["model", "platform"])
    model = high?.model?.trim() || null
    platform = high?.platform || platform
  } catch {
    // The browser refused the device hint. Browser and OS still come from the user agent.
  }
  return {
    device_model: model,
    device_platform: platform,
    device_mobile: hints?.mobile ?? null,
  }
}

const MODULES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "User management",
  "/accountant": "Accountant work",
  "/staff": "Staff work",
  "/reports": "Reports",
  "/products": "Products",
  "/materials": "Raw materials",
  "/production": "Production",
  "/suppliers": "Suppliers",
  "/purchases": "Purchase orders",
  "/sales": "Sales",
  "/customers": "Customers",
  "/settings": "Company",
  "/profile": "Profile",
}

export function moduleLabel(pathname: string): string {
  if (MODULES[pathname]) return MODULES[pathname]
  const key = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`
  return MODULES[key] ?? pathname
}

declare global {
  interface Navigator {
    userAgentData?: {
      mobile?: boolean
      platform?: string
      getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string }>
    }
  }
}
