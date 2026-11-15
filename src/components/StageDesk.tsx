import { useEffect, useState } from "react"

import { WorkerPicker, type WorkerChoice } from "@/components/WorkerPicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

export const PROBLEM_REASONS = [
  "machine down",
  "no material",
  "waiting for previous stage",
  "people short",
  "outside, not back",
  "other",
] as const

export const SCRAP_REASONS = [
  "cut wrong",
  "bend crack",
  "wrong angle",
  "weld defect",
  "scratch",
  "color reject",
  "pack damage",
  "other",
] as const

type InputLine = {
  input_id?: string
  item_name: string
  planned_quantity: string
  kind?: string | null
  taken_quantity?: string
}

type DeskMachine = { id: string; name: string; status: string }

type DeskSend = {
  id: string
  supplier_id: string
  supplier_name: string
  quantity: string
  sent_on: string
  still_out: string
}

type DeskStage = {
  id: string
  operation_id: string
  operation_name: string | null
  started_at?: string | null
  good_quantity?: string
  scrap_quantity?: string
  problem_reason?: string | null
  problem_note?: string | null
  problem_machine_name?: string | null
  allows_send_out?: boolean
  standard_scrap_percent?: string | null
  sends?: DeskSend[]
}

type SheetDraft = { used: string; remnant: string; size: string }

const selectClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900"

