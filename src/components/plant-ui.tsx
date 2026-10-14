import { useMemo, useState, type ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>
}

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Type to search",
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return options
      .filter((option) => !needle || option.label.toLowerCase().includes(needle))
      .slice(0, 30)
  }, [options, query])

  return (
    <div className="relative grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery("")
        }}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open ? (
        <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {matches.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground">No matches</p>
          ) : (
            matches.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted",
                  option.id === value && "bg-muted",
                )}
                onMouseDown={() => {
                  onChange(option.id)
                  setQuery("")
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
