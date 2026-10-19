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

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"

  return (
    <div className="min-h-svh bg-[#13161f] text-slate-200">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#1f2533] bg-[#10131b] text-slate-200 shadow-xl transition-[width,transform] duration-200 ease-out",
          collapsed ? "w-18" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn("flex h-16 items-center gap-3 border-b border-[#1f2533] px-4", collapsed && "justify-center px-2")}>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 text-slate-950 font-black text-lg shadow-md shadow-amber-500/25 ring-1 ring-white/20">
            S
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
            <p className="truncate text-sm font-bold tracking-tight text-slate-100">{company}</p>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] font-medium tracking-wide text-slate-400">STEEL PLANT ERP</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-2.5 py-1">
          {links.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    collapsed && "justify-center px-0 py-2.5",
                    isActive
                      ? "bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-indigo-600/10 text-white shadow-xs ring-1 ring-blue-400/40"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
                  )
                }
                onClick={() => setMobileOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                        isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-200",
                      )}
                    />
                    <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                    {isActive ? (
                      <span className={cn("absolute right-2 size-1.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400", collapsed && "sr-only")} />
                    ) : null}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-[#1f2533] p-3">
          <div className={cn("mb-2 flex items-center gap-3 rounded-xl bg-[#161a25] p-2.5 ring-1 ring-white/5", collapsed && "justify-center p-1.5")}>
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
              <p className="truncate text-xs font-semibold text-slate-200">{name}</p>
              <span className="inline-block rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                {roleLabel(user?.role_name)}
              </span>
            </div>
          </div>
          <button
            type="button"
            title="Log out"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300",
              collapsed && "justify-center px-0",
            )}
            onClick={() => void logout()}
          >
            <LogOut className="size-4" />
            <span className={cn(collapsed && "sr-only")}>Sign out</span>
          </button>
        </div>
      </aside>

      <div className={cn("flex min-h-svh min-w-0 flex-col transition-[padding] duration-200", collapsed ? "lg:pl-18" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#222838] bg-[#141721]/90 px-4 backdrop-blur-md lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-300 hover:bg-slate-800/60 hover:text-white"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden text-slate-400 hover:bg-slate-800/60 hover:text-white lg:inline-flex"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed((current) => !current)}
          >
            <PanelLeft className="size-5" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-semibold text-slate-200 sm:inline-block">
              {company}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/25 md:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Floor
            </span>
          </div>

          <div className="relative ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "relative rounded-xl text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-100",
                unread > 0 && "text-blue-400",
              )}
              aria-label="Notifications"
              onClick={() => setBellOpen((open) => !open)}
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1 text-[10px] font-bold text-white shadow-xs">
                  {unread}
                </span>
              ) : null}
            </Button>

            {bellOpen ? (
              <div className="absolute right-0 top-full z-40 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-84 rounded-2xl border border-[#2c364b] bg-[#1c2230] p-2.5 shadow-2xl ring-1 ring-white/5 animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#242c3d] px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Notifications</p>
                  {unread > 0 ? (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                      {unread} unread
                    </span>
                  ) : null}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {notices.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-slate-400">All caught up! No notifications.</p>
                  ) : (
                    notices.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "block w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                          item.read_at ? "hover:bg-slate-800/50" : "bg-blue-600/10 hover:bg-blue-600/15",
                        )}
                        onClick={() => void openNotice(item)}
                      >
                        <div className="flex items-center gap-1.5">
                          {!item.read_at ? <span className="size-1.5 rounded-full bg-blue-400 shrink-0" /> : null}
                          <p className="truncate text-xs font-semibold text-slate-200">{item.title}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{item.body}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-xl border border-[#2b3447] bg-[#1a1f2b] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-[#202737] hover:border-[#38435c]"
            >
              <div className="grid size-6 place-items-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-[10px] font-bold text-white shadow-2xs">
                {initials}
              </div>
              <span className="hidden sm:inline font-semibold">{name}</span>
            </NavLink>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 animate-in fade-in-50 duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export type { UserProfile }
