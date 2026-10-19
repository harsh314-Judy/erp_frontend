import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Shield } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#10131c] via-[#141824] to-[#10131c] p-4 sm:p-6 text-slate-200">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-10 size-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" className="group flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/25 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
              S
            </span>
            <div className="text-left">
              <p className="text-base font-bold text-slate-100">Sai Daya Steel</p>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] font-medium tracking-wide text-slate-400">PLANT ACCESS PORTAL</p>
              </div>
            </div>
          </Link>
        </div>

        <Card className="relative overflow-hidden rounded-3xl border border-[#262e3f] bg-[#1a1f2b]/95 backdrop-blur-xl text-slate-200 shadow-xl ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-200" />
          <CardHeader className="pt-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-100">{title}</CardTitle>
              <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Shield className="size-4" />
              </div>
            </div>
            <CardDescription className="text-xs text-slate-400">{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            {children}
            {footer ? <div className="border-t border-[#262e3f] pt-3 text-center">{footer}</div> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
