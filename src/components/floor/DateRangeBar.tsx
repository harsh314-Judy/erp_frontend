import { matchingPreset, presetRange, type DatePreset } from "@/components/floor/dates"
import { FilterPanel } from "@/components/plant-ui"
import { cn } from "@/lib/utils"

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "7 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
]

export function DateRangeBar({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = matchingPreset(from, to)

  return (
    <FilterPanel title="Range">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold",
              active === preset.id ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
            )}
            onClick={() => {
              if (preset.id === "custom") return
              const range = presetRange(preset.id)
              onChange(range.from, range.to)
            }}
          >
            {preset.label}
          </button>
        ))}
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
        From
        <input
          type="date"
          className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-800"
          value={from}
          onChange={(event) => onChange(event.target.value, to < event.target.value ? event.target.value : to)}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
        To
        <input
          type="date"
          className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-800"
          value={to}
          onChange={(event) => onChange(from, event.target.value < from ? from : event.target.value)}
        />
      </label>
    </FilterPanel>
  )
}
