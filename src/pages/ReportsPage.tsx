import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useAuth } from "@/auth/AuthContext"
import { Notice, PageTitle } from "@/components/plant-ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleCan } from "@/lib/access"
import { api, errorMessage } from "@/lib/api"

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
        { name: "Pending", value: production.pending_jobs },
        { name: "Running", value: production.jobs_in_progress },
        { name: "Done", value: production.completed_jobs },
      ]
    : []

  return (
    <div>
      <PageTitle title="Reports" hint={money ? "Sales totals are visible to admins." : "Order counts and stock movement. Sales totals stay with admins."} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <p className="rounded-xl border bg-white p-4">Orders {sales?.total_orders ?? "–"} · open {sales?.pending_orders ?? "–"}</p>
        {money ? <p className="rounded-xl border bg-white p-4">Sales {sales?.total_sales ?? "–"} · GST {sales?.gst_sales ?? "–"}</p> : null}
        <p className="rounded-xl border bg-white p-4">Jobs {production?.total_jobs ?? "–"}</p>
      </div>
      <p className="chart-note mb-3 text-sm text-muted-foreground">Open this report on a wider screen to see the chart.</p>
      <div className="chart-wide mb-6 h-56 rounded-xl border bg-white p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#0c1b33" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Held</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map((row) => (
              <TableRow key={`${row.kind}-${row.name}`}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.on_hand}</TableCell>
                <TableCell>{row.held}</TableCell>
                <TableCell>{row.available}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <h2 className="mb-2 mt-6 font-medium">Ledger</h2>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((row, index) => (
              <TableRow key={`${row.created_at}-${index}`}>
                <TableCell>{row.created_at}</TableCell>
                <TableCell>{row.note || row.reason}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
