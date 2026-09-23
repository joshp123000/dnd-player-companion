export type Role = 'dm' | 'player'
export type SpellSource = 'srd' | 'custom'
export type AbilitySource = 'srd' | 'book' | 'custom'
export type AbilityKind = 'class_feature' | 'feat' | 'magic_item' | 'custom'
export type AbilityAssignmentType = 'automatic' | 'dm_included' | 'dm_excluded'
export type SelectionMode = 'daily' | 'level_choice' | 'spellbook' | 'none'

export interface Profile {
  id: string
  username: string
  display_name: string
  role: Role
}

export interface Campaign {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Character {
  id: string
  user_id: string | null
  campaign_id: string
  login_username: string
  name: string
  class_key: string
  subclass: string | null
  level: number
  notes: string | null
  preparation_unlocked: boolean
  choices_unlocked: boolean
  max_cantrips_override: number | null
  max_prepared_override: number | null
  max_spell_level_override: number | null
  created_at: string
  updated_at: string
}

export interface ClassProgression {
  class_key: string
  level: number
  cantrips: number
  prepared_spells: number
  max_spell_level: number
  selection_mode: SelectionMode
}

export interface Spell {
  id: string
  slug: string
  name: string
  level: number
  school: string
  classes: string[]
  action_type: string
  casting_time: string | null
  casting_trigger: string | null
  range: string
  components: string[]
  material: string | null
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  higher_level: string | null
  cantrip_upgrade: string | null
  source_type: SpellSource
  source_label: string
  original_spell_id: string | null
  dm_edited?: boolean
  dm_edited_at?: string | null
  dm_edited_by?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CharacterSpell {
  id: string
  character_id: string
  spell_id: string
  in_collection: boolean
  is_prepared: boolean
  always_prepared: boolean
  assigned_by_dm: boolean
  notes: string | null
  spell?: Spell
}

export interface Ability {
  id: string
  slug: string | null
  name: string
  category: string
  class_key: string | null
  level_required: number | null
  feature_order: number
  is_system: boolean
  ability_kind: AbilityKind
  source_type: AbilitySource
  action_type: string | null
  uses: string | null
  recharge: string | null
  summary: string | null
  description: string
  prerequisite: string | null
  repeatable: boolean
  source: string | null
  tags: string[]
  item_type?: string | null
  item_rarity?: string | null
  attunement?: string | null
  dm_edited?: boolean
  dm_edited_at?: string | null
  dm_edited_by?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MagicItemFilters {
  search: string
  category: string | 'all'
  rarity: string | 'all'
}

export interface CharacterAbility {
  id: string
  character_id: string
  ability_id: string
  sort_order: number
  assignment_type: AbilityAssignmentType
  is_enabled: boolean
  notes: string | null
  ability?: Ability
}

export interface EffectiveLimits {
  cantrips: number
  preparedSpells: number
  maxSpellLevel: number
  selectionMode: SelectionMode
}

export interface PlayerBundle {
  character: Character
  availableCharacters: Character[]
  campaigns: Campaign[]
  progression: ClassProgression | null
  spellAssignments: CharacterSpell[]
  abilities: CharacterAbility[]
}

export interface SpellFilters {
  search: string
  level: number | 'all'
  classKey: string | 'all'
  school: string | 'all'
}

export type ToastTone = 'success' | 'error' | 'info'
export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}
