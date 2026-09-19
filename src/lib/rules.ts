import progressionData from '../data/class-progression.json'
import type { Character, ClassProgression, EffectiveLimits, SelectionMode } from '../types'

type ProgressionSource = Record<
  string,
  {
    selectionMode: SelectionMode
    cantrips: number[]
    prepared: number[]
    maxLevel: number[]
  }
>

const progression = progressionData as ProgressionSource

export const CHARACTER_CLASSES = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const

export const SPELLCASTING_CLASSES = Object.keys(progression)

export const classLabel = (classKey: string) =>
  classKey ? `${classKey.charAt(0).toUpperCase()}${classKey.slice(1)}` : 'Unassigned'

export const defaultProgression = (classKey: string, level: number): ClassProgression | null => {
  const rules = progression[classKey]
  if (!rules) return null
  const index = Math.max(0, Math.min(19, level - 1))
  return {
    class_key: classKey,
    level: index + 1,
    cantrips: rules.cantrips[index],
    prepared_spells: rules.prepared[index],
    max_spell_level: rules.maxLevel[index],
    selection_mode: rules.selectionMode,
  }
}

export const effectiveLimits = (
  character: Character,
  serverProgression?: ClassProgression | null,
): EffectiveLimits => {
  const defaults = serverProgression ?? defaultProgression(character.class_key, character.level)
  return {
    cantrips: character.max_cantrips_override ?? defaults?.cantrips ?? 0,
    preparedSpells: character.max_prepared_override ?? defaults?.prepared_spells ?? 0,
    maxSpellLevel: character.max_spell_level_override ?? defaults?.max_spell_level ?? 0,
    selectionMode: defaults?.selection_mode ?? 'none',
  }
}

export const selectionLabel = (mode: SelectionMode) => {
  switch (mode) {
    case 'daily':
      return 'Prepared spells'
    case 'level_choice':
      return 'Chosen spells'
    case 'spellbook':
      return 'Prepared from spellbook'
    default:
      return 'Granted spells'
  }
}

export const spellLevelLabel = (level: number) => {
  if (level === 0) return 'Cantrip'
  const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'
  return `${level}${suffix} level`
}

export const isSpellEligible = (classKey: string, maxLevel: number, level: number, classes: string[]) =>
  level <= maxLevel && classes.includes(classKey)
