import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  BarChart3,
  Bell,
  Boxes,
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
  {
    to: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
    iconColor: "text-white",
    iconBg: "bg-emerald-600",
    activeBorder: "border-l-emerald-600",
    dot: "bg-emerald-600",
    section: "CORE",
    show: () => true,
  },
  {
    to: "/reports",
    label: "Analytics & Reports",
    shortLabel: "Reports",
    icon: BarChart3,
    iconColor: "text-white",
    iconBg: "bg-indigo-600",
    activeBorder: "border-l-indigo-600",
    dot: "bg-indigo-600",
    section: "CORE",
    show: (r: string|null|undefined) => roleCan(r, "view_reports"),
  },
  {
    to: "/production",
    label: "Production Floor",
    shortLabel: "Floor",
    icon: Factory,
    iconColor: "text-white",
    iconBg: "bg-cyan-600",
    activeBorder: "border-l-cyan-600",
    dot: "bg-cyan-600",
    section: "OPERATIONS",
    show: (r: string|null|undefined) => roleCan(r, "view_assigned_work"),
  },
  {
    to: "/staff",
    label: "Operator Station",
    shortLabel: "Station",
    icon: Wrench,
    iconColor: "text-white",
    iconBg: "bg-amber-600",
    activeBorder: "border-l-amber-600",
    dot: "bg-amber-600",
    section: "OPERATIONS",
    show: (r: string|null|undefined) => r === "staff",
  },
  {
    to: "/products",
    label: "Products Catalog",
    shortLabel: "Products",
    icon: Package,
    iconColor: "text-white",
    iconBg: "bg-blue-600",
    activeBorder: "border-l-blue-600",
    dot: "bg-blue-600",
    section: "INVENTORY",
    show: (r: string|null|undefined) => roleCan(r, "view_inventory"),
  },
  {
    to: "/materials",
    label: "Raw Materials",
    shortLabel: "Stock",
    icon: Boxes,
    iconColor: "text-white",
    iconBg: "bg-teal-600",
    activeBorder: "border-l-teal-600",
    dot: "bg-teal-600",
    section: "INVENTORY",
    show: (r: string|null|undefined) => roleCan(r, "view_inventory"),
  },
  {
    to: "/purchases",
    label: "Purchase Orders",
    shortLabel: "Orders",
    icon: ShoppingCart,
    iconColor: "text-white",
    iconBg: "bg-rose-600",
    activeBorder: "border-l-rose-600",
    dot: "bg-rose-600",
    section: "COMMERCE",
    show: (r: string|null|undefined) => roleCan(r, "manage_purchasing") || r === "staff",
  },
  {
    to: "/sales",
    label: "Sales & Dispatch",
    shortLabel: "Sales",
    icon: FileText,
    iconColor: "text-white",
    iconBg: "bg-emerald-600",
    activeBorder: "border-l-emerald-600",
    dot: "bg-emerald-600",
    section: "COMMERCE",
    show: (r: string|null|undefined) => roleCan(r, "manage_sales"),
  },
  {
    to: "/customers",
    label: "Customer Clients",
    shortLabel: "Clients",
    icon: UserRound,
    iconColor: "text-white",
    iconBg: "bg-fuchsia-600",
    activeBorder: "border-l-fuchsia-600",
    dot: "bg-fuchsia-600",
    section: "COMMERCE",
    show: (r: string|null|undefined) => roleCan(r, "manage_sales"),
  },
  {
    to: "/suppliers",
    label: "Supplier Vendors",
    shortLabel: "Vendors",
    icon: Truck,
    iconColor: "text-white",
    iconBg: "bg-lime-600",
    activeBorder: "border-l-lime-600",
    dot: "bg-lime-600",
    section: "COMMERCE",
    show: (r: string|null|undefined) => roleCan(r, "view_suppliers"),
  },
  {
    to: "/accountant",
    label: "Approval Queue",
    shortLabel: "Approvals",
    icon: Receipt,
    iconColor: "text-white",
    iconBg: "bg-orange-600",
    activeBorder: "border-l-orange-600",
    dot: "bg-orange-600",
    section: "ADMINISTRATION",
    show: (r: string|null|undefined) => roleCan(r, "approve_jobs"),
  },
  {
    to: "/users",
    label: "Personnel & Access",
    shortLabel: "Staff",
    icon: Users,
    iconColor: "text-white",
    iconBg: "bg-purple-600",
    activeBorder: "border-l-purple-600",
    dot: "bg-purple-600",
    section: "ADMINISTRATION",
    show: (r: string|null|undefined) => roleCan(r, "manage_staff_users"),
  },
  {
    to: "/settings",
    label: "Company Profile",
    shortLabel: "Settings",
    icon: Settings,
    iconColor: "text-white",
    iconBg: "bg-neutral-800",
    activeBorder: "border-l-black",
    dot: "bg-black",
    section: "ADMINISTRATION",
    show: (r: string|null|undefined) => roleCan(r, "manage_company"),
  },
]

