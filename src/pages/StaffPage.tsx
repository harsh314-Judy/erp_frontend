import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { PageLoading } from "@/components/PlantLoader"
import { Notice, PageTitle } from "@/components/plant-ui"
import { DepartmentNowPage } from "@/pages/DepartmentNowPage"
import { api, errorMessage } from "@/lib/api"
import { departmentLabel } from "@/lib/labels"

type Assigned = { operation_id: string; name: string }

export function StaffPage() {
  const [ops, setOps] = useState<Assigned[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api<Assigned[]>("/api/departments/assigned")
      .then(setOps)
      .catch((caught) => {
        setOps([])
        setError(errorMessage(caught))
      })
  }, [])

  if (ops === null) return <PageLoading label="Loading your station" variant="cards" count={1} />
  if (ops.length === 1) return <DepartmentNowPage operationId={ops[0].operation_id} />

  return (
    <div className="space-y-4">
      <PageTitle title="Operator station" hint="The departments assigned to this login." />
      {error ? <Notice variant="error">{error}</Notice> : null}
      {ops.length === 0 ? <p className="text-sm text-gray-500">No department is assigned to this login.</p> : null}
      <ul className="grid gap-3">
        {ops.map((row) => (
          <li key={row.operation_id}>
            <Link to={`/departments/${row.operation_id}/now`} className="block rounded-2xl border border-gray-200 bg-white px-4 py-5 text-lg font-bold text-gray-900">
              {departmentLabel(row.name)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
