import { useRef, useState } from "react"

export function useFormBusy() {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function guard(task: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await task()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return { busy, guard }
}
