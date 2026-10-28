import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

/** Reload a page's data when the user comes back to it, without showing the skeleton again. */
export function useRefreshWhenShown(
  path: string,
  load: () => Promise<unknown>,
  onError?: (caught: unknown) => void,
) {
  const loadRef = useRef(load)
  const errorRef = useRef(onError)
  loadRef.current = load
  errorRef.current = onError
  const first = useRef(true)
  const shown = useLocation().pathname === path

  useEffect(() => {
    if (!shown) return
    if (first.current) {
      first.current = false
      return
    }
    void loadRef.current().catch((caught) => errorRef.current?.(caught))
  }, [shown])
}
