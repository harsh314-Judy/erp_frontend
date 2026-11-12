import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function StatusDropright({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: string; label: string; tone: string }[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div ref={root} className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-xs"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Status: {current?.label ?? "All"}
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-gray-200/90 bg-white p-1 text-xs font-medium shadow-xs">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "rounded-xl px-3 py-1.5 font-semibold",
                value === option.id ? `${option.tone} text-white` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
              )}
              onClick={() => {
                onChange(option.id)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
