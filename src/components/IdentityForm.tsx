import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type IdentityValues = {
  first_name: string
  last_name: string
  email: string
  identity_overridden?: boolean
}

type IdentityFormProps = {
  initial: IdentityValues
  disabled: boolean
  pending: boolean
  error: string
  showOverride: boolean
  onSubmit: (values: IdentityValues) => Promise<void>
}

export function IdentityForm({
  initial,
  disabled,
  pending,
  error,
  showOverride,
  onSubmit,
}: IdentityFormProps) {
  const [firstName, setFirstName] = useState(initial.first_name)
  const [lastName, setLastName] = useState(initial.last_name)
  const [email, setEmail] = useState(initial.email)
  const [override, setOverride] = useState(initial.identity_overridden ?? true)

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      identity_overridden: showOverride ? override : undefined,
    })
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="identity_first_name">Name</Label>
          <Input
            id="identity_first_name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="identity_last_name">Surname</Label>
          <Input
            id="identity_last_name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="identity_email">Email</Label>
        <Input
          id="identity_email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={disabled}
          required
        />
      </div>
      {showOverride ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={override}
            onChange={(event) => setOverride(event.target.checked)}
          />
          <span>Only a super admin can change this name and email after saving.</span>
        </label>
      ) : null}
      {disabled ? (
        <p className="text-sm text-muted-foreground">
          A super admin set this name and email. Only a super admin can change them.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={disabled || pending} className="justify-self-start">
        {pending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  )
}
