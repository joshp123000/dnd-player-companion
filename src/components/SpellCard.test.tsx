import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Spell } from '../types'
import { SpellCard } from './SpellCard'

afterEach(cleanup)

const spell: Spell = {
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
  description: 'Each creature makes a **Dexterity saving throw**.',
  higher_level: 'The damage increases by 1d6.',
  cantrip_upgrade: null,
  source_type: 'srd',
  source_label: 'SRD 5.2 (2024)',
  original_spell_id: null,
  created_by: null,
  created_at: '',
  updated_at: '',
}

describe('SpellCard', () => {
  it('starts compact and expands full rules on demand', () => {
    render(<SpellCard spell={spell} />)
    expect(screen.getByText('Fireball')).toBeInTheDocument()
    expect(screen.queryByText(/Dexterity saving throw/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Fireball/i }))

    expect(screen.getByText(/Dexterity saving throw/)).toBeInTheDocument()
    expect(screen.getByText('Using a Higher-Level Slot')).toBeInTheDocument()
    expect(screen.getByText(/bat guano/)).toBeInTheDocument()
  })

  it('does not show stale cantrip upgrade text on a leveled spell', () => {
    render(<SpellCard spell={{ ...spell, cantrip_upgrade: 'This should only appear on a cantrip.' }} defaultOpen />)

    expect(screen.getByText('Using a Higher-Level Slot')).toBeInTheDocument()
    expect(screen.queryByText('Cantrip Upgrade')).not.toBeInTheDocument()
    expect(screen.queryByText('This should only appear on a cantrip.')).not.toBeInTheDocument()
  })

  it('does not show stale higher-level text on a cantrip', () => {
    render(<SpellCard spell={{ ...spell, level: 0, higher_level: 'Stale slot text.', cantrip_upgrade: 'Damage increases at higher character levels.' }} defaultOpen />)

    expect(screen.getByText('Cantrip Upgrade')).toBeInTheDocument()
    expect(screen.queryByText('Using a Higher-Level Slot')).not.toBeInTheDocument()
    expect(screen.queryByText('Stale slot text.')).not.toBeInTheDocument()
  })

  it('labels a generated card after a DM correction', () => {
    render(<SpellCard spell={{ ...spell, dm_edited: true }} />)

    expect(screen.getByText('DM edited')).toBeInTheDocument()
  })
})
