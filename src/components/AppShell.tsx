import { useEffect, useRef, useState, type ReactNode } from "react"
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom"
import { Bell, ChevronDown, LogOut, Menu, Moon, PanelLeft, Sun, X } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { api, prefetch, type UserProfile } from "@/lib/api"
import { NAV } from "@/lib/nav"
import { PageChromeProvider, usePageChrome } from "@/lib/page-chrome"
import { roleLabel } from "@/lib/roles"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "erp.sidebar.collapsed"
const THEME_KEY = "erp.theme"

type Notice = {
  id: string
  title: string
  body: string
  kind?: string
  link: string | null
  read_at: string | null
  created_at?: string
}

function HeaderIdentity({ company }: { company: string }) {
  const chromeApi = usePageChrome()
  const chrome = chromeApi?.scrolled ? chromeApi.chrome : null
  const Icon = chrome?.icon
  return (
    <>
      <div className={cn("flex min-w-0 items-center gap-2.5", chrome && "hidden sm:flex")}>
        <span className="truncate text-sm font-bold tracking-tight text-gray-900">{company}</span>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--ink-muted)]">
          <span className="size-1.5 animate-pulse rounded-full" style={{ background: "#27a644" }} />
          Plant live
        </span>
      </div>
      {chrome && Icon ? (
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn("grid size-7 shrink-0 place-items-center border border-black/30 text-white", chrome.iconBg)}>
            <Icon className="size-3.5" />
          </div>
          <span className="truncate text-sm font-bold tracking-tight text-gray-900">{chrome.title}</span>
        </div>
      ) : null}
    </>
  )
}

