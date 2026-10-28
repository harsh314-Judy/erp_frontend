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

export type AttendanceRow = {
  id: string
  person: string
  role_name: string
  signed_in_at: string
  signed_out_at: string | null
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
const freshForMs = 20_000
const memory = new Map<string, { at: number; data: unknown }>()
const inflight = new Map<string, Promise<unknown>>()
let cacheGeneration = 0

function cacheKey(path: string) {
  return `GET ${path}`
}

export function peek<T>(path: string): T | undefined {
  const hit = memory.get(cacheKey(path))
  if (!hit || Date.now() - hit.at >= freshForMs) return undefined
  return hit.data as T
}

export function prefetch(paths: string[]) {
  let cursor = 0
  const run = async () => {
    while (cursor < paths.length) {
      const path = paths[cursor]
      cursor += 1
      try {
        await api(path)
      } catch {
        // A failed warm-up must not interrupt the page the user is on.
      }
    }
  }
  void Promise.all([run(), run()])
}

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
  const method = (options.method ?? "GET").toUpperCase()
  const key = cacheKey(path)
  if (method === "GET") {
    const hit = memory.get(key)
    if (hit && Date.now() - hit.at < freshForMs) return hit.data as T
    const pending = inflight.get(key)
    if (pending) return pending as Promise<T>
  } else {
    cacheGeneration += 1
    memory.clear()
  }
  const generation = cacheGeneration
  const promise = request<T>(path, options).then((data) => {
    if (method === "GET" && generation === cacheGeneration) memory.set(key, { at: Date.now(), data })
    return data
  })
  if (method === "GET") {
    inflight.set(key, promise)
    void promise.finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key)
    })
  }
  return promise
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
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
    if (refreshed) return request<T>(path, { ...options, retry: true })
  }

  if (response.status === 403 && !options.csrfRetry) {
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    const detail = body && typeof body === "object" ? body.detail : null
    if (typeof detail === "string" && detail.toLowerCase().includes("csrf")) {
      const refreshed = await refreshSession()
      if (refreshed) return request<T>(path, { ...options, csrfRetry: true })
    }
  }

  if (!response.ok) {
    let detail: unknown = response.statusText
    try {
      const body = await response.json()
      detail = body.detail ?? body
    } catch {
      // The status text is already the fallback.
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const pull = () => fetch(path, { credentials: "include" })
  let response = await pull()
  if (response.status === 401) {
    const refreshed = await refreshSession()
    if (refreshed) response = await pull()
  }
  if (!response.ok) {
    let detail: unknown = response.statusText
    try {
      const body = await response.json()
      detail = body.detail ?? body
    } catch {
      // The status text is already the fallback.
    }
    throw new ApiError(response.status, detail)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function uploadFile(file: File): Promise<{ id: string }> {
  const body = new FormData()
  body.append("file", file)
  return api<{ id: string }>("/api/attachments", { method: "POST", body })
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong"
  if (typeof error.detail === "string") return error.detail
  if (Array.isArray(error.detail)) {
    const lines = error.detail.map((item) => {
      if (!item || typeof item !== "object" || !("msg" in item)) return String(item)
      const record = item as { msg?: string; loc?: unknown[] }
      const field = Array.isArray(record.loc)
        ? record.loc.filter((part) => part !== "body").join(".")
        : ""
      return field ? `${field}: ${record.msg ?? "Invalid value"}` : (record.msg ?? "Invalid value")
    })
    return lines.filter(Boolean).join(" ") || error.message
  }
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
