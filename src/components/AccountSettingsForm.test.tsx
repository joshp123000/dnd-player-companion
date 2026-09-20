import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsForm } from './AccountSettingsForm'

afterEach(cleanup)

describe('AccountSettingsForm', () => {
  it('blocks mismatched passwords', async () => {
    const onSubmit = vi.fn()
    render(<AccountSettingsForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'old-password' } })
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'new-password' } })
    fireEvent.change(screen.getByLabelText(/Confirm new password/), { target: { value: 'different-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the current and new password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()
    render(<AccountSettingsForm onSubmit={onSubmit} onCancel={onCancel} />)

    fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'old-password' } })
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'new-password' } })
    fireEvent.change(screen.getByLabelText(/Confirm new password/), { target: { value: 'new-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('old-password', 'new-password'))
    expect(onCancel).toHaveBeenCalled()
  })
})
