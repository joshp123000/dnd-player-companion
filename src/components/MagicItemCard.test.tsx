import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Ability } from '../types'
import { MagicItemCard } from './MagicItemCard'

const item: Ability = {
  id: 'item-id',
  slug: 'srd52-magic-item-ring-of-protection',
  name: 'Ring of Protection',
  category: 'Ring',
  class_key: null,
  level_required: null,
  feature_order: 1,
  is_system: true,
  ability_kind: 'magic_item',
  source_type: 'srd',
  action_type: null,
  uses: null,
  recharge: null,
  summary: 'Gain a bonus while wearing this ring.',
  description: 'You gain a **+1 bonus** to Armor Class and saving throws.',
  prerequisite: null,
  repeatable: false,
  source: 'SRD 5.2.1 (2024)',
  tags: ['magic item', 'ring', 'rare', 'attunement'],
  item_type: 'Ring',
  item_rarity: 'Rare',
  attunement: 'Requires Attunement',
  created_by: null,
  created_at: '',
  updated_at: '',
}

describe('MagicItemCard', () => {
  it('shows item metadata and expands its rules text', () => {
    render(<MagicItemCard item={item} badge="Assigned" />)

    expect(screen.getByText('Ring of Protection')).toBeInTheDocument()
    expect(screen.getByText('Ring · Rare · Requires Attunement')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.queryByText(/Armor Class and saving throws/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ring of Protection/ }))
    expect(screen.getByText(/Armor Class and saving throws/)).toBeInTheDocument()
  })
})
