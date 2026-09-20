import { useState, type FormEvent } from 'react'
import { friendlyError } from '../lib/format'
import { Button, Field, Input } from './ui'

export function AccountSettingsForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
  onCancel: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Choose a new password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your current one.')
      return
    }

    setBusy(true)
    try {
      await onSubmit(currentPassword, newPassword)
      onCancel()
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="editor-form" onSubmit={(event) => void submit(event)}>
      <Field label="Current password" hint="This confirms that it is really you.">
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field label="New password" hint="Use at least 8 characters.">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </Field>
      {error && <div className="form-message form-message--error" role="alert">{error}</div>}
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</Button>
      </div>
    </form>
  )
}