export function StageDesk({
  jobId,
  jobStatus,
  quantity,
  remaining,
  stage,
  inputs,
  machines,
  bundleSize,
  busy,
  post,
}: {
  jobId: string
  jobStatus: string
  quantity: string
  remaining: string
  stage: DeskStage
  inputs: InputLine[]
  machines?: DeskMachine[]
  bundleSize?: string | null
  busy?: boolean
  post: (path: string, body?: unknown) => Promise<boolean | void>
}) {
  const [choice, setChoice] = useState<WorkerChoice | null>(null)
  const [good, setGood] = useState(remaining)
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [vendorId, setVendorId] = useState("")
  const [sendQty, setSendQty] = useState("")
  const [sentOn, setSentOn] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  )
  const [sendId, setSendId] = useState("")
  const [backGood, setBackGood] = useState("")
  const [backRejected, setBackRejected] = useState("")
  const [polish, setPolish] = useState("")
  const [firstPiece, setFirstPiece] = useState<boolean | null>(null)
  const [scrapQty, setScrapQty] = useState("")
  const [scrapReason, setScrapReason] = useState<string>(SCRAP_REASONS[0])
  const [problem, setProblem] = useState<string>(PROBLEM_REASONS[0])
  const [problemNote, setProblemNote] = useState("")
  const [machineId, setMachineId] = useState("")
  const [sheetDraft, setSheetDraft] = useState<Record<string, SheetDraft>>({})
  const [loadedMachines, setLoadedMachines] = useState<DeskMachine[] | null>(machines ?? null)
  const name = (stage.operation_name || "").toLowerCase()
  const roster = machines ?? loadedMachines ?? []
  const sheets = inputs.filter((row) => row.kind === "sheet" && row.input_id)
  const openSends = (stage.sends ?? []).filter((row) => Number(row.still_out) > 0)

  useEffect(() => {
    setGood(remaining)
  }, [remaining])

  useEffect(() => {
    if (!stage.allows_send_out) return
    api<{ id: string; name: string }[]>("/api/production-jobs/vendors")
      .then(setVendors)
      .catch(() => setVendors([]))
  }, [stage.allows_send_out])

  useEffect(() => {
    if (machines) {
      setLoadedMachines(machines)
      return
    }
    let cancel = false
    api<DeskMachine[]>(`/api/machines?operation_id=${stage.operation_id}`)
      .then((rows) => {
        if (!cancel) setLoadedMachines(rows)
      })
      .catch(() => {
        if (!cancel) setLoadedMachines([])
      })
    return () => {
      cancel = true
    }
  }, [machines, stage.operation_id])
  const open = jobStatus === "in_progress"
  const pending = jobStatus === "pending"

  async function send(path: string, body?: unknown) {
    const ok = await post(`/api/production-jobs/${jobId}${path}`, body)
    if (ok !== false) {
      setScrapQty("")
      setProblemNote("")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span>Good so far <strong className="text-gray-900">{stage.good_quantity || "0"}</strong> of {quantity}</span>
        <span>Scrap <strong className="text-gray-900">{stage.scrap_quantity || "0"}</strong></span>
        <span>Still to finish <strong className="text-gray-900">{remaining}</strong></span>
        {name === "packaging" && bundleSize ? <span>Bundle {bundleSize}</span> : null}
      </div>
      {stage.problem_reason ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Problem: {stage.problem_reason}
          {stage.problem_machine_name ? ` — ${stage.problem_machine_name}` : ""}
          {stage.problem_note ? ` — ${stage.problem_note}` : ""}
          <Button
            type="button"
            variant="outline"
            className="ml-3 h-8"
            disabled={busy || !open}
            onClick={() => void send(`/stages/${stage.id}/problem/clear`)}
          >
            Clear
          </Button>
        </p>
      ) : null}
      {inputs.length > 0 ? (
        <ul className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {inputs.map((row) => (
            <li key={`${row.item_name}-${row.planned_quantity}`}>
              {row.item_name} · planned {row.planned_quantity}
            </li>
          ))}
        </ul>
      ) : null}
      <WorkerPicker operationId={stage.operation_id} value={choice} onChange={(next) => setChoice(next)} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          disabled={busy || !choice || (!pending && !open)}
          className="h-12 rounded-xl bg-slate-900 text-white"
          onClick={() => void send(`/stages/${stage.id}/start`, choice)}
        >
          Start
        </Button>
        <div className="grid gap-2">
          <Input type="number" min="0" step="any" value={good} onChange={(event) => setGood(event.target.value)} />
          {name === "polishing" ? (
            <select className={selectClass} value={polish} onChange={(event) => setPolish(event.target.value)}>
              <option value="">Dry or wet</option>
              <option value="dry">Dry</option>
              <option value="wet">Wet</option>
            </select>
          ) : null}
          {name === "shaping" ? (
            <select
              className={selectClass}
              value={firstPiece === null ? "" : firstPiece ? "yes" : "no"}
              onChange={(event) => setFirstPiece(event.target.value === "" ? null : event.target.value === "yes")}
            >
              <option value="">First piece ok?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : null}
          {name === "cutting"
            ? sheets.map((row) => {
                const draft = sheetDraft[row.input_id || ""] ?? { used: "", remnant: "", size: "" }
                return (
                  <div key={row.input_id} className="grid gap-2 rounded-xl border border-gray-200 p-2">
                    <p className="text-xs font-semibold text-gray-800">
                      {row.item_name}
                      {Number(row.taken_quantity || 0) > 0 ? ` · taken ${row.taken_quantity}` : ""}
                    </p>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Sheets used"
                      value={draft.used}
                      onChange={(event) =>
                        setSheetDraft({ ...sheetDraft, [row.input_id || ""]: { ...draft, used: event.target.value } })
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Remnant returned"
                      value={draft.remnant}
                      onChange={(event) =>
                        setSheetDraft({ ...sheetDraft, [row.input_id || ""]: { ...draft, remnant: event.target.value } })
                      }
                    />
                    <Input
                      placeholder="Remnant size"
                      value={draft.size}
                      onChange={(event) =>
                        setSheetDraft({ ...sheetDraft, [row.input_id || ""]: { ...draft, size: event.target.value } })
                      }
                    />
                  </div>
                )
              })
            : null}
          <Button
            type="button"
            disabled={busy || !open || !choice || !good || (name === "polishing" && !polish) || (name === "shaping" && firstPiece === null)}
            className="h-12 rounded-xl bg-green-700 text-white"
            onClick={() =>
              void send(`/stages/${stage.id}/complete`, {
                ...choice,
                quantity: good,
                polish_type: name === "polishing" ? polish : null,
                first_piece_ok: name === "shaping" ? firstPiece : null,
                sheets:
                  name === "cutting"
                    ? sheets
                        .map((row) => {
                          const draft = sheetDraft[row.input_id || ""] ?? { used: "", remnant: "", size: "" }
                          return {
                            input_id: row.input_id,
                            sheets_used: draft.used || "0",
                            remnant_quantity: draft.remnant || "0",
                            remnant_size: draft.size.trim() || null,
                          }
                        })
                        .filter((line) => Number(line.sheets_used) > 0 || Number(line.remnant_quantity) > 0)
                    : [],
              })
            }
          >
            Done
          </Button>
        </div>
        <div className="grid gap-2">
          <Input type="number" min="0" step="any" placeholder="Scrap quantity" value={scrapQty} onChange={(event) => setScrapQty(event.target.value)} />
          <select className={selectClass} value={scrapReason} onChange={(event) => setScrapReason(event.target.value)}>
            {SCRAP_REASONS.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !open || !choice || !scrapQty}
            className="h-12"
            onClick={() => void send(`/stages/${stage.id}/scrap`, { ...choice, quantity: scrapQty, reason: scrapReason })}
          >
            Scrap
          </Button>
        </div>
        <div className="grid gap-2">
          <select className={selectClass} value={problem} onChange={(event) => setProblem(event.target.value)}>
            {PROBLEM_REASONS.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
          {problem === "machine down" && roster.length > 0 ? (
            <select className={selectClass} value={machineId} onChange={(event) => setMachineId(event.target.value)}>
              <option value="">Choose a machine</option>
              {roster.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}{machine.status === "down" ? " (down)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <Input placeholder="Optional note" value={problemNote} onChange={(event) => setProblemNote(event.target.value)} />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !open || (problem === "machine down" && roster.length > 0 && !machineId)}
            className="h-12"
            onClick={() =>
              void send(`/stages/${stage.id}/problem`, {
                reason: problem,
                note: problemNote || null,
                machine_id: problem === "machine down" && machineId ? machineId : null,
              })
            }
          >
            Problem
          </Button>
        </div>
      </div>
      {stage.allows_send_out ? (
        <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {stage.standard_scrap_percent != null && stage.standard_scrap_percent !== "" ? (
            <p className="text-xs text-amber-900">Usual scrap about {stage.standard_scrap_percent}%. This is a hint only.</p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectClass} value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
              <option value="">Vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
            <Input type="number" min="0" step="any" placeholder="Quantity leaving" value={sendQty} onChange={(event) => setSendQty(event.target.value)} />
            <Input type="date" value={sentOn} onChange={(event) => setSentOn(event.target.value)} />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !open || !vendorId || !(Number(sendQty) > 0)}
              className="h-12"
              onClick={() =>
                void send(`/stages/${stage.id}/send`, {
                  supplier_id: vendorId,
                  quantity: sendQty,
                  sent_on: sentOn || null,
                })
              }
            >
              Send out
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectClass} value={sendId} onChange={(event) => setSendId(event.target.value)}>
              <option value="">{openSends.length ? "Which send came back" : "Nothing is still outside"}</option>
              {openSends.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.still_out} at {row.supplier_name} · sent {row.sent_on}
                </option>
              ))}
            </select>
            <Input type="number" min="0" step="any" placeholder="Good back" value={backGood} onChange={(event) => setBackGood(event.target.value)} />
            <Input type="number" min="0" step="any" placeholder="Rejected" value={backRejected} onChange={(event) => setBackRejected(event.target.value)} />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !open || !sendId || !(Number(backGood) > 0 || Number(backRejected) > 0)}
              className="h-12"
              onClick={() =>
                void send(`/stages/${stage.id}/return`, {
                  send_id: sendId,
                  good_quantity: backGood || "0",
                  rejected_quantity: backRejected || "0",
                })
              }
            >
              Came back
            </Button>
          </div>
        </div>
      ) : null}
      {pending ? <p className="text-xs text-gray-500">Start holds the material, then Done, Scrap, and Problem open.</p> : null}
    </div>
  )
}