// Show at most 4 items in bottom mobile nav (+ menu)
const BOTTOM_NAV_LIMIT = 4

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
      .then((r) => setCompany(r.company_name || "Sai Daya Steel"))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      const [items, count] = await Promise.all([
        api<Notice[]>("/api/notifications"),
        api<{ count: number }>("/api/notifications/unread-count"),
      ])
      if (!alive) return
      setNotices(items)
      setUnread(count.count)
    }
    void load().catch(() => {})
    const t = window.setInterval(() => void load().catch(() => {}), 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {})
    setUser(null)
    navigate("/")
  }

  async function openNotice(item: Notice) {
    if (!item.read_at) {
      await api(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {})
      setUnread((n) => Math.max(0, n - 1))
    }
    setBellOpen(false)
    if (item.link) navigate(item.link)
  }

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const links = NAV.filter((item) => item.show(user?.role_name))
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"

  // Bottom nav = first BOTTOM_NAV_LIMIT visible links
  const bottomLinks = links.slice(0, BOTTOM_NAV_LIMIT)

  // Group links by section for visual structure
  const sections = ["CORE", "OPERATIONS", "INVENTORY", "COMMERCE", "ADMINISTRATION"]

  return (
    <div className="min-h-svh bg-[#f4f5f7]">

      {/* ── Mobile slide-over backdrop ─────────────────────── */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop + mobile slide-over) ─────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-black shadow-2xl rounded-none",
          "transition-[width,transform] duration-200 ease-out",
          "w-72 max-w-[85vw] lg:max-w-none",
          collapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo / Brand with original colors and sharp black border */}
        <div className={cn(
          "flex h-16 items-center gap-3 border-b border-black shrink-0 bg-white",
          collapsed ? "lg:justify-center px-2" : "px-4"
        )}>
          {/* Brand logo box with original green colors and sharp black border */}
          <div className="relative shrink-0">
            <div className="grid size-9 place-items-center bg-emerald-600 text-white font-mono font-black text-base border border-black shadow-xs rounded-none">
              S
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-2 bg-emerald-400 border border-black rounded-none" />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1 animate-slide-in">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-gray-900 tracking-tight font-sans">{company}</p>
                <span className="bg-emerald-50 text-emerald-800 border border-black text-[9px] font-mono font-bold px-1.5 py-0.2 tracking-wider rounded-none shrink-0">
                  ERP
                </span>
              </div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Plant Suite v2.6</p>
            </div>
          )}

          {/* Mobile close */}
          <button
            type="button"
            className="ml-auto grid size-8 place-items-center rounded-none text-gray-600 hover:bg-gray-100 hover:text-black lg:hidden border border-black"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav links with colorful icon boxes and section groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3 custom-scroll touch-scroll">
          {sections.map((sec) => {
            const secLinks = links.filter((item) => item.section === sec)
            if (secLinks.length === 0) return null

            return (
              <div key={sec} className="space-y-0.5">
                {!collapsed && (
                  <div className="px-2 pt-2 pb-1 flex items-center justify-between border-b border-gray-100 mb-1">
                    <span className="text-[9px] font-mono font-bold tracking-widest text-gray-600 uppercase">
                      {sec}
                    </span>
                    <span className="text-[8px] font-mono text-gray-400">■</span>
                  </div>
                )}
                {secLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => cn(
                        "group flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold rounded-none transition-all duration-150 border-l-[3px]",
                        collapsed ? "lg:justify-center px-1.5" : "",
                        isActive
                          ? "bg-emerald-50/90 text-emerald-950 border-l-emerald-600 font-bold border-y border-r border-gray-200 shadow-2xs"
                          : "border-l-transparent text-gray-700 hover:bg-gray-50 hover:text-black hover:border-l-gray-400"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <div className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-none border border-black/30 shadow-2xs transition-all duration-150",
                            item.iconBg, item.iconColor,
                            isActive ? "scale-105" : "opacity-90 group-hover:opacity-100"
                          )}>
                            <Icon className="size-3.5" />
                          </div>
                          {!collapsed && (
                            <span className={cn("truncate flex-1 tracking-tight text-xs", isActive ? "font-bold text-emerald-950" : "text-gray-700")}>
                              {item.label}
                            </span>
                          )}
                          {isActive && !collapsed && (
                            <span className="ml-auto size-1.5 rounded-none bg-emerald-600 border border-black/40 shrink-0" />
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User panel at bottom with sharp black border & micro tag */}
        <div className="border-t border-black p-2.5 shrink-0 bg-white">
          <div className={cn(
            "flex items-center gap-2.5 border border-black p-2 bg-gray-50/70 rounded-none",
            collapsed ? "lg:justify-center lg:border-none lg:bg-transparent lg:p-0" : ""
          )}>
            <div className="grid size-8 shrink-0 place-items-center bg-emerald-600 text-white text-xs font-mono font-bold rounded-none border border-black shadow-xs">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900 tracking-tight">{name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="bg-white text-gray-800 border border-black text-[8px] font-mono px-1 py-0.2 uppercase font-bold tracking-wider rounded-none">
                    {roleLabel(user?.role_name)}
                  </span>
                  <span className="size-1.5 bg-emerald-500 border border-black/30 rounded-none" />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "mt-1.5 flex w-full items-center gap-2 border border-black/20 hover:border-black rounded-none px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-all",
              collapsed ? "lg:justify-center px-0" : ""
            )}
          >
            <LogOut className="size-3.5 shrink-0" />
            {!collapsed && <span className="font-mono text-[11px] uppercase tracking-wider">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────── */}
      <div className={cn(
        "flex min-h-svh flex-col transition-[padding] duration-200 min-w-0 w-full max-w-full overflow-x-hidden",
        collapsed ? "lg:pl-16" : "lg:pl-64",
        "pb-20 lg:pb-0" // space for mobile bottom nav
      )}>

        {/* ── Top header with sharp borders and black details ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-3 border-b border-gray-200/90 bg-white/95 px-3 sm:px-4 backdrop-blur-md shadow-2xs w-full max-w-full overflow-hidden">

          {/* Mobile hamburger */}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-none border border-gray-200 hover:border-black text-gray-700 hover:text-black lg:hidden transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4.5" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            className="hidden lg:grid size-9 place-items-center rounded-none border border-gray-200 hover:border-black text-gray-700 hover:text-black transition-colors"
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="size-4.5" />
          </button>

          {/* Company name + black micro tag + live indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate tracking-tight">{company}</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-none bg-emerald-50 text-emerald-800 border border-black px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider">
              <span className="size-1.5 bg-emerald-500 rounded-none animate-pulse" />
              PLANT LIVE
            </span>
          </div>

          {/* Right actions */}
          <div className="relative ml-auto flex items-center gap-2">

            {/* Notification bell */}
            <button
              type="button"
              className="relative grid size-9 place-items-center rounded-none border border-black text-gray-700 hover:text-black hover:bg-gray-50 transition-colors"
              onClick={() => setBellOpen((o) => !o)}
            >
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 size-2 rounded-none bg-emerald-600 border border-white" />
              )}
            </button>

            {/* Notification dropdown */}
            {bellOpen && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-80 rounded-none border border-black bg-white shadow-xl animate-scale-in">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50/60">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-900">Notifications</p>
                  {unread > 0 && (
                    <span className="bg-emerald-50 text-emerald-800 border border-black text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-none">
                      {unread} NEW
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto custom-scroll divide-y divide-gray-100">
                  {notices.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-gray-400 font-mono">ALL CAUGHT UP</p>
                  ) : notices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "block w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors rounded-none",
                        !item.read_at && "bg-emerald-50/50 border-l-2 border-l-emerald-600"
                      )}
                      onClick={() => void openNotice(item)}
                    >
                      <div className="flex items-start gap-2">
                        {!item.read_at && <span className="mt-1 size-1.5 shrink-0 bg-emerald-600 rounded-none" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{item.title}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">{item.body}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Avatar / profile link */}
            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-none border border-black hover:bg-gray-50 px-2.5 py-1.5 transition-colors bg-white"
            >
              <div className="grid size-6 place-items-center rounded-none bg-emerald-600 text-[10px] font-mono font-bold text-white border border-black/30">
                {initials}
              </div>
              <span className="hidden md:block text-xs font-semibold text-gray-800">{name}</span>
            </NavLink>
          </div>
        </header>

        {/* ── Page content (App-like, fits 100% display without side scroll) ── */}
        <main className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-5 lg:p-6 animate-rise pb-24 lg:pb-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom navigation bar (Native App Tab Bar) ─── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex lg:hidden border-t border-black bg-white safe-bottom rounded-none shadow-lg w-full max-w-full overflow-hidden">
        {bottomLinks.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex flex-1 min-w-0 flex-col items-center justify-center gap-1 py-2 px-0.5 text-[10px] font-medium transition-all duration-150 rounded-none overflow-hidden",
                isActive ? "text-emerald-950 font-bold bg-emerald-50/80" : "text-gray-500 hover:text-black"
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    "grid size-6.5 place-items-center rounded-none border border-black/30 shadow-2xs transition-all duration-150 shrink-0",
                    item.iconBg, item.iconColor,
                    isActive ? "ring-2 ring-black scale-105" : "opacity-85"
                  )}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="truncate w-full text-center font-mono text-[8.5px] uppercase tracking-tight block">
                    {item.shortLabel || item.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}

        {/* "More" button for remaining links */}
        {links.length > BOTTOM_NAV_LIMIT && (
          <button
            type="button"
            className="flex flex-1 min-w-0 flex-col items-center justify-center gap-1 py-2 px-0.5 text-[10px] font-medium text-gray-500 hover:text-black rounded-none overflow-hidden"
            onClick={() => setMobileOpen(true)}
          >
            <span className="grid size-6.5 place-items-center rounded-none border border-black/20 bg-gray-50 text-gray-700 shrink-0">
              <Menu className="size-3.5" />
            </span>
            <span className="truncate w-full text-center font-mono text-[8.5px] uppercase tracking-tight block">MENU</span>
          </button>
        )}
      </nav>
    </div>
  )
}

export type { UserProfile }
