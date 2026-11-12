/** Calendar dates in India time, as YYYY-MM-DD. */

export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 8)}01`
}

export type DatePreset = "today" | "yesterday" | "week" | "month" | "custom"

export function presetRange(preset: DatePreset, today = istToday()): { from: string; to: string } {
  if (preset === "yesterday") {
    const day = shiftDate(today, -1)
    return { from: day, to: day }
  }
  if (preset === "week") return { from: shiftDate(today, -6), to: today }
  if (preset === "month") return { from: monthStart(today), to: today }
  return { from: today, to: today }
}

export function matchingPreset(from: string, to: string, today = istToday()): DatePreset {
  const options: DatePreset[] = ["today", "yesterday", "week", "month"]
  return options.find((preset) => {
    const range = presetRange(preset, today)
    return range.from === from && range.to === to
  }) ?? "custom"
}
