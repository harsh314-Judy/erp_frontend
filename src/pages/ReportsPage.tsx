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
import { PageLoading } from "@/components/PlantLoader"
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
  const [loading, setLoading] = useState(true)
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
      .finally(() => setLoading(false))
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

      {loading ? (
        <PageLoading label="Loading reports" variant="stats" count={4} />
      ) : (
        <>
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
        <Card className="border-gray-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                Floor Job Distribution
              </CardTitle>
              <p className="mt-0.5 text-xs text-gray-500">
                Real-time queue across active work orders
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="size-2 rounded-full bg-amber-500 shadow-xs" />
                Pending ({production?.pending_jobs ?? 0})
              </span>
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="size-2 rounded-full bg-blue-500 shadow-xs" />
                Running ({production?.jobs_in_progress ?? 0})
              </span>
              <span className="flex items-center gap-1.5 text-green-700">
                <span className="size-2 rounded-full bg-green-600 shadow-xs" />
                Done ({production?.completed_jobs ?? 0})
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="chart-note mb-3 text-sm text-gray-500">
              Open on a desktop display to inspect detailed chart bars.
            </p>
            <div className="chart-wide h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      color: "#111827",
                      borderRadius: "0.75rem",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    }}
                    cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
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
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/75 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Current Plant Inventory Balances
            </span>
          </div>
          <span className="text-xs font-semibold text-gray-500">{stock.length} recorded items</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-gray-100">
                <TableHead className="text-xs font-bold text-gray-700">Item Name</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Category</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-right">Physical On Hand</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-right">Allocated / Held</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-right">Free / Available</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-gray-500">
                    No inventory records found.
                  </TableCell>
                </TableRow>
              ) : (
                stock.map((row) => (
                  <TableRow key={`${row.kind}-${row.name}`} className="border-gray-100 hover:bg-gray-50/80">
                    <TableCell className="font-semibold text-gray-900">{row.name}</TableCell>
                    <TableCell>
                      <span className="inline-block rounded-md border border-gray-200 bg-gray-100/70 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">
                        {row.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-700">{row.on_hand}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-700">{row.held}</TableCell>
                    <TableCell className="text-right font-bold text-green-700">{row.available}</TableCell>
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
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/75 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="size-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Audit Stock Ledger & Traceability
            </span>
          </div>
          <span className="text-xs text-gray-500">Chronological activity</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-gray-100">
                <TableHead className="text-xs font-bold text-gray-700">Timestamp</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Item / Note</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-right">Qty Delta</TableHead>
                <TableHead className="text-xs font-bold text-gray-700">Event Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-gray-500">
                    No stock movements logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((row, index) => {
                  const isNegative = String(row.quantity).startsWith("-")
                  return (
                    <TableRow key={`${row.created_at}-${index}`} className="border-gray-100 hover:bg-gray-50/80">
                      <TableCell className="text-xs text-gray-500 font-mono">{row.created_at}</TableCell>
                      <TableCell className="font-medium text-gray-900">{row.note || row.reason}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                            isNegative
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200",
                          )}
                        >
                          {isNegative ? "" : "+"}
                          {row.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block rounded-md border border-gray-200 bg-gray-100/70 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">
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
      </>
      )}
    </div>
  )
}
