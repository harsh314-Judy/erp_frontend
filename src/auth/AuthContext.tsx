import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { api, type UserProfile } from "@/lib/api"
import { roleCan } from "@/lib/access"

type AuthState = {
  user: UserProfile | null
  ready: boolean
  setUser: (user: UserProfile | null) => void
  canAccessAdmin: boolean
  can: (capability: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    api<UserProfile>("/api/users/me")
      .then((profile) => {
        if (active) setUser(profile)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      setUser,
      canAccessAdmin: user?.role_name === "admin" || user?.role_name === "super_admin",
      can: (capability: string) => roleCan(user?.role_name, capability),
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
