import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../types'
import { AppShell } from './AppShell'

afterEach(cleanup)

const profile: Profile = {
  id: 'player-1',
  username: 'ragnar',
  display_name: 'Ragnar',
  role: 'player',
}

describe('AppShell account settings', () => {
  it('lets a player choose a saved compendium style', async () => {
    const onThemeChange = vi.fn().mockResolvedValue(undefined)
    render(
      <AppShell
        profile={profile}
        themeKey="classic"
        onChangePassword={vi.fn()}
        onThemeChange={onThemeChange}
        onSignOut={vi.fn()}
      >
        <div>Player dashboard</div>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Account/ }))
    expect(screen.getByRole('option', { name: 'Spelljammer' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomb of Annihilation' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Compendium style/), { target: { value: 'spelljammer' } })
    await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith('spelljammer'))
  })
})
