import type { ReactNode } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { AppShell } from "@/components/AppShell"
import { PlantLoader } from "@/components/PlantLoader"
import { AcceptInvitePage } from "@/pages/AcceptInvitePage"
import { AccountantPage } from "@/pages/AccountantPage"
import { AdminPage } from "@/pages/AdminPage"
import { BomPage } from "@/pages/BomPage"
import { CustomersPage } from "@/pages/CustomersPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { MaterialsPage } from "@/pages/MaterialsPage"
import { ProductionPage } from "@/pages/ProductionPage"
import { ProductsPage } from "@/pages/ProductsPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { PurchasesPage } from "@/pages/PurchasesPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { ResetPasswordPage } from "@/pages/ResetPasswordPage"
import { SalesPage } from "@/pages/SalesPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { StaffPage } from "@/pages/StaffPage"
import { SuppliersPage } from "@/pages/SuppliersPage"

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <PlantLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <PlantLoader />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<AdminPage />} />
        <Route path="admin" element={<Navigate to="/users" replace />} />
        <Route path="members" element={<Navigate to="/users" replace />} />
        <Route path="accountant" element={<AccountantPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="bom" element={<BomPage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
