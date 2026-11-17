export function departmentLabel(name: string | null | undefined) {
  if (!name) return ""
  return name.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
