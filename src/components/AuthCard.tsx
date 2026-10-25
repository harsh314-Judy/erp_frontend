import type { ReactNode } from "react"
import { Link } from "react-router-dom"

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
    <main className="flex min-h-svh flex-col bg-[#f4f5f7]">
      {/* Top bar */}
      <div className="flex h-14 items-center border-b border-black bg-white px-5 shadow-2xs">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-none bg-green-600 text-white font-bold text-sm border border-black shadow-xs">
            S
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 block leading-none">Sai Daya Steel</span>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">ERP Portal</span>
          </div>
        </Link>
      </div>

      {/* Center card */}
      <div className="flex flex-1 items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm animate-rise">
          {/* Icon + heading above card */}
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="grid size-14 place-items-center rounded-none bg-green-600 text-white font-black text-2xl border border-black shadow-xs">
                S
              </div>
              <span className="absolute -bottom-1 -right-1 size-3 rounded-none bg-emerald-400 border border-black" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 text-xs text-gray-500 font-medium">{description}</p>
          </div>

          {/* Card */}
          <div className="rounded-none border border-black bg-white p-6 shadow-xs">
            <div className="grid gap-4">
              {children}
            </div>
            {footer && (
              <div className="mt-4 border-t border-gray-50 pt-4 text-center text-sm">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