export function AppShell() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet()
  const pages = useRef(new Map<string, ReactNode>())
  if (outlet && !pages.current.has(location.pathname)) {
    pages.current.set(location.pathname, outlet)
  }

  useEffect(() => {
    if (!document.querySelector("[role='dialog']")) return
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
    )
  }, [location.pathname])
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(STORAGE_KEY) === "1")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [company, setCompany] = useState("Sai Daya Steel")
  const [notices, setNotices] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    CORE: true,
    OPERATIONS: true,
    INVENTORY: true,
    COMMERCE: true,
    ADMINISTRATION: true,
  })

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    setDark(next)
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    api<{ company_name: string }>("/api/company")
      .then((row) => setCompany(row.company_name || "Sai Daya Steel"))
      .catch(() => {})
    const timer = window.setTimeout(() => {
      prefetch([
        "/api/dashboard",
        "/api/sales/orders",
        "/api/customers/?page=1&page_size=100",
        "/api/products?page=1&page_size=100&brief=true",
        "/api/products?page=1&page_size=100&q=",
        "/api/products?page=1&page_size=500&brief=true",
        "/api/users/options",
        "/api/raw-materials/?page=1&page_size=100&q=",
        "/api/raw-materials/?page=1&page_size=100&brief=true",
        "/api/raw-materials/?page=1&page_size=500&brief=true",
        "/api/suppliers?page=1&page_size=100",
        "/api/suppliers?page=1&page_size=500",
        "/api/production-jobs/?page=1&page_size=50",
        "/api/purchase-orders",
        "/api/measurement-units?page=1&page_size=100",
        "/api/product-categories?page=1&page_size=100",
        "/api/raw-materials/categories?page=1&page_size=100",
        "/api/operations?page=1&page_size=100",
        "/api/reports/sales",
        "/api/reports/production",
        "/api/reports/inventory",
        "/api/company",
      ])
    }, 250)
    return () => window.clearTimeout(timer)
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

  // Group links by section for visual structure
  const sections = ["CORE", "OPERATIONS", "INVENTORY", "COMMERCE", "ADMINISTRATION"]

  return (
    <PageChromeProvider scrolled={scrolled}>
    <div className="app-root min-h-svh bg-[#f5f5f7]">

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
          "app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-black/10 bg-white/70",
          "transition-[width,transform] duration-200 ease-out",
          "w-72 max-w-[85vw] lg:max-w-none",
          collapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo / Brand with original colors and sharp black border */}
        <div className={cn(
          "flex h-16 items-center gap-3 border-b border-black/10 shrink-0",
          collapsed ? "lg:justify-center px-2" : "px-4"
        )}>
          {/* Brand logo box with original green colors and sharp black border */}
          <div className="relative shrink-0">
            <div className="grid size-9 place-items-center rounded-[12px] bg-[var(--scheme)] text-[15px] font-semibold tracking-tight text-white shadow-sm">
              S
            </div>
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1 animate-slide-in">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[15px] font-semibold tracking-tight text-gray-900">{company}</p>
              </div>
              <p className="text-[11px] font-medium text-gray-500">Plant</p>
            </div>
          )}

          {/* Mobile close */}
          <button
            type="button"
            className="ml-auto grid size-8 place-items-center rounded-full text-gray-500 hover:bg-black/5 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav links with colorful icon boxes and section groups */}
        <nav className="custom-scroll touch-scroll flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {sections.map((sec) => {
            const secLinks = links.filter((item) => item.section === sec)
            if (secLinks.length === 0) return null
            const open = openSections[sec] !== false

            return (
              <div key={sec} className="space-y-1">
                {!collapsed && (
                  <button
                    type="button"
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-[var(--hover)]"
                    onClick={() => setOpenSections((current) => ({ ...current, [sec]: !open }))}
                  >
                    <span className="text-[11px] font-medium tracking-[0.4px] text-[var(--ink-soft)]">
                      {sec.charAt(0) + sec.slice(1).toLowerCase()}
                    </span>
                    <ChevronDown className={cn("size-3.5 text-[var(--ink-soft)] transition", open && "rotate-180")} />
                  </button>
                )}
                {(collapsed || open) && secLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => cn(
                        "group flex items-center gap-3 rounded-md px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                        collapsed ? "lg:justify-center lg:px-1.5" : "",
                        isActive
                          ? "bg-[var(--scheme-soft)] text-[var(--scheme)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--hover)]"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <div className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-md",
                            isActive ? "text-[var(--scheme)]" : "text-[var(--ink-soft)]"
                          )}>
                            <Icon className="size-4" />
                          </div>
                          {!collapsed && (
                            <span className={cn("truncate flex-1 tracking-tight", isActive ? "font-medium text-[var(--scheme)]" : "text-[var(--ink)]")}>
                              {item.label}
                            </span>
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
        <div className="border-t border-black/10 p-3 shrink-0">
          <div className={cn(
            "flex items-center gap-2.5 rounded-2xl bg-black/5 p-2",
            collapsed ? "lg:justify-center lg:bg-transparent lg:p-0" : ""
          )}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--scheme)] text-[11px] font-semibold text-white">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900 tracking-tight">{name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[11px] font-medium text-gray-500">
                    {roleLabel(user?.role_name)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-gray-600 hover:bg-black/5 transition-colors",
              collapsed ? "lg:justify-center px-0" : ""
            )}
          >
            <LogOut className="size-3.5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────── */}
      <div className={cn(
        "flex min-h-svh flex-col transition-[padding] duration-200 ease-out min-w-0 w-full max-w-full overflow-x-hidden",
        collapsed ? "lg:pl-16" : "lg:pl-64",
      )}>

        {/* ── Top header with sharp borders and black details ── */}
        <header
          className={cn(
            "app-header fixed top-0 right-0 z-30 flex h-16 items-center gap-2 sm:gap-3 px-3 sm:px-4 transition-[left] duration-200 ease-out",
            "left-0",
            collapsed ? "lg:left-16" : "lg:left-64",
            scrolled
              ? "border-b border-transparent bg-transparent shadow-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-24 before:backdrop-blur-xl before:bg-[linear-gradient(to_bottom,rgba(245,245,247,0.94),rgba(245,245,247,0.5)_58%,transparent)] before:[mask-image:linear-gradient(to_bottom,black_42%,transparent)]"
              : "border-b border-black/10 bg-white/70",
          )}
        >

          {/* Mobile hamburger */}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-gray-600 hover:bg-black/5 lg:hidden transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4.5" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            className="hidden lg:grid size-9 place-items-center rounded-full text-gray-600 hover:bg-black/5 transition-colors"
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="size-4.5" />
          </button>

          <HeaderIdentity company={company} />

          {/* Right actions */}
          <div className="relative ml-auto flex items-center gap-3">
            {/* Notification bell */}
            <button
              type="button"
              className="relative grid size-9 place-items-center rounded-full text-gray-600 hover:bg-black/5 transition-colors"
              onClick={() => setBellOpen((o) => !o)}
            >
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#ff3b30] ring-2 ring-white" />
              )}
            </button>

            {/* Notification dropdown */}
            {bellOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-black/10 bg-white/90 shadow-2xl backdrop-blur-xl animate-scale-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
                  <p className="text-[13px] font-semibold tracking-tight text-gray-900">Notifications</p>
                  {unread > 0 && (
                    <span className="rounded-full bg-[var(--scheme-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--scheme)]">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto custom-scroll divide-y divide-gray-100">
                  {notices.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[13px] text-gray-400">All caught up</p>
                  ) : notices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "block w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors",
                        !item.read_at && "bg-emerald-50/50 border-l-2 border-l-emerald-600"
                      )}
                      onClick={() => void openNotice(item)}
                    >
                      <div className="flex items-start gap-2">
                        {!item.read_at && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--scheme)]" />}
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

            <button
              type="button"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={dark}
              className="grid size-9 place-items-center rounded-full text-gray-600 hover:bg-black/5 transition-colors"
              onClick={toggleTheme}
            >
              {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>

            {/* Avatar / profile link */}
            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-black/5"
            >
              <div className="grid size-7 place-items-center rounded-full bg-[var(--scheme)] text-[10px] font-semibold text-white">
                {initials}
              </div>
              <span className="hidden md:block text-xs font-semibold text-gray-800">{name}</span>
            </NavLink>
          </div>
        </header>

        {/* ── Page content (App-like, fits 100% display without side scroll) ── */}
        <main className="flex-1 min-w-0 w-full max-w-full p-2.5 pt-16 sm:p-5 sm:pt-20 lg:p-6 lg:pt-20 overflow-x-hidden">
          {[...pages.current.entries()].map(([path, node]) => (
            <div key={path} data-page={path} className={path === location.pathname ? "min-w-0" : "hidden"}>
              {node}
            </div>
          ))}
        </main>
      </div>
    </div>
    </PageChromeProvider>
  )
}

export type { UserProfile }
