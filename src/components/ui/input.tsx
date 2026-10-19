import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-xl border border-[#2b3447] bg-[#151924] px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 transition-all outline-none focus-visible:border-blue-500/80 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
