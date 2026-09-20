export interface SpellSelectionChanges {
  added: string[]
  removed: string[]
}

export const setsMatch = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) return false
  return [...left].every((value) => right.has(value))
}

export const spellSelectionChanges = (
  saved: Set<string>,
  draft: Set<string>,
): SpellSelectionChanges => ({
  removed: [...saved].filter((spellId) => !draft.has(spellId)),
  added: [...draft].filter((spellId) => !saved.has(spellId)),
})

export const toggleSetValue = (values: Set<string>, value: string) => {
  const next = new Set(values)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
