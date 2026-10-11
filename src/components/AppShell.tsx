import { NavLink, Outlet, useNavigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

export function AppShell() {
  const { user, canManageMembers, setUser } = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    setUser(null)
    navigate("/login")
  }

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ")

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto grid min-h-svh max-w-6xl md:grid-cols-[220px_1fr]">
        <aside className="border-b bg-background p-4 md:border-r md:border-b-0">
          <p className="px-2 text-lg font-semibold">ERP</p>
          <p className="px-2 pb-4 text-sm text-muted-foreground">{name}</p>
          <nav className="grid gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-2 py-2 text-sm ${isActive ? "bg-muted font-medium" : "hover:bg-muted/70"}`
              }
            >
              Home
            </NavLink>
            {canManageMembers ? (
              <NavLink
                to="/members"
                className={({ isActive }) =>
                  `rounded-md px-2 py-2 text-sm ${isActive ? "bg-muted font-medium" : "hover:bg-muted/70"}`
                }
              >
                Members
              </NavLink>
            ) : null}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `rounded-md px-2 py-2 text-sm ${isActive ? "bg-muted font-medium" : "hover:bg-muted/70"}`
              }
            >
              Profile
            </NavLink>
          </nav>
          <Button variant="outline" className="mt-6 w-full" onClick={() => void logout()}>
            Log out
          </Button>
        </aside>
        <section className="p-6">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
