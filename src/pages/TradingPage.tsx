import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftRight } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"
import { PageLoading } from "@/components/PlantLoader"
import { PageTitle, StatCard } from "@/components/plant-ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage } from "@/lib/api"
import { roleCan } from "@/lib/access"
import { useRefreshWhenShown } from "@/lib/visible"
import { cn } from "@/lib/utils"

type Item = {
  kind: "product" | "raw_material"
  id: string
  name: string
  sku: string | null
  unit: string | null
  on_hand: string
  available: string
  supplier_names: string
  last_purchase_price: string | null
  bought_qty: string
  sold_qty: string
  incoming_qty: string
}
type Summary = {
  revenue: string | null
  cost: string | null
  profit: string | null
  margin_pct: string | null
  incoming_orders: number
  incoming_qty: string
}

function money(value: string | null) {
  if (value == null) return "—"
  const amount = Number(value)
  const sign = amount < 0 ? "-" : ""
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export function TradingPage() {
  const { user } = useAuth()
  const moneyVisible = roleCan(user?.role_name, "view_financials")
  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tab, setTab] = useState<"all" | "product" | "raw_material">("all")
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const [rows, totals] = await Promise.all([
        api<Item[]>("/api/trading/items"),
        api<Summary>("/api/trading/summary?period=month"),
      ])
      setItems(rows)
      setSummary(totals)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)))
  }, [])
  useRefreshWhenShown("/trading", load, (caught) => setError(errorMessage(caught)))

  const shown = items.filter((item) => {
    if (tab !== "all" && item.kind !== tab) return false
    const haystack = `${item.name} ${item.sku ?? ""} ${item.supplier_names}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })
  const profit = summary?.profit == null ? 0 : Number(summary.profit)

  return (
    <div className="space-y-6">
      <PageTitle title="Trading" hint="Purchased goods and raw materials bought to resell or use." icon={ArrowLeftRight} badge={`${items.length} items`} />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue this month" value={moneyVisible ? money(summary.revenue) : "—"} />
          <StatCard label="Cost this month" value={moneyVisible ? money(summary.cost) : "—"} />
          <StatCard label="Profit / loss" value={moneyVisible ? money(summary.profit) : "—"} hint={summary.margin_pct != null ? `${Number(summary.margin_pct).toFixed(1)}% margin` : undefined} trend={moneyVisible ? { text: profit >= 0 ? "Profit" : "Loss", positive: profit >= 0 } : undefined} />
          <StatCard label="Incoming" value={summary.incoming_orders} hint={`${Number(summary.incoming_qty)} units on open orders`} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ["all", "All"],
          ["product", "Purchased products"],
          ["raw_material", "Raw materials"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={cn("rounded-xl px-3 py-1.5 text-xs font-semibold", tab === id ? "bg-violet-600 text-white" : "bg-white text-gray-600")} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <input className="h-9 min-w-48 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm" placeholder="Search name, SKU, supplier" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {loading ? <PageLoading label="Loading traded goods" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Bought</TableHead>
              <TableHead>Sold</TableHead>
              <TableHead>Incoming</TableHead>
              <TableHead>Suppliers</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((item) => (
              <TableRow key={`${item.kind}-${item.id}`}>
                <TableCell>
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-[11px] text-gray-500">{item.sku || item.unit || (item.kind === "product" ? "Purchased" : "Raw material")}</p>
                </TableCell>
                <TableCell>{Number(item.available)}</TableCell>
                <TableCell>{Number(item.bought_qty)}</TableCell>
                <TableCell>{Number(item.sold_qty)}</TableCell>
                <TableCell>{Number(item.incoming_qty)}</TableCell>
                <TableCell className="max-w-48 truncate">{item.supplier_names || "—"}</TableCell>
                <TableCell>
                  <Link className="text-xs font-semibold text-violet-700" to={`/purchases?draft=${item.kind === "product" ? "product" : "material"}&item=${item.id}`}>
                    Buy more
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
