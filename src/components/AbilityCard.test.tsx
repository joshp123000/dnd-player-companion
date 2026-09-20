import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Ability } from '../types'
import { AbilityCard } from './AbilityCard'

const ability: Ability = {
  id: 'ability-id',
  slug: 'forge-artificer-7-flash-of-genius',
  name: 'Flash of Genius',
  category: 'Artificer feature',
  class_key: 'artificer',
  level_required: 7,
  feature_order: 1,
  is_system: true,
  source_type: 'book',
  action_type: 'Reaction',
  uses: 'Intelligence modifier',
  recharge: 'Long Rest',
  summary: 'Improve a failed check or save.',
  description: 'Add your Intelligence modifier to the roll.',
  source: 'Artificer level 7',
  tags: ['artificer'],
  created_by: null,
  created_at: '',
  updated_at: '',
}

describe('AbilityCard', () => {
  it('shows level metadata and assignment status for built-in features', () => {
    render(<AbilityCard ability={ability} badge="Automatic" />)

    expect(screen.getByText('Flash of Genius')).toBeInTheDocument()
    expect(screen.getByText('Automatic')).toBeInTheDocument()
    expect(screen.getByText(/Level 7 · Reaction · Intelligence modifier · Long Rest/)).toBeInTheDocument()
  })
})
