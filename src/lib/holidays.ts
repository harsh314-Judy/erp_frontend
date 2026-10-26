// Central gazetted holidays. National days repeat every year.
// The rest are the 2026 dates from the Ministry of Parliamentary Affairs calendar.
const NATIONAL: Record<string, string> = {
  "01-26": "Republic Day",
  "04-14": "Ambedkar Jayanti",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas",
}

const GAZETTED_2026: Record<string, string> = {
  "2026-03-04": "Holi",
  "2026-03-21": "Id-ul-Fitr",
  "2026-03-26": "Ram Navami",
  "2026-03-31": "Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-05-01": "Buddha Purnima",
  "2026-05-27": "Id-ul-Zuha",
  "2026-06-26": "Muharram",
  "2026-08-26": "Milad-un-Nabi",
  "2026-09-04": "Janmashtami",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali",
  "2026-11-24": "Guru Nanak Jayanti",
}

export function holidayName(day: string): string | null {
  return GAZETTED_2026[day] ?? NATIONAL[day.slice(5)] ?? null
}
