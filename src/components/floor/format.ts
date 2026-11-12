export type UnitTotal = { unit: string; quantity: string }
export type ScrapRate = { unit: string; percent: string | null }

export type FloorWorker = { id: string; name: string }

export type FloorEntry = {
  id: string
  entry_date: string
  operation_id: string
  operation_name: string
  workers: FloorWorker[]
  output_name: string
  output_quantity: string
  output_unit: string
  output_product_id: string | null
  input_name: string | null
  input_quantity: string | null
  input_unit: string | null
  input_product_id: string | null
  input_raw_material_id: string | null
  scrap_quantity: string
  scrap_unit: string | null
  notes: string | null
  from_job: boolean
  job_id: string | null
  created_by_name: string | null
  created_at: string
}

export type DepartmentSummary = {
  operation_id: string
  name: string
  entries: number
  workers: number
  open_jobs: number
  output: UnitTotal[]
  used: UnitTotal[]
  scrap: UnitTotal[]
  scrap_pct: ScrapRate[]
  people: { worker_id: string; name: string; made: UnitTotal[] }[]
}

export type FloorSummary = {
  date_from: string
  date_to: string
  departments: DepartmentSummary[]
}

export function amount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "0"
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return String(number)
}

export function totals(rows: UnitTotal[] | undefined): string {
  if (!rows?.length) return "—"
  return rows.map((row) => `${amount(row.quantity)} ${row.unit}`).join(" · ")
}

export function scrapLabel(scrap: UnitTotal[] | undefined, rates: ScrapRate[] | undefined): string {
  if (!scrap?.length) return "—"
  return scrap
    .map((row) => {
      const rate = rates?.find((item) => item.unit === row.unit && item.percent != null)
      const pct = rate ? ` (${amount(rate.percent)}%)` : ""
      return `${amount(row.quantity)} ${row.unit}${pct}`
    })
    .join(" · ")
}

export function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}
