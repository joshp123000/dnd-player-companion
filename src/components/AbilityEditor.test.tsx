import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AbilityEditor } from './AbilityEditor'

afterEach(cleanup)

describe('AbilityEditor', () => {
  it('creates a custom magic-item card with item-specific fields', () => {
    const onSubmit = vi.fn()
    render(
      <AbilityEditor
        abilityKind="magic_item"
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    )

    expect(screen.getByLabelText(/Specific type/)).toHaveValue('')
    expect(screen.getByLabelText('Source')).toHaveValue('Homebrew')
    expect(screen.getByRole('button', { name: 'Create magic item' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Compass of Returning' } })
    fireEvent.change(screen.getByLabelText('Rarity'), { target: { value: 'Rare' } })
    fireEvent.change(screen.getByLabelText(/Full description/), { target: { value: 'The needle points toward its bonded owner.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create magic item' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Compass of Returning',
      category: 'Wondrous Item',
      item_type: null,
      item_rarity: 'Rare',
      source: 'Homebrew',
      tags: ['magic item'],
    }))
  })

  it('keeps the regular custom-ability form separate from magic items', () => {
    render(<AbilityEditor onSubmit={() => undefined} onCancel={() => undefined} />)

    expect(screen.getByLabelText('Ability name')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Specific type/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create ability' })).toBeInTheDocument()
  })
})
