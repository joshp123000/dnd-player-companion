import type { SpellInput } from './api'
import type { Spell } from '../types'

export const spellInputFromSpell = (spell?: Spell | null, duplicate = false): SpellInput => ({
  name: spell ? `${spell.name}${duplicate && spell.source_type === 'srd' ? ' (Custom)' : ''}` : '',
  level: spell?.level ?? 0,
  school: spell?.school ?? 'evocation',
  classes: spell?.classes ?? [],
  action_type: spell?.action_type ?? 'action',
  casting_time: spell?.casting_time ?? null,
  casting_trigger: spell?.casting_trigger ?? null,
  range: spell?.range ?? 'Self',
  components: spell?.components ?? [],
  material: spell?.material ?? null,
  duration: spell?.duration ?? 'Instantaneous',
  concentration: spell?.concentration ?? false,
  ritual: spell?.ritual ?? false,
  description: spell?.description ?? '',
  higher_level: spell?.higher_level ?? null,
  cantrip_upgrade: spell?.cantrip_upgrade ?? null,
  source_label: duplicate ? 'Homebrew' : spell?.source_label ?? 'Homebrew',
  original_spell_id: duplicate && spell?.source_type === 'srd'
    ? spell.id
    : spell?.original_spell_id ?? null,
})
