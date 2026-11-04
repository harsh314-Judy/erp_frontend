import { useEffect, useState } from "react"

import { api } from "@/lib/api"

export type DepartmentWorker = { id: string; operation_id: string; name: string; active: boolean }
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
