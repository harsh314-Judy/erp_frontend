import { Link } from "react-router-dom"
import {
  Package, ShoppingCart, Factory, LayoutDashboard,
  ArrowRight, CheckCircle2, Boxes, FileText
} from "lucide-react"

const features = [
  { icon: LayoutDashboard, title: "Smart Dashboard",   desc: "Live KPIs, production metrics, and sales at a glance.", color: "text-green-600 bg-green-50" },
  { icon: Factory,         title: "Production",        desc: "Track job cards, material usage, and work orders.",      color: "text-blue-600 bg-blue-50"  },
  { icon: Package,         title: "Inventory",         desc: "Manage finished goods and raw materials in real time.",  color: "text-purple-600 bg-purple-50" },
  { icon: ShoppingCart,    title: "Purchases",         desc: "Streamlined PO creation, approval, and tracking.",      color: "text-amber-600 bg-amber-50" },
  { icon: FileText,        title: "Sales & Invoicing", desc: "Raise invoices, track payments, and manage customers.", color: "text-pink-600 bg-pink-50"   },
  { icon: Boxes,           title: "Materials",         desc: "Raw material planning with supplier integration.",       color: "text-teal-600 bg-teal-50"  },
]

const perks = [
  "Role-based access control",
  "Mobile-first, works anywhere",
  "Live notifications",
  "Multi-currency support",
  "Reports & analytics",
  "Audit trail",
]

export function LandingPage() {
  return (
    <div className="min-h-svh bg-[#e6e8ec] flex flex-col">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-none bg-green-600 text-white font-bold text-sm border border-black shadow-xs">S</div>
            <span className="font-bold text-gray-900 text-sm">Sai Daya Steel</span>
          </div>
          <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-gray-800 border border-black px-2 py-0.5 rounded-none bg-white">
            ERP System
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-none border border-black bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors shadow-xs"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-none bg-green-600 border border-black px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-xs"
            >
              Get started <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center gap-6 px-5 pb-16 pt-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700 animate-rise">
          <span className="size-1.5 rounded-full bg-green-500" />
          Built for steel manufacturing
        </div>

        <div className="max-w-2xl space-y-4 animate-rise stagger-1">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Run your plant with
            <span className="text-green-600"> clarity</span>
          </h1>
          <p className="mx-auto max-w-lg text-base sm:text-lg text-gray-500 leading-relaxed">
            A modern ERP built specifically for steel manufacturing — track production, inventory, sales, and purchasing in one unified system.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 animate-rise stagger-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-none bg-green-600 border border-black px-6 py-3 text-sm font-bold text-white hover:bg-green-700 transition-all duration-150 shadow-xs active:scale-[0.98]"
          >
            Open workspace <ArrowRight className="size-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-none border border-black bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors shadow-xs"
          >
            Learn more
          </a>
        </div>

        {/* Perks row */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-2 animate-rise stagger-3">
          {perks.map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
              <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="mb-8 text-center animate-rise">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Everything you need</h2>
          <p className="mt-2 text-base text-gray-500">Powerful modules working together seamlessly.</p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className={`rounded-none border border-black bg-white p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 animate-rise stagger-${Math.min(i + 1, 5)}`}
              >
                <div className={`mb-3 grid size-10 place-items-center rounded-none border border-black ${f.color}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section className="mx-5 mb-12 overflow-hidden rounded-3xl bg-green-600 px-8 py-10 text-center text-white shadow-lg shadow-green-600/25">
        <h2 className="text-2xl font-bold">Ready to get started?</h2>
        <p className="mt-2 text-green-100 text-sm">Sign in to access your ERP workspace.</p>
        <Link
          to="/login"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-green-700 hover:bg-green-50 transition-colors shadow-sm"
        >
          Sign in to workspace <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="font-semibold text-gray-600">Sai Daya Steel ERP</span>
          <span className="hidden sm:inline">·</span>
          <span>© {new Date().getFullYear()} · All rights reserved</span>
        </div>
      </footer>
    </div>
  )
}
