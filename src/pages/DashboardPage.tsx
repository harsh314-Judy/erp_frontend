import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  Factory,
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Notice, PageTitle, StatCard } from "@/components/plant-ui"
import { api, errorMessage } from "@/lib/api"
import { roleCan } from "@/lib/access"
import { useAuth } from "@/auth/AuthContext"

type Dashboard = {
  role_name: string
  sales: { total_orders: number; pending_orders: number; total_sales?: string | null } | null
  production: {
    total_jobs: number
    completed_jobs: number
    jobs_in_progress: number
    pending_jobs: number
  } | null
  low_stock: number
  approvals: number
  unpaid_invoices: number
  my_jobs: number
  incoming_shipments: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  const chart = data?.production
    ? [
        { name: "Pending", value: data.production.pending_jobs, color: "#f59e0b" },
        { name: "Running", value: data.production.jobs_in_progress, color: "#3b82f6" },
        { name: "Done", value: data.production.completed_jobs, color: "#10b981" },
      ]
    : []

  return (
    <div className="space-y-6">
      <PageTitle
        title="Plant Dashboard"
        hint="Live operational overview of processing stages, inventory holds, and shipments."
        icon={LayoutDashboard}
        badge="Live"
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40"
            >
              <Factory className="size-4" />
              Production Floor
            </Link>
            <Link
              to="/materials"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b3447] bg-[#1a1f2b] px-3.5 py-2 text-xs font-semibold text-slate-300 shadow-sm transition-all hover:border-[#3b4760] hover:bg-[#202737]"
            >
              <Boxes className="size-4" />
              Raw Stock
            </Link>
          </div>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* KPI Stat Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="My Open Stages"
          value={data?.my_jobs ?? "–"}
          icon={Wrench}
          color="indigo"
          hint="Assigned directly to you"
        />
        <StatCard
          label="Low Stock Warning"
          value={data?.low_stock ?? "–"}
          icon={AlertTriangle}
          color="rose"
          hint="Below minimum plant threshold"
        />
        <StatCard
          label="Jobs Waiting Approval"
          value={data?.approvals ?? "–"}
          icon={Clock}
          color="amber"
          hint="Inspection & output sign-off"
        />
        <StatCard
          label="Incoming Vehicles"
          value={data?.incoming_shipments ?? "–"}
          icon={Truck}
          color="cyan"
          hint="Scheduled raw material shipments"
        />

        {roleCan(user?.role_name, "manage_sales") ? (
          <StatCard
            label="Unpaid Invoices"
            value={data?.unpaid_invoices ?? "–"}
            icon={Receipt}
            color="amber"
            hint="Awaiting payment reconciliation"
          />
        ) : null}

        {roleCan(user?.role_name, "view_financials") && data?.sales?.total_sales != null ? (
          <StatCard
            label="Total Sales (GST Incl)"
            value={`₹${Number(data.sales.total_sales).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            color="emerald"
            hint="Gross billing volume"
          />
        ) : null}

        {data?.sales ? (
          <StatCard
            label="Open Sales Orders"
            value={data.sales.pending_orders}
            icon={ShoppingBag}
            color="blue"
            hint="In dispatch pipeline"
          />
        ) : null}
      </div>

      {/* Production Chart & Floor Quick Access */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {chart.length > 0 ? (
            <Card className="border-[#262e3f] bg-[#1a1f2b] shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between border-b border-[#262e3f] pb-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-100">
                    Production Stage Distribution
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Real-time status of steel processing jobs
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="size-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                    Pending ({data?.production?.pending_jobs ?? 0})
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="size-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                    Running ({data?.production?.jobs_in_progress ?? 0})
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    Done ({data?.production?.completed_jobs ?? 0})
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="chart-note mb-3 text-sm text-slate-400">
                  Switch to a wider viewport to inspect the interactive production chart.
                </p>
                <div className="chart-wide h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#161a25",
                          color: "#f1f5f9",
                          borderRadius: "0.75rem",
                          border: "1px solid #2b3447",
                          fontSize: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                        }}
                        cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Quick Operations Guide */}
        <div className="space-y-4">
          <Card className="border-[#262e3f] bg-[#1a1f2b] shadow-lg">
            <CardHeader className="border-b border-[#262e3f] pb-3">
              <CardTitle className="text-sm font-bold text-slate-100">
                Floor Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              <Link
                to="/production"
                className="group flex items-center justify-between rounded-xl border border-[#262e3f] bg-[#161a25] p-3 transition-all hover:border-blue-500/40 hover:bg-[#1c2436]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Factory className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white">Start Production Job</p>
                    <p className="text-[11px] text-slate-400">Lock bill of materials & start stage</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-blue-400" />
              </Link>

              <Link
                to="/purchases"
                className="group flex items-center justify-between rounded-xl border border-[#262e3f] bg-[#161a25] p-3 transition-all hover:border-cyan-500/40 hover:bg-[#152332]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                    <Truck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white">Incoming Deliveries</p>
                    <p className="text-[11px] text-slate-400">Verify vehicle plate & add stock</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-400" />
              </Link>

              <Link
                to="/sales"
                className="group flex items-center justify-between rounded-xl border border-[#262e3f] bg-[#161a25] p-3 transition-all hover:border-emerald-500/40 hover:bg-[#142826]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <Receipt className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white">Sales & GST Invoices</p>
                    <p className="text-[11px] text-slate-400">Dispatch and print CGST/SGST invoices</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-400" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
