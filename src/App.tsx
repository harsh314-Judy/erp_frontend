import type { ReactNode } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { AppShell } from "@/components/AppShell"
import { AcceptInvitePage } from "@/pages/AcceptInvitePage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { MembersPage } from "@/pages/MembersPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { ResetPasswordPage } from "@/pages/ResetPasswordPage"

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
