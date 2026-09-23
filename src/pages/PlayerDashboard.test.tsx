import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ability, Character, PlayerBundle, Profile, Spell } from '../types'
import { PlayerDashboard } from './PlayerDashboard'

const apiMocks = vi.hoisted(() => ({
  listEligibleSpells: vi.fn(),
  loadPlayerBundle: vi.fn(),
  playerToggleSpell: vi.fn(),
}))

vi.mock('../lib/api', () => apiMocks)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const profile: Profile = {
  id: 'player-id',
  username: 'player',
  display_name: 'Player',
  role: 'player',
}

const character: Character = {
  id: 'character-id',
  user_id: profile.id,
  campaign_id: 'campaign-id',
  login_username: 'player',
  name: 'Lyra',
  class_key: 'fighter',
  subclass: null,
  level: 5,
  notes: null,
  preparation_unlocked: false,
  choices_unlocked: false,
  max_cantrips_override: null,
  max_prepared_override: null,
  max_spell_level_override: null,
  created_at: '',
  updated_at: '',
}

const secondCharacter: Character = {
  ...character,
  id: 'second-character-id',
  campaign_id: 'second-campaign-id',
  name: 'Keth',
  class_key: 'warlock',
}

const spell: Spell = {
  id: 'spell-id',
  slug: 'fire-bolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'evocation',
  classes: ['wizard'],
  action_type: 'action',
  casting_time: null,
  casting_trigger: null,
  range: '120 feet',
  components: ['v', 's'],
  material: null,
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  description: 'Hurl a mote of fire.',
  higher_level: null,
  cantrip_upgrade: 'Damage increases at higher levels.',
  source_type: 'srd',
  source_label: 'SRD 5.2.1',
  original_spell_id: null,
  created_by: null,
  created_at: '',
  updated_at: '',
}

const ability = (overrides: Partial<Ability>): Ability => ({
  id: 'ability-id',
  slug: 'action-surge',
  name: 'Action Surge',
  category: 'Fighter feature',
  class_key: 'fighter',
  level_required: 2,
  feature_order: 1,
  is_system: true,
  ability_kind: 'class_feature',
  source_type: 'srd',
  action_type: null,
  uses: '1 use',
  recharge: 'Short Rest',
  summary: 'Take an additional action.',
  description: 'Push beyond your normal limits.',
  prerequisite: null,
  repeatable: false,
  source: 'Fighter level 2',
  tags: ['fighter'],
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const item = ability({
  id: 'item-id',
  slug: 'ring-of-stars',
  name: 'Ring of Stars',
  category: 'Ring',
  class_key: null,
  level_required: null,
  ability_kind: 'magic_item',
  item_type: 'Ring',
  item_rarity: 'Rare',
  attunement: 'Requires Attunement',
  summary: 'A ring filled with starlight.',
  description: 'The ring glows beneath the night sky.',
  tags: ['magic item', 'space'],
})

const bundle: PlayerBundle = {
  character,
  availableCharacters: [character],
  campaigns: [{ id: 'campaign-id', name: 'Spelljammer', created_by: 'dm-id', created_at: '', updated_at: '' }],
  progression: {
    class_key: 'fighter',
    level: 5,
    cantrips: 0,
    prepared_spells: 0,
    max_spell_level: 0,
    selection_mode: 'none',
  },
  spellAssignments: [{
    id: 'spell-assignment',
    character_id: character.id,
    spell_id: spell.id,
    in_collection: true,
    is_prepared: true,
    always_prepared: false,
    assigned_by_dm: true,
    notes: null,
    spell,
  }],
  abilities: [
    { id: 'ability-assignment', character_id: character.id, ability_id: 'ability-id', sort_order: 1, assignment_type: 'automatic', is_enabled: true, notes: null, ability: ability({}) },
    { id: 'item-assignment', character_id: character.id, ability_id: item.id, sort_order: 2, assignment_type: 'dm_included', is_enabled: true, notes: 'Gift from the astral captain', ability: item },
  ],
}

describe('PlayerDashboard card search', () => {
  it('offers search on every card tab and filters the combined view', async () => {
    apiMocks.loadPlayerBundle.mockResolvedValue(bundle)
    apiMocks.listEligibleSpells.mockResolvedValue([spell])

    render(<PlayerDashboard profile={profile} onError={vi.fn()} onSuccess={vi.fn()} />)

    const allSearch = await screen.findByLabelText('Search all cards')
    fireEvent.change(allSearch, { target: { value: 'astral captain' } })
    expect(screen.getByText('Ring of Stars')).toBeInTheDocument()
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument()
    expect(screen.queryByText('Action Surge')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Spells' }))
    expect(screen.getByLabelText('Search spells')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Magic items' }))
    expect(screen.getByLabelText('Search magic items')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Abilities' }))
    expect(screen.getByLabelText('Search abilities')).toBeInTheDocument()
  })

  it('switches between characters and campaigns on one account', async () => {
    const campaigns = [
      { id: 'campaign-id', name: 'Spelljammer', created_by: 'dm-id', created_at: '', updated_at: '' },
      { id: 'second-campaign-id', name: 'Tomb of Annihilation', created_by: 'dm-id', created_at: '', updated_at: '' },
    ]
    const firstBundle = { ...bundle, availableCharacters: [character, secondCharacter], campaigns }
    const secondBundle: PlayerBundle = {
      ...bundle,
      character: secondCharacter,
      availableCharacters: [character, secondCharacter],
      campaigns,
      progression: {
        class_key: 'warlock',
        level: 5,
        cantrips: 3,
        prepared_spells: 6,
        max_spell_level: 3,
        selection_mode: 'level_choice',
      },
      spellAssignments: [],
      abilities: [],
    }
    apiMocks.loadPlayerBundle
      .mockResolvedValueOnce(firstBundle)
      .mockResolvedValueOnce(secondBundle)
    apiMocks.listEligibleSpells.mockResolvedValue([])

    render(<PlayerDashboard profile={profile} onError={vi.fn()} onSuccess={vi.fn()} />)

    const switcher = await screen.findByLabelText('Character and campaign')
    expect(screen.getByRole('option', { name: 'Lyra — Spelljammer' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Keth — Tomb of Annihilation' })).toBeInTheDocument()

    fireEvent.change(switcher, { target: { value: secondCharacter.id } })

    expect(await screen.findByRole('heading', { name: 'Keth' })).toBeInTheDocument()
    expect(apiMocks.loadPlayerBundle).toHaveBeenLastCalledWith(profile.id, secondCharacter.id)
  })
})
