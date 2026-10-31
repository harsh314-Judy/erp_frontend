import { createContext, useContext, useMemo, useState, type ComponentType, type ReactNode } from "react"

export type PageChrome = {
  title: string
  icon: ComponentType<{ className?: string }>
  iconBg: string
}

type ChromeApi = {
  scrolled: boolean
  chrome: PageChrome | null
  setChrome: (value: PageChrome | null) => void
}

const ChromeContext = createContext<ChromeApi | null>(null)

export function PageChromeProvider({ scrolled, children }: { scrolled: boolean; children: ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome | null>(null)
  const value = useMemo(() => ({ scrolled, chrome, setChrome }), [scrolled, chrome])
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
}

export function usePageChrome() {
  return useContext(ChromeContext)
}
