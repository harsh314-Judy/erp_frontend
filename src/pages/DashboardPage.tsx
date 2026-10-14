import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTitle } from "@/components/plant-ui"
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
        { name: "Pending", value: data.production.pending_jobs },
        { name: "Running", value: data.production.jobs_in_progress },
        { name: "Done", value: data.production.completed_jobs },
      ]
    : []

  return (
    <div>
      <PageTitle title="Dashboard" hint="What needs attention on the floor today." />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="My open stages" value={data?.my_jobs ?? "–"} />
        <Stat label="Low stock" value={data?.low_stock ?? "–"} />
        <Stat label="Jobs waiting approval" value={data?.approvals ?? "–"} />
        <Stat label="Incoming vehicles" value={data?.incoming_shipments ?? "–"} />
        {roleCan(user?.role_name, "manage_sales") ? (
          <Stat label="Unpaid invoices" value={data?.unpaid_invoices ?? "–"} />
        ) : null}
        {roleCan(user?.role_name, "view_financials") && data?.sales?.total_sales != null ? (
          <Stat label="Sales total" value={data.sales.total_sales} />
        ) : null}
        {data?.sales ? <Stat label="Open sales orders" value={data.sales.pending_orders} /> : null}
      </div>
      {chart.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Production</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="chart-note mb-3 text-sm text-muted-foreground">
              Charts need a wider screen. Pending {data?.production?.pending_jobs}, running{" "}
              {data?.production?.jobs_in_progress}, done {data?.production?.completed_jobs}.
            </p>
            <div className="chart-wide h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f08a00" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}
