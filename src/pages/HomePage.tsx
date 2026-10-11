import { Link } from "react-router-dom"

import { useAuth } from "@/auth/AuthContext"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function HomePage() {
  const { user, canManageMembers } = useAuth()
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
            <Badge variant="secondary">{user?.role_name ?? "member"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {canManageMembers ? (
            <p>
              You can invite people from the{" "}
              <Link className="text-primary underline-offset-4 hover:underline" to="/members">
                members
              </Link>{" "}
              page.
            </p>
          ) : (
            <p>Your account is ready. An admin manages invitations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
