import { useRef, useState } from "react"
import { FileText, ImagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { uploadFile, errorMessage } from "@/lib/api"

export type SlipFile = {
  id: string
  attachment_id: string
  filename: string
  content_type: string
}

export function SlipUpload({
  label,
  files,
  onUploaded,
  required,
}: {
  label: string
  files: SlipFile[]
  onUploaded: (file: SlipFile) => Promise<void> | void
  required?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function pick(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setError("")
    setBusy(true)
    try {
      const stored = await uploadFile(file)
      await onUploaded({
        id: stored.id,
        attachment_id: stored.id,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700">
          {label}
          {required ? " *" : ""}
        </p>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl text-xs" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="mr-1 size-3.5" />
          {busy ? "Uploading" : "Upload"}
        </Button>
        <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void pick(event.target.files)} />
      </div>
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) =>
            file.content_type.startsWith("image/") ? (
              <a key={file.id} href={`/api/attachments/${file.attachment_id}/file`} target="_blank" rel="noreferrer">
                <img src={`/api/attachments/${file.attachment_id}/file`} alt={file.filename} className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
              </a>
            ) : (
              <a
                key={file.id}
                href={`/api/attachments/${file.attachment_id}/file`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
              >
                <FileText className="size-3.5" />
                {file.filename}
              </a>
            ),
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">PNG, JPG, or PDF</p>
      )}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  )
}
