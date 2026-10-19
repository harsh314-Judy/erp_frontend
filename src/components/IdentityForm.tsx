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
          <Label htmlFor="identity_first_name" className="text-xs font-semibold text-slate-300">First Name</Label>
          <Input
            id="identity_first_name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="identity_last_name" className="text-xs font-semibold text-slate-300">Last Name</Label>
          <Input
            id="identity_last_name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="identity_email" className="text-xs font-semibold text-slate-300">Email Address</Label>
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
        <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded-sm accent-indigo-600"
            checked={override}
            onChange={(event) => setOverride(event.target.checked)}
          />
          <span>Only a super admin can change this name and email after saving.</span>
        </label>
      ) : null}
      {disabled ? (
        <p className="text-xs text-slate-400">
          A super admin set this name and email. Only a super admin can change them.
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-rose-400">{error}</p> : null}
      <Button
        type="submit"
        disabled={disabled || pending}
        className="justify-self-start rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40"
      >
        {pending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  )
}
