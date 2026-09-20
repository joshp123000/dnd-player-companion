import { describe, expect, it } from 'vitest'
import type { Spell } from '../types'
import { spellInputFromSpell } from '../lib/spellEditing'

const generatedSpell: Spell = {
  id: 'spell-id',
  slug: 'srd-fireball',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  classes: ['sorcerer', 'wizard'],
  action_type: 'action',
  casting_time: null,
  casting_trigger: null,
  range: '150 feet',
  components: ['v', 's', 'm'],
  material: 'a ball of bat guano and sulfur',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  description: 'A bright streak flashes to a point you choose.',
  higher_level: 'The damage increases by 1d6.',
  cantrip_upgrade: null,
  source_type: 'srd',
  source_label: 'SRD 5.2 (2024)',
  original_spell_id: null,
  created_by: null,
  created_at: '',
  updated_at: '',
}

describe('spellInputFromSpell', () => {
  it('preserves a generated card name and source during a direct edit', () => {
    expect(spellInputFromSpell(generatedSpell)).toMatchObject({
      name: 'Fireball',
      source_label: 'SRD 5.2 (2024)',
      original_spell_id: null,
    })
  })

  it('creates an independent homebrew identity for a duplicate', () => {
    expect(spellInputFromSpell(generatedSpell, true)).toMatchObject({
      name: 'Fireball (Custom)',
      source_label: 'Homebrew',
      original_spell_id: 'spell-id',
    })
  })
})
