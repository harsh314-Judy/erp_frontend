import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { UserRound } from "lucide-react"

import { api } from "@/lib/api"

type Person = { id: string; name: string; operation_name?: string; employment_type?: string }

export function TimelineJump() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [people, setPeople] = useState<Person[]>([])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || people.length > 0) return
    api<Person[]>("/api/departments/workers")
      .then(setPeople)
      .catch(() => {})
  }, [open, people.length])

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const needle = query.trim().toLowerCase()
  const matches = people.filter((person) => !needle || person.name.toLowerCase().includes(needle)).slice(0, 8)

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
        onClick={() => setOpen((current) => !current)}
      >
        <UserRound className="size-3.5" />
        Employee timeline
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs"
            placeholder="Search a person"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="mt-1 max-h-64 overflow-y-auto">
            {matches.length === 0 ? <li className="px-2 py-2 text-xs text-gray-400">No one matches.</li> : null}
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                  onClick={() => navigate(`/people/${person.id}`)}
                >
                  <span className="font-semibold text-gray-900">{person.name}</span>
                  <span className="text-gray-400">{person.operation_name ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
