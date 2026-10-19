import { useEffect, useState } from "react"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  BarChart3,
  Boxes,
  Factory,
  History,
  Layers,
  ShoppingBag,
  TrendingUp,
} from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { Notice, PageTitle, StatCard, StatusBadge } from "@/components/plant-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleCan } from "@/lib/access"
import { api, errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type Sales = { total_orders: number; pending_orders: number; total_sales?: string; gst_sales?: string; non_gst_sales?: string }
type Production = { total_jobs: number; completed_jobs: number; jobs_in_progress: number; pending_jobs: number }
type Stock = { kind: string; name: string; on_hand: string; held: string; available: string; status: string }
type Movement = { created_at: string; quantity: string; reason: string; note: string | null }

export function ReportsPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sales | null>(null)
  const [production, setProduction] = useState<Production | null>(null)
  const [stock, setStock] = useState<Stock[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [error, setError] = useState("")
  const money = roleCan(user?.role_name, "view_financials")

  useEffect(() => {
    Promise.all([
      api<Sales>("/api/reports/sales"),
      api<Production>("/api/reports/production"),
      api<{ stock: Stock[]; movements: Movement[] }>("/api/reports/inventory"),
    ])
      .then(([salesReport, productionReport, inventory]) => {
        setSales(salesReport)
        setProduction(productionReport)
        setStock(inventory.stock)
        setMovements(inventory.movements)
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  const chart = production
    ? [
        { name: "Pending", value: production.pending_jobs, color: "#f59e0b" },
        { name: "Running", value: production.jobs_in_progress, color: "#3b82f6" },
        { name: "Done", value: production.completed_jobs, color: "#10b981" },
      ]
    : []

  return (
    <div className="space-y-6">
      <PageTitle
        title="Plant Analytics & Reports"
        hint={
          money
            ? "Comprehensive inventory balances, audit ledger, and executive sales analytics."
            : "Live stock ledger, stage volume, and dispatch counts. Sales financials restricted to management."
        }
        icon={BarChart3}
        badge="Analytics"
      />

      {error ? <Notice variant="error">{error}</Notice> : null}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sales Orders"
          value={sales?.total_orders ?? "–"}
          icon={ShoppingBag}
          color="blue"
          hint={`Open in pipeline: ${sales?.pending_orders ?? 0}`}
        />
        {money ? (
          <StatCard
            label="Total Sales Billing"
            value={sales?.total_sales ? `₹${Number(sales.total_sales).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "–"}
            icon={TrendingUp}
            color="emerald"
            hint={`GST Component: ₹${sales?.gst_sales ?? "0.00"}`}
          />
        ) : null}
        <StatCard
          label="Total Plant Jobs"
          value={production?.total_jobs ?? "–"}
          icon={Factory}
          color="indigo"
          hint={`Completed batches: ${production?.completed_jobs ?? 0}`}
        />
        <StatCard
          label="Tracked Inventory Items"
          value={stock.length}
          icon={Boxes}
          color="amber"
          hint="Sheets, coils & finishes"
        />
      </div>

      {/* Production Chart */}
      {chart.length > 0 ? (
        <Card className="border-[#262e3f] bg-[#1a1f2b] shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#262e3f] pb-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-100">
                Floor Job Distribution
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                Real-time queue across active work orders
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="size-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                Pending ({production?.pending_jobs ?? 0})
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="size-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                Running ({production?.jobs_in_progress ?? 0})
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                Done ({production?.completed_jobs ?? 0})
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="chart-note mb-3 text-sm text-slate-400">
              Open on a desktop display to inspect detailed chart bars.
            </p>
            <div className="chart-wide h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
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

      {/* Current Stock Levels Table */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25]/70 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Current Plant Inventory Balances
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">{stock.length} recorded items</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#161a25]">
              <TableRow className="border-[#262e3f]">
                <TableHead className="text-xs font-bold text-slate-300">Item Name</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Category</TableHead>
                <TableHead className="text-xs font-bold text-slate-300 text-right">Physical On Hand</TableHead>
                <TableHead className="text-xs font-bold text-slate-300 text-right">Allocated / Held</TableHead>
                <TableHead className="text-xs font-bold text-slate-300 text-right">Free / Available</TableHead>
                <TableHead className="text-xs font-bold text-slate-300 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No inventory records found.
                  </TableCell>
                </TableRow>
              ) : (
                stock.map((row) => (
                  <TableRow key={`${row.kind}-${row.name}`} className="border-[#1f2636] hover:bg-[#202737]/60">
                    <TableCell className="font-semibold text-slate-200">{row.name}</TableCell>
                    <TableCell>
                      <span className="inline-block rounded-md border border-[#2b3447] bg-[#151924] px-2 py-0.5 text-xs font-medium text-slate-300 capitalize">
                        {row.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-300">{row.on_hand}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-400">{row.held}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">{row.available}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Inventory Movement Ledger */}
      <div className="overflow-hidden rounded-2xl border border-[#262e3f] bg-[#1a1f2b] shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262e3f] bg-[#161a25]/70 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="size-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Audit Stock Ledger & Traceability
            </span>
          </div>
          <span className="text-xs text-slate-400">Chronological activity</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#161a25]">
              <TableRow className="border-[#262e3f]">
                <TableHead className="text-xs font-bold text-slate-300">Timestamp</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Item / Note</TableHead>
                <TableHead className="text-xs font-bold text-slate-300 text-right">Qty Delta</TableHead>
                <TableHead className="text-xs font-bold text-slate-300">Event Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-slate-500">
                    No stock movements logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((row, index) => {
                  const isNegative = String(row.quantity).startsWith("-")
                  return (
                    <TableRow key={`${row.created_at}-${index}`} className="border-[#1f2636] hover:bg-[#202737]/60">
                      <TableCell className="text-xs text-slate-400 font-mono">{row.created_at}</TableCell>
                      <TableCell className="font-medium text-slate-200">{row.note || row.reason}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                            isNegative
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
                          )}
                        >
                          {isNegative ? "" : "+"}
                          {row.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block rounded-md border border-[#2b3447] bg-[#151924] px-2 py-0.5 text-xs font-medium text-slate-300 capitalize">
                          {row.reason.replaceAll("_", " ")}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
