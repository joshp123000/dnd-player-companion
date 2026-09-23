import type { CharacterClass, CharacterClassInput, ClassProgression, EffectiveLimits } from '../types'
import { classLabel, defaultProgression } from './rules'

export type ClassLevelLike = Pick<CharacterClassInput, 'class_key' | 'class_level' | 'subclass' | 'is_primary'>

export interface ClassSpellcastingProfile {
  classLevel: CharacterClass
  progression: ClassProgression | null
  limits: EffectiveLimits
}

export interface SharedSpellSlots {
  casterLevel: number
  slots: number[]
  pactMagic: { classLevel: number; slots: number; slotLevel: number } | null
}

const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
const HALF_CASTERS = new Set(['artificer', 'paladin', 'ranger'])

const MULTICLASS_SLOTS: number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const normalizedSubclass = (value: string | null) => value?.trim().toLowerCase().replace(/[^a-z]/g, '') ?? ''

export const casterLevelContribution = (entry: ClassLevelLike) => {
  if (FULL_CASTERS.has(entry.class_key)) return entry.class_level
  if (HALF_CASTERS.has(entry.class_key)) return Math.ceil(entry.class_level / 2)
  const subclass = normalizedSubclass(entry.subclass)
  if (
    (entry.class_key === 'fighter' && subclass.includes('eldritchknight'))
    || (entry.class_key === 'rogue' && subclass.includes('arcanetrickster'))
  ) return Math.floor(entry.class_level / 3)
  return 0
}

const pactMagicForLevel = (level: number) => {
  if (level < 1) return null
  const slots = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4
  const slotLevel = level < 3 ? 1 : level < 5 ? 2 : level < 7 ? 3 : level < 9 ? 4 : 5
  return { classLevel: level, slots, slotLevel }
}

export const sharedSpellSlots = (classes: ClassLevelLike[]): SharedSpellSlots => {
  const casterLevel = Math.min(20, classes.reduce((sum, entry) => sum + casterLevelContribution(entry), 0))
  const warlockLevel = classes.find((entry) => entry.class_key === 'warlock')?.class_level ?? 0
  return {
    casterLevel,
    slots: [...(MULTICLASS_SLOTS[casterLevel] ?? [])],
    pactMagic: pactMagicForLevel(warlockLevel),
  }
}

export const characterClassLabel = (entry: ClassLevelLike) =>
  `${entry.subclass ? `${entry.subclass} ` : ''}${classLabel(entry.class_key)} ${entry.class_level}`

export const characterBuildLabel = (classes: ClassLevelLike[]) =>
  [...classes]
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.class_key.localeCompare(right.class_key))
    .map(characterClassLabel)
    .join(' / ')

export const classAssignmentKey = (classKey: string, spellId: string) => `${classKey}::${spellId}`

export const parseClassAssignmentKey = (key: string) => {
  const separator = key.indexOf('::')
  return { classKey: key.slice(0, separator), spellId: key.slice(separator + 2) }
}

export const effectiveClassLimits = (
  classLevel: Pick<CharacterClass, 'class_key' | 'class_level' | 'max_cantrips_override' | 'max_prepared_override' | 'max_spell_level_override'>,
  serverProgression?: ClassProgression | null,
): EffectiveLimits => {
  const defaults = serverProgression ?? defaultProgression(classLevel.class_key, classLevel.class_level)
  return {
    cantrips: classLevel.max_cantrips_override ?? defaults?.cantrips ?? 0,
    preparedSpells: classLevel.max_prepared_override ?? defaults?.prepared_spells ?? 0,
    maxSpellLevel: classLevel.max_spell_level_override ?? defaults?.max_spell_level ?? 0,
    selectionMode: defaults?.selection_mode ?? 'none',
  }
}

export const totalCharacterLevel = (classes: ClassLevelLike[]) =>
  classes.reduce((sum, entry) => sum + entry.class_level, 0)

export const validateCharacterClasses = (classes: ClassLevelLike[]) => {
  if (classes.length === 0) return 'Add at least one class.'
  if (new Set(classes.map((entry) => entry.class_key)).size !== classes.length) return 'Each class can only be added once.'
  if (classes.filter((entry) => entry.is_primary).length !== 1) return 'Choose exactly one primary class.'
  if (classes.some((entry) => !Number.isInteger(entry.class_level) || entry.class_level < 1 || entry.class_level > 20)) {
    return 'Every class level must be between 1 and 20.'
  }
  if (totalCharacterLevel(classes) > 20) return 'Total character level cannot exceed 20.'
  return null
}
