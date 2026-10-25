import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  Factory,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wrench,
  Calendar,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageLoading } from "@/components/PlantLoader"
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  const chart = data?.production
    ? [
        { name: "Pending", value: data.production.pending_jobs, color: "#f59e0b" },
        { name: "Running", value: data.production.jobs_in_progress, color: "#3b82f6" },
        { name: "Done", value: data.production.completed_jobs, color: "#10b981" },
      ]
    : []

  const totalProduction = (data?.production?.pending_jobs ?? 0) + (data?.production?.jobs_in_progress ?? 0) + (data?.production?.completed_jobs ?? 0)
  const completionRate = totalProduction > 0 ? Math.round(((data?.production?.completed_jobs ?? 0) / totalProduction) * 100) : 95

  return (
    <div className="space-y-6 animate-rise">
      {/* Top breadcrumb & period indicator from reference design */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pb-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-gray-800 uppercase tracking-wider">
            <Calendar className="size-3.5 text-green-700" />
            CYCLE // ACTIVE PERIOD
          </span>
          <span className="text-gray-300">•</span>
          <span className="font-mono text-[11px] text-gray-500 uppercase">SYNC: REALTIME</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-none bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-black">
            <span className="size-1.5 rounded-none bg-emerald-500 animate-pulse" />
            LIVE PLANT SYNC
          </span>
        </div>
      </div>

      <PageTitle
        title="Dashboard"
        hint="High-level operational overview of production stages, material flows, and billing."
        badge="Executive Overview"
        action={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/production"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-none bg-green-600 px-3 py-2 text-xs font-semibold text-white border border-black shadow-xs transition-all hover:bg-green-700"
            >
              <Factory className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Production</span>
            </Link>
            <Link
              to="/materials"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-none border border-black bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50"
            >
              <Boxes className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Raw Stock</span>
            </Link>
          </div>
        }
      />

      {error ? <Notice variant="error">{error}</Notice> : null}
      {loading ? <PageLoading label="Loading the dashboard" variant="stats" count={4} /> : null}

      {!loading ? (
      <>
      {/* Top 2 Executive Cards matching Reference Image ("Deliveries" and "Invoices") */}
      <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-2">
        {/* Deliveries & Fulfillment Card */}
        <div className="rounded-none border border-black bg-white p-3.5 sm:p-5 shadow-2xs transition-all hover:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between pb-3 sm:pb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 bg-green-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">Deliveries & Floor Operations</h2>
            </div>
            <span className="bg-white text-gray-800 border border-black text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-none uppercase tracking-wider shrink-0">
              OPS // FLOOR
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 border-b border-gray-100 pb-3.5 sm:pb-5">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">UTILIZATION</p>
              <p className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans truncate">{completionRate}%</p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">COMPLETED</p>
              <p className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans truncate">{data?.production?.completed_jobs ?? 0}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">INCOMING</p>
              <div className="mt-1 flex items-baseline gap-1 truncate">
                <span className="text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans">{data?.incoming_shipments ?? 0}</span>
                <span className="inline-flex items-center rounded-none border border-black bg-emerald-50 px-1 py-0.2 text-[8px] sm:text-[9px] font-mono font-bold text-emerald-800 shrink-0">
                  +3.5%
                </span>
              </div>
            </div>
          </div>

          {/* Segmented meter bar from reference image */}
          <div className="pt-3 sm:pt-4">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
              <span>Operational Capacity</span>
              <span className="text-emerald-700 font-bold">Optimal</span>
            </div>
            <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-none bg-gray-100 p-0.5 border border-black">
              <div className="h-full rounded-none bg-emerald-600 transition-all" style={{ width: `${Math.min(100, completionRate)}%` }} />
              <div className="h-full rounded-none bg-lime-500 transition-all" style={{ width: "15%" }} />
              <div className="h-full rounded-none bg-slate-300 transition-all" style={{ width: "10%" }} />
            </div>
          </div>
        </div>

        {/* Invoices & Financials Card */}
        <div className="rounded-none border border-black bg-white p-3.5 sm:p-5 shadow-2xs transition-all hover:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between pb-3 sm:pb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 bg-green-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">Billing & Orders Summary</h2>
            </div>
            <span className="bg-white text-gray-800 border border-black text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-none uppercase tracking-wider shrink-0">
              FIN // LEDGER
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 border-b border-gray-100 pb-3.5 sm:pb-5">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">ORDERS</p>
              <p className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans truncate">
                {data?.sales?.total_orders ?? 0}
              </p>
              <p className="text-[9px] sm:text-[10px] font-mono text-gray-400 mt-0.5 uppercase truncate">Gross</p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">OPEN</p>
              <p className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans truncate">
                {data?.sales?.pending_orders ?? 0}
              </p>
              <p className="text-[9px] sm:text-[10px] font-mono text-gray-400 mt-0.5 uppercase truncate">Pending</p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 truncate">UNPAID</p>
              <p className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-gray-950 font-sans truncate">
                {data?.unpaid_invoices ?? 0}
              </p>
              <p className="text-[9px] sm:text-[10px] font-mono text-rose-600 font-bold mt-0.5 uppercase truncate">Review</p>
            </div>
          </div>

          {/* Segmented multi-color progress bar from reference image */}
          <div className="pt-3 sm:pt-4">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
              <span>Reconciliation Status</span>
              <span className="text-gray-900 font-bold">Active Ledger</span>
            </div>
            <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-none bg-gray-100 p-0.5 border border-black">
              <div className="h-full rounded-none bg-emerald-600" style={{ width: "55%" }} />
              <div className="h-full rounded-none bg-lime-500" style={{ width: "25%" }} />
              <div className="h-full rounded-none bg-slate-300" style={{ width: "20%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid (2 columns on mobile, 4 on desktop for native app density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
        <StatCard
          label="My Open Stages"
          value={data?.my_jobs ?? "–"}
          icon={Wrench}
          hint="Assigned to your role"
        />
        <StatCard
          label="Low Stock Alert"
          value={data?.low_stock ?? "–"}
          icon={AlertTriangle}
          hint="Below threshold"
          trend={data?.low_stock && data.low_stock > 0 ? { text: "Action req", positive: false } : { text: "Healthy", positive: true }}
        />
        <StatCard
          label="Pending Approvals"
          value={data?.approvals ?? "–"}
          icon={Clock}
          hint="Inspection sign-off"
        />
        <StatCard
          label="Incoming Shipments"
          value={data?.incoming_shipments ?? "–"}
          icon={Truck}
          hint="Scheduled material"
          trend={{ text: "+3.5%", positive: true }}
        />

        {roleCan(user?.role_name, "manage_sales") ? (
          <StatCard
            label="Unpaid Invoices"
            value={data?.unpaid_invoices ?? "–"}
            icon={Receipt}
            hint="Awaiting payment"
          />
        ) : null}

        {roleCan(user?.role_name, "view_financials") && data?.sales?.total_sales != null ? (
          <StatCard
            label="Total Sales (GST)"
            value={`₹${Number(data.sales.total_sales).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            hint="Gross billing"
            trend={{ text: "Active", positive: true }}
          />
        ) : null}

        {data?.sales ? (
          <StatCard
            label="Open Orders"
            value={data.sales.pending_orders}
            icon={ShoppingBag}
            hint="In dispatch pipeline"
          />
        ) : null}
      </div>

      {/* Production Chart & Floor Quick Access */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {chart.length > 0 ? (
            <Card className="rounded-none border border-black bg-white shadow-2xs overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 p-3.5 sm:p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-2 bg-green-600 shrink-0" />
                    <CardTitle className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">
                      Production Stage Distribution
                    </CardTitle>
                  </div>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500 font-medium">
                    Real-time status of steel processing jobs
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[9px] sm:text-xs font-mono font-bold">
                  <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-none border border-black text-[9px]">
                    <span className="size-1.5 rounded-none bg-amber-500" />
                    PENDING ({data?.production?.pending_jobs ?? 0})
                  </span>
                  <span className="flex items-center gap-1 text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-none border border-black text-[9px]">
                    <span className="size-1.5 rounded-none bg-blue-500" />
                    RUNNING ({data?.production?.jobs_in_progress ?? 0})
                  </span>
                  <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-none border border-black text-[9px]">
                    <span className="size-1.5 rounded-none bg-emerald-500" />
                    DONE ({data?.production?.completed_jobs ?? 0})
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 pt-3 sm:pt-6">
                <div className="chart-wide h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          color: "#0f172a",
                          borderRadius: "0px",
                          border: "1px solid #000000",
                          fontSize: "11px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
                        }}
                        cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
                      />
                      <Bar dataKey="value" radius={[0, 0, 0, 0]}>
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
        <div className="space-y-3 sm:space-y-4">
          <Card className="rounded-none border border-black bg-white shadow-2xs overflow-hidden">
            <CardHeader className="border-b border-gray-100 p-3.5 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="size-2 bg-green-600 shrink-0" />
                <CardTitle className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                  Floor Quick Links
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3 sm:p-4">
              <Link
                to="/production"
                className="group flex items-center justify-between rounded-none border border-black hover:border-black bg-white p-2.5 sm:p-3 transition-all hover:bg-gray-50 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="grid size-8 sm:size-9 place-items-center rounded-none bg-blue-600 text-white border border-black shadow-2xs shrink-0">
                    <Factory className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">Start Production Job</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">Lock bill of materials & run</p>
                  </div>
                </div>
                <ArrowRight className="size-3.5 sm:size-4 text-gray-400 transition-all group-hover:translate-x-0.5 group-hover:text-black shrink-0 ml-1" />
              </Link>

              <Link
                to="/purchases"
                className="group flex items-center justify-between rounded-none border border-black hover:border-black bg-white p-2.5 sm:p-3 transition-all hover:bg-gray-50 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="grid size-8 sm:size-9 place-items-center rounded-none bg-amber-600 text-white border border-black shadow-2xs shrink-0">
                    <Truck className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">Incoming Deliveries</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">Verify vehicle plate & stock</p>
                  </div>
                </div>
                <ArrowRight className="size-3.5 sm:size-4 text-gray-400 transition-all group-hover:translate-x-0.5 group-hover:text-black shrink-0 ml-1" />
              </Link>

              <Link
                to="/sales"
                className="group flex items-center justify-between rounded-none border border-black hover:border-black bg-white p-2.5 sm:p-3 transition-all hover:bg-gray-50 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="grid size-8 sm:size-9 place-items-center rounded-none bg-emerald-600 text-white border border-black shadow-2xs shrink-0">
                    <Receipt className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">Sales & GST Invoices</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">Dispatch & print invoices</p>
                  </div>
                </div>
                <ArrowRight className="size-3.5 sm:size-4 text-gray-400 transition-all group-hover:translate-x-0.5 group-hover:text-black shrink-0 ml-1" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
      ) : null}
    </div>
  )
}
