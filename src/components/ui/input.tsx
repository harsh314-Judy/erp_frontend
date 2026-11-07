import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-none transition-all outline-none focus-visible:border-[var(--scheme)] focus-visible:ring-4 focus-visible:ring-[var(--scheme)]/15 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
