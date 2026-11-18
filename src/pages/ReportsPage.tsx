import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
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
import { departmentLabel } from "@/lib/labels"
import { api, downloadFile, errorMessage, peek, rupees } from "@/lib/api"
import { cn } from "@/lib/utils"

type Sales = { total_orders: number; pending_orders: number; total_sales?: string; gst_sales?: string; non_gst_sales?: string }
type Production = { total_jobs: number; completed_jobs: number; jobs_in_progress: number; pending_jobs: number }
type Stock = { kind: string; name: string; on_hand: string; held: string; available: string; status: string }
type Movement = { created_at: string; quantity: string; reason: string; note: string | null }
type Shop = {
  yields: { name: string; good: string; scrap: string }[]
  late_jobs: { id: string; product_name: string | null; due_at: string; status: string; current_operation_name: string | null }[]
  unpaid_count: number
  unpaid_total?: string
}

export function ReportsPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sales | null>(() => peek<Sales>("/api/reports/sales") ?? null)
  const [production, setProduction] = useState<Production | null>(
    () => peek<Production>("/api/reports/production") ?? null,
  )
  const [stock, setStock] = useState<Stock[]>(
    () => peek<{ stock: Stock[] }>("/api/reports/inventory")?.stock ?? [],
  )
  const [movements, setMovements] = useState<Movement[]>(
    () => peek<{ movements: Movement[] }>("/api/reports/inventory")?.movements ?? [],
  )
  const [shop, setShop] = useState<Shop | null>(null)
  const [error, setError] = useState("")
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(now)
    return parts.slice(0, 7)
  })
  const [loading, setLoading] = useState(
    () =>
      peek("/api/reports/sales") === undefined ||
      peek("/api/reports/production") === undefined ||
      peek("/api/reports/inventory") === undefined,
  )
  const money = roleCan(user?.role_name, "view_financials")
  const seesWages = roleCan(user?.role_name, "manage_staff_users") || roleCan(user?.role_name, "view_financials")
  const [wageOwed, setWageOwed] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api<Sales>("/api/reports/sales"),
      api<Production>("/api/reports/production"),
      api<{ stock: Stock[]; movements: Movement[] }>("/api/reports/inventory"),
      api<Shop>("/api/reports/shop"),
      seesWages ? api<{ total_owed: string }>("/api/reports/wages") : Promise.resolve(null),
    ])
      .then(([salesReport, productionReport, inventory, shopReport, wages]) => {
        setSales(salesReport)
        setProduction(productionReport)
        setStock(inventory.stock)
        setMovements(inventory.movements)
        setShop(shopReport)
        setWageOwed(wages?.total_owed ?? null)
      })
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [seesWages])

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
        action={
          money ? (
            <div className="flex items-center gap-2">
              <input type="month" className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm" value={month} onChange={(event) => setMonth(event.target.value)} />
              <button type="button" className="h-9 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white" onClick={() => void downloadFile(`/api/reports/ca-export?month=${month}`, `ca-${month}.csv`).catch((caught) => setError(errorMessage(caught)))}>
                Export for CA
              </button>
            </div>
          ) : null
        }
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
            value={sales?.total_sales ? rupees(sales.total_sales) : "–"}
            icon={TrendingUp}
            money
            color="emerald"
            hint={`GST Component: ${rupees(sales?.gst_sales ?? 0)}`}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-gray-200/90 bg-white shadow-xs">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-base font-bold text-gray-900">Good and scrap this week</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                  <TableHead className="text-right">Scrap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shop?.yields ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-gray-500">No floor lines this week.</TableCell></TableRow>
                ) : shop?.yields.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{departmentLabel(row.name)}</TableCell>
                    <TableCell className="text-right">{row.good}</TableCell>
                    <TableCell className="text-right">{row.scrap}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="border-gray-200/90 bg-white shadow-xs">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-base font-bold text-gray-900">Jobs past due</CardTitle>
            <p className="text-xs text-gray-500">
              Unpaid invoices: {shop?.unpaid_count ?? 0}
              {money && shop?.unpaid_total != null ? <span className="money-figure ml-2">₹{Number(shop.unpaid_total).toLocaleString("en-IN")}</span> : ""}
            </p>
            {seesWages && wageOwed != null ? (
              <p className="text-xs text-[var(--ink-soft)]">
                Wage owed this month <span className="money-figure">₹{Number(wageOwed).toLocaleString("en-IN")}</span>
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-2 text-sm">
              {(shop?.late_jobs ?? []).length === 0 ? <li className="text-gray-500">No late jobs.</li> : null}
              {shop?.late_jobs.map((job) => (
                <li key={job.id}>
                  <Link to="/production" className="font-semibold text-gray-900">{job.product_name || "Job"}</Link>
                  <span className="text-gray-500"> · {departmentLabel(job.current_operation_name) || job.status} · {new Date(job.due_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

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
                              ? "tone tone-rose"
                              : "tone tone-emerald",
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
