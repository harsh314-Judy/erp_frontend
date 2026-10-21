export type UserProfile = {
  id: string
  first_name: string
  last_name: string | null
  email: string
  role_id: string
  role_name: string | null
  identity_overridden: boolean
}

export type RoleRecord = {
  id: string
  role_name: string
}

export type PersonStatus = {
  user_id: string
  on_break: boolean
  break_started_at: string | null
  last_login_at: string | null
  last_seen_at: string | null
  device_label: string | null
  break_allowance_minutes: number | null
  break_used_seconds: number
}

export type BreakRosterItem = {
  user_id: string
  person: string
  role_name: string | null
  email: string
  minutes: number | null
}

export type ActivityEvent = {
  id: string
  user_id: string | null
  person: string
  role_name: string
  action: string
  summary: string
  browser: string | null
  os_name: string | null
  device_type: string | null
  device_model: string | null
  created_at: string
}

export type ActivityBoard = {
  seen_today: number
  people: PersonStatus[]
  events: ActivityEvent[]
}

export async function downloadActivity(role: string): Promise<void> {
  const path = `/api/activity/export?role=${encodeURIComponent(role)}`
  let response = await fetch(path, { credentials: "include" })
  if (response.status === 401) {
    const refreshed = await refreshSession()
    if (refreshed) response = await fetch(path, { credentials: "include" })
  }
  if (!response.ok) throw new ApiError(response.status, "The activity sheet could not be downloaded")
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `activity-${role}-${new Date().getFullYear()}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export type Page<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail
          ? String((detail as { message: unknown }).message)
          : "Request failed"
    super(message)
    this.status = status
    this.detail = detail
  }
}

type RequestOptions = RequestInit & {
  retry?: boolean
  csrfRetry?: boolean
}

let refreshPromise: Promise<boolean> | null = null

function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const method = (options.method ?? "GET").toUpperCase()
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfToken()
    if (csrf) headers.set("X-CSRF-Token", csrf)
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  })

  if (response.status === 401 && !options.retry && path !== "/api/auth/refresh") {
    const refreshed = await refreshSession()
    if (refreshed) return api<T>(path, { ...options, retry: true })
  }

  if (response.status === 403 && !options.csrfRetry) {
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    const detail = body && typeof body === "object" ? body.detail : null
    if (typeof detail === "string" && detail.toLowerCase().includes("csrf")) {
      const refreshed = await refreshSession()
      if (refreshed) return api<T>(path, { ...options, csrfRetry: true })
    }
  }

  if (!response.ok) {
    let detail: unknown = response.statusText
    try {
      const body = await response.json()
      detail = body.detail ?? body
    } catch {
      // Keep the status text when the body is not JSON.
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function uploadFile(file: File): Promise<{ id: string }> {
  const body = new FormData()
  body.append("file", file)
  return api<{ id: string }>("/api/attachments", { method: "POST", body })
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong"
  if (typeof error.detail === "string") return error.detail
  if (error.detail && typeof error.detail === "object" && "message" in error.detail) {
    const record = error.detail as { message?: string; locked_until?: string }
    if (record.locked_until) {
      const when = new Date(record.locked_until).toLocaleString()
      return `${record.message ?? error.message} Try again after ${when}.`
    }
    return record.message ?? error.message
  }
  return error.message
}
