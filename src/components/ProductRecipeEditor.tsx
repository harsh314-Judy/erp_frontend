import { useState } from "react"
import { ArrowDown, ArrowUp, Boxes, GitCommit, PlusCircle, X } from "lucide-react"

import { Field, SearchSelect } from "@/components/plant-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type Option = { id: string; label: string }

export type RecipeLine = {
  component_product_id: string | null
  component_raw_material_id: string | null
  quantity_per_unit: string
}

const selectClass =
  "h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 focus:outline-none"

export function ProductRecipeEditor({
  lines,
  route,
  materials,
  products,
  operations,
  readOnly,
  onLinesChange,
  onRouteChange,
}: {
  lines: RecipeLine[]
  route: string[]
  materials: Option[]
  products: Option[]
  operations: Option[]
  readOnly: boolean
  onLinesChange: (lines: RecipeLine[]) => void
  onRouteChange: (route: string[]) => void
}) {
  const [draft, setDraft] = useState({ kind: "material", itemId: "", quantity: "1" })

  function lineName(line: RecipeLine) {
    if (line.component_raw_material_id) {
      return materials.find((item) => item.id === line.component_raw_material_id)?.label ?? "Raw material"
    }
    return products.find((item) => item.id === line.component_product_id)?.label ?? "Product"
  }

  function addLine() {
    if (!draft.itemId || !(Number(draft.quantity) > 0)) return
    onLinesChange([
      ...lines,
      {
        component_product_id: draft.kind === "product" ? draft.itemId : null,
        component_raw_material_id: draft.kind === "material" ? draft.itemId : null,
        quantity_per_unit: draft.quantity,
      },
    ])
    setDraft({ ...draft, itemId: "", quantity: "1" })
  }

  function moveStage(index: number, step: -1 | 1) {
    const target = index + step
    if (target < 0 || target >= route.length) return
    const next = [...route]
    ;[next[index], next[target]] = [next[target], next[index]]
    onRouteChange(next)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-green-50 text-green-600">
            <Boxes className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Recipe for 1 unit</p>
            <p className="text-[11px] text-gray-500">Held from stock when a production job starts</p>
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
            No inputs yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line, index) => (
              <li
                key={index}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2 text-xs"
              >
                <span className="flex-1 truncate font-semibold text-gray-900">{lineName(line)}</span>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  aria-label={`Quantity of ${lineName(line)}`}
                  className="h-8 w-24 text-right bg-white"
                  value={line.quantity_per_unit}
                  disabled={readOnly}
                  onChange={(event) =>
                    onLinesChange(
                      lines.map((item, position) =>
                        position === index ? { ...item, quantity_per_unit: event.target.value } : item,
                      ),
                    )
                  }
                />
                {readOnly ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${lineName(line)}`}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => onLinesChange(lines.filter((_, position) => position !== index))}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {readOnly ? null : (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Input type">
                <select
                  className={selectClass}
                  value={draft.kind}
                  onChange={(event) => setDraft({ ...draft, kind: event.target.value, itemId: "" })}
                >
                  <option value="material">Raw material</option>
                  <option value="product">Another product</option>
                </select>
              </Field>
              <Field label="Quantity per unit">
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={draft.quantity}
                  onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
                />
              </Field>
            </div>
            <SearchSelect
              label="Item"
              options={draft.kind === "product" ? products : materials}
              value={draft.itemId}
              onChange={(itemId) => setDraft({ ...draft, itemId })}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={!draft.itemId}
              onClick={addLine}
            >
              <PlusCircle className="mr-1.5 size-4" />
              Add input
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-green-50 text-green-600">
            <GitCommit className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Stage route</p>
            <p className="text-[11px] text-gray-500">Order the floor follows for a new job</p>
          </div>
        </div>

        {route.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
            No stages yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {route.map((id, index) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-50/50 p-2 text-xs"
              >
                <span className="grid size-6 place-items-center rounded-md bg-green-600 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="flex-1 font-semibold capitalize text-gray-900">
                  {operations.find((item) => item.id === id)?.label ?? id}
                </span>
                {readOnly ? null : (
                  <>
                    <button
                      type="button"
                      aria-label="Move stage up"
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveStage(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move stage down"
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      disabled={index === route.length - 1}
                      onClick={() => moveStage(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}

        {readOnly ? null : (
          <div className="grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2">
            {operations.map((operation) => {
              const checked = route.includes(operation.id)
              return (
                <label
                  key={operation.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs capitalize transition-colors",
                    checked
                      ? "border-green-500/50 bg-green-50 font-semibold text-green-800"
                      : "border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-green-600"
                    checked={checked}
                    onChange={(event) =>
                      onRouteChange(
                        event.target.checked
                          ? [...route, operation.id]
                          : route.filter((item) => item !== operation.id),
                      )
                    }
                  />
                  {operation.label}
                </label>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
