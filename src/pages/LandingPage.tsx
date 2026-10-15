import { Navigate } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { Button } from "@/components/ui/button"

export function LandingPage() {
  const { user, ready } = useAuth()
  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="min-h-svh bg-[#071426] text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-[#f5b400] text-lg font-bold text-[#071426]">
            S
          </span>
          <div>
            <p className="font-semibold">Sai Daya Steel</p>
            <p className="text-xs text-white/60">ERP System</p>
          </div>
        </div>
        <Button asChild className="bg-[#f08a00] text-white hover:bg-[#d97b00]">
          <a href="/login">Sign in</a>
        </Button>
      </header>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div className="landing-rise">
          <p className="text-sm uppercase tracking-[0.2em] text-[#f5b400]">Invite only</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            Steel processing, from sheet to dispatch.
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Track stock holds, stage-by-stage production, GST invoices, and incoming
            vehicles in one plant system.
          </p>
          <Button asChild className="mt-8 bg-[#f08a00] text-white hover:bg-[#d97b00]">
            <a href="/login">Open the plant</a>
          </Button>
        </div>
        <div className="flex h-56 items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-6">
          {[40, 70, 55, 90, 65, 80].map((height, index) => (
            <div
              key={height}
              className="landing-bar flex-1 rounded-t-md bg-[#f08a00]"
              style={{ height: `${height}%`, animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
