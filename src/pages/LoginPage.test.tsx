import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('shows the activation fields only during first-time setup', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />)
    expect(screen.getByLabelText('Username or DM email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Activation code')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'First-time setup' }))

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText(/Activation code/)).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })
})
