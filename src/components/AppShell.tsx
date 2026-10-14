import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeft,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { Button } from "@/components/ui/button"
import { api, type UserProfile } from "@/lib/api"
import { roleCan } from "@/lib/access"
import { roleLabel } from "@/lib/roles"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "erp.sidebar.collapsed"

type Notice = {
  id: string
  title: string
  body: string
  link: string | null
  read_at: string | null
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { to: "/users", label: "User Management", icon: Users, show: (role: string | null | undefined) => roleCan(role, "manage_staff_users") },
  { to: "/accountant", label: "Accountant Work", icon: Receipt, show: (role: string | null | undefined) => roleCan(role, "approve_jobs") },
  { to: "/staff", label: "Staff Work", icon: Wrench, show: (role: string | null | undefined) => role === "staff" },
  { to: "/reports", label: "Reports", icon: BarChart3, show: (role: string | null | undefined) => roleCan(role, "view_reports") },
  { to: "/products", label: "Products", icon: Package, show: (role: string | null | undefined) => roleCan(role, "view_inventory") },
  { to: "/materials", label: "Raw Materials", icon: Boxes, show: (role: string | null | undefined) => roleCan(role, "view_inventory") },
  { to: "/bom", label: "Bill of Materials", icon: ClipboardList, show: (role: string | null | undefined) => roleCan(role, "view_inventory") },
  { to: "/production", label: "Production", icon: Factory, show: (role: string | null | undefined) => roleCan(role, "view_assigned_work") },
  { to: "/suppliers", label: "Suppliers", icon: Truck, show: (role: string | null | undefined) => roleCan(role, "view_suppliers") },
  { to: "/purchases", label: "Purchase Orders", icon: ShoppingCart, show: (role: string | null | undefined) => roleCan(role, "manage_purchasing") || role === "staff" },
  { to: "/sales", label: "Sales", icon: FileText, show: (role: string | null | undefined) => roleCan(role, "manage_sales") },
  { to: "/customers", label: "Customers", icon: UserRound, show: (role: string | null | undefined) => roleCan(role, "manage_sales") },
  { to: "/settings", label: "Company", icon: Settings, show: (role: string | null | undefined) => roleCan(role, "manage_company") },
]

export function AppShell() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(STORAGE_KEY) === "1")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [company, setCompany] = useState("Sai Daya Steel")
  const [notices, setNotices] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  useEffect(() => {
    api<{ company_name: string }>("/api/company")
      .then((row) => setCompany(row.company_name || "Sai Daya Steel"))
      .catch(() => setCompany("Sai Daya Steel"))
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const [items, count] = await Promise.all([
        api<Notice[]>("/api/notifications"),
        api<{ count: number }>("/api/notifications/unread-count"),
      ])
      if (!active) return
      setNotices(items)
      setUnread(count.count)
    }
    void load().catch(() => undefined)
    const timer = window.setInterval(() => void load().catch(() => undefined), 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    setUser(null)
    navigate("/")
  }

  async function openNotice(item: Notice) {
    if (!item.read_at) {
      await api(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => undefined)
      setUnread((current) => Math.max(0, current - 1))
    }
    setBellOpen(false)
    if (item.link) navigate(item.link)
  }

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const links = NAV.filter((item) => item.show(user?.role_name))

  return (
    <div className="min-h-svh bg-[#f4f6f8]">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-[#0c1b33] text-white transition-[width,transform] duration-200",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-2")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#f5b400] font-bold text-[#0c1b33]">
            S
          </span>
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <p className="truncate text-sm font-semibold">{company}</p>
            <p className="text-xs text-white/60">ERP System</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto text-white hover:bg-white/10 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav className="mt-2 grid gap-1 overflow-auto px-2">
          {links.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10",
                    collapsed && "justify-center px-0",
                    isActive && "bg-[#f08a00] font-medium text-white hover:bg-[#f08a00]",
                  )
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-3">
          <div className={cn("mb-2 min-w-0", collapsed && "sr-only")}>
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-white/60">{roleLabel(user?.role_name)}</p>
          </div>
          <button
            type="button"
            title="Log out"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-white/10",
              collapsed && "justify-center",
            )}
            onClick={() => void logout()}
          >
            <LogOut className="size-4" />
            <span className={cn(collapsed && "sr-only")}>Log out</span>
          </button>
        </div>
      </aside>
      <div className={cn("flex min-h-svh min-w-0 flex-col", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-white px-3">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed((current) => !current)}
          >
            <PanelLeft />
          </Button>
          <p className="truncate text-sm text-muted-foreground">{company}</p>
          <div className="relative ml-auto">
            <Button type="button" variant="ghost" size="icon" aria-label="Notifications" onClick={() => setBellOpen((open) => !open)}>
              <Bell />
            </Button>
            {unread > 0 ? (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[#f08a00] px-1 text-[10px] text-white">
                {unread}
              </span>
            ) : null}
            {bellOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border bg-white p-2 shadow-lg">
                {notices.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No notifications</p>
                ) : (
                  notices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                      onClick={() => void openNotice(item)}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.body}</p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <NavLink to="/profile" className="text-sm font-medium">
            {name}
          </NavLink>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export type { UserProfile }
