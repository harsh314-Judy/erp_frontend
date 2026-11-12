import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export type DepartmentWorker = {
  id: string
  operation_id: string
  operation_name?: string
  name: string
  active: boolean
  employment_type?: string
}
export type WorkerChoice = { worker_id: string } | { worker_name: string }

const selectClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

export function WorkerPicker({
  operationId,
  value,
  onChange,
}: {
  operationId: string
  value: WorkerChoice | null
  onChange: (choice: WorkerChoice | null, label: string) => void
}) {
  const [people, setPeople] = useState<DepartmentWorker[]>([])
  const [fresh, setFresh] = useState(false)
  const [draft, setDraft] = useState("")

  useEffect(() => {
    let alive = true
    api<DepartmentWorker[]>("/api/departments/workers")
      .then((rows) => {
        if (alive) setPeople(rows.filter((row) => row.operation_id === operationId))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [operationId])

  const selected = value && "worker_id" in value ? value.worker_id : fresh ? "new" : ""

  return (
    <div className="grid min-w-52 gap-1.5">
      <label className="text-xs font-semibold text-gray-700">Who did this stage</label>
      <select
        className={selectClass}
        value={selected}
        onChange={(event) => {
          const next = event.target.value
          if (next === "new") {
            setFresh(true)
            onChange(draft.trim() ? { worker_name: draft.trim() } : null, draft.trim())
            return
          }
          setFresh(false)
          const person = people.find((row) => row.id === next)
          onChange(person ? { worker_id: person.id } : null, person?.name ?? "")
        }}
      >
        <option value="">Choose a person</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
        <option value="new">+ New name</option>
      </select>
      {fresh ? (
        <input
          className={selectClass}
          placeholder="Type the person's name"
          value={draft}
          onChange={(event) => {
            const name = event.target.value
            setDraft(name)
            onChange(name.trim() ? { worker_name: name.trim() } : null, name.trim())
          }}
        />
      ) : null}
    </div>
  )
}

export function MultiWorkerPicker({
  operationId,
  value,
  onChange,
  max = 3,
}: {
  operationId: string
  value: string[]
  onChange: (ids: string[], labels: string[]) => void
  max?: number
}) {
  const [people, setPeople] = useState<DepartmentWorker[]>([])

  useEffect(() => {
    let alive = true
    api<DepartmentWorker[]>("/api/departments/workers")
      .then((rows) => {
        if (alive) setPeople(rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [operationId])

  const here = people.filter((person) => person.operation_id === operationId)
  const elsewhere = people.filter((person) => person.operation_id !== operationId)

  function toggle(id: string) {
    const next = value.includes(id) ? value.filter((item) => item !== id) : value.length >= max ? value : [...value, id]
    const labels = next.map((item) => people.find((person) => person.id === item)?.name ?? "")
    onChange(next, labels)
  }

  function group(title: string, rows: DepartmentWorker[]) {
    if (rows.length === 0) return null
    return (
      <div>
        <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((person) => {
            const on = value.includes(person.id)
            return (
              <button
                key={person.id}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700",
                )}
                onClick={() => toggle(person.id)}
              >
                {person.name}
                {person.employment_type === "temporary" ? " · Temp" : ""}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-w-64 gap-2">
      <p className="text-xs font-semibold text-gray-700">Who did this · up to {max}</p>
      {group("This department", here)}
      {group("Other departments", elsewhere)}
      {people.length === 0 ? <p className="text-xs text-gray-400">No people on the roster yet.</p> : null}
    </div>
  )
}
