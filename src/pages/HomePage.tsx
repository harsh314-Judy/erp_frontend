import { Link } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { roleLabel } from "@/lib/roles"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function HomePage() {
  const { user, canAccessAdmin } = useAuth()
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ")

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Home</h1>
        <p className="text-sm text-slate-400">Signed in as {name}</p>
      </div>
      <Card className="border-[#262e3f] bg-[#1a1f2b] shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            Your role
            <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-300">{roleLabel(user?.role_name)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          {canAccessAdmin ? (
            <p>
              Invite people and edit profiles from the{" "}
              <Link className="font-semibold text-blue-400 hover:text-blue-300 underline-offset-4 hover:underline" to="/admin">
                admin
              </Link>{" "}
              page.
            </p>
          ) : (
            <p>Your account is ready. You can update your name and email from your profile.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
