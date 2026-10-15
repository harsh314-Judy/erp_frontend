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
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-sm text-muted-foreground">Signed in as {name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your role
            <Badge variant="secondary">{roleLabel(user?.role_name)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {canAccessAdmin ? (
            <p>
              Invite people and edit profiles from the{" "}
              <Link className="text-primary underline-offset-4 hover:underline" to="/admin">
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
