import { Navigate } from "react-router-dom"
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Factory,
  FileCheck,
  Shield,
  Truck,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { PlantLoader } from "@/components/PlantLoader"
import { Button } from "@/components/ui/button"

export function LandingPage() {
  const { user, ready } = useAuth()
  if (!ready) return <PlantLoader />
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="relative min-h-svh overflow-hidden bg-gradient-to-b from-[#060e1d] via-[#0a1832] to-[#040a14] text-white">
      {/* Background Decorative Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-96 -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 size-80 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 text-lg font-black text-slate-950 shadow-lg shadow-amber-500/25 ring-1 ring-white/20">
            S
          </span>
          <div>
            <p className="font-bold tracking-tight text-white">Sai Daya Steel</p>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] font-medium tracking-wide text-slate-400">PLANT ERP SYSTEM</p>
            </div>
          </div>
        </div>
        <Button asChild className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
          <a href="/login" className="flex items-center gap-2">
            <span>Sign In</span>
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-12">
        <div className="landing-rise lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            <Shield className="size-3.5" />
            <span>Industrial Steel Manufacturing & Distribution</span>
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">
            Steel processing, from sheet to dispatch.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
            Complete plant workflow orchestration. Manage real-time stock holds, stage-by-stage operator routing, automated CGST/SGST invoices, and incoming vehicle plate verification.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-xl">
              <a href="/login" className="flex items-center gap-2">
                <span>Access Plant Portal</span>
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300 backdrop-blur-md">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>Plant operations online 24/7</span>
            </div>
          </div>
        </div>

        {/* Live Plant Preview Card */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Factory className="size-5 text-amber-400" />
                <span className="text-sm font-bold text-white">Live Floor Status</span>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                Active Batch #804
              </span>
            </div>

            {/* Stages Pipeline */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span className="text-slate-200">1. Cutting & Slitting</span>
                </div>
                <span className="text-emerald-400 font-medium">Done</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs ring-1 ring-blue-400/20">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-semibold text-white">2. Hydraulic Bending</span>
                </div>
                <span className="rounded-md bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                  IN PROGRESS
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-slate-600" />
                  <span>3. Surface Polishing (Wet)</span>
                </div>
                <span>Queued</span>
              </div>
            </div>

            {/* Production Bars */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Shift Output (MT)</span>
                <span className="font-semibold text-amber-400">+18.4% vs Target</span>
              </div>
              <div className="mt-3 flex h-36 items-end gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                {[35, 60, 48, 85, 62, 92, 78].map((height, index) => (
                  <div
                    key={index}
                    className="landing-bar flex-1 rounded-t-lg bg-gradient-to-t from-amber-600 to-amber-400 shadow-xs shadow-amber-500/30"
                    style={{ height: `${height}%`, animationDelay: `${index * 80}ms` }}
                  />
                ))}
              </div>
            </div>

            {/* Truck Arrival Pill */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Truck className="size-4 text-cyan-400" />
                <span className="text-slate-300">Incoming Coil: MH-12-Q-9910</span>
              </div>
              <span className="text-[11px] font-semibold text-cyan-300">Verified at Gate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="relative z-10 border-t border-white/10 bg-slate-950/40 py-16 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
              <Boxes className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Stock Holds</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Automatic reservation of sheets and raw materials when production jobs or sales orders trigger.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
              <Factory className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Stage Routing</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Step-by-step operator sign-off for cutting, bending, welding, wet/dry polishing, and final inspection.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <FileCheck className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">GST Invoicing</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              State-aware CGST, SGST, and IGST calculation with delivery charge segregation and thermal print support.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
              <Truck className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Gate Verification</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Mismatch detection between expected and arrived vehicle plates with receipt attachment proof.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
