import { BookOpenText, KeyRound, ShieldCheck, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { activatePlayer, signIn } from '../lib/api'
import { friendlyError } from '../lib/format'
import { Button, Field, Input, SegmentedControl } from '../components/ui'

type LoginMode = 'login' | 'activate'

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<LoginMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'login') {
        await signIn(identifier, password)
        onAuthenticated()
      } else {
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.')
        if (password !== confirmPassword) throw new Error('The two passwords do not match.')
        const result = await activatePlayer(identifier, activationCode, password)
        if (result.session) {
          onAuthenticated()
        } else {
          setMessage('Account activated. You can now sign in with your username and password.')
          setMode('login')
          setPassword('')
          setConfirmPassword('')
          setActivationCode('')
        }
      }
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <span className="eyebrow">Your campaign, at a glance</span>
        <h1>Every spell and ability your character needs.</h1>
        <p>
          A focused companion for the table: fast card lookup, clear spell preparation, and no
          digging through rulebooks mid-turn.
        </p>
        <div className="auth-feature-list">
          <span><ShieldCheck size={19} /> Private character access</span>
          <span><BookOpenText size={19} /> 2024 SRD spell library</span>
          <span><KeyRound size={19} /> DM-controlled choices</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__brand"><BookOpenText size={25} /></div>
        <h2>{mode === 'login' ? 'Welcome back' : 'Activate your character'}</h2>
        <p>
          {mode === 'login'
            ? 'Use your player username and password. DMs may use their email.'
            : 'Use the username and one-time code your DM gave you.'}
        </p>
        <SegmentedControl
          label="Account access"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setError('')
            setMessage('')
          }}
          options={[
            { value: 'login', label: 'Sign in' },
            { value: 'activate', label: 'First-time setup' },
          ]}
        />
        <form className="form-stack" onSubmit={submit}>
          <Field label={mode === 'login' ? 'Username or DM email' : 'Username'}>
            <Input
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={mode === 'login' ? 'ragnar' : 'ragnar'}
              required
            />
          </Field>
          {mode === 'activate' && (
            <Field label="Activation code" hint="Codes are case-sensitive.">
              <Input
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
                placeholder="Given to you by your DM"
                required
              />
            </Field>
          )}
          <Field label={mode === 'login' ? 'Password' : 'Create password'}>
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          {mode === 'activate' && (
            <Field label="Confirm password">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </Field>
          )}
          {error && <div className="form-message form-message--error" role="alert">{error}</div>}
          {message && <div className="form-message form-message--success">{message}</div>}
          <Button type="submit" disabled={busy}>
            {mode === 'activate' && <UserPlus size={18} />}
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Activate account'}
          </Button>
          {mode === 'login' && (
            <p className="auth-help">Forgot your password? Ask your DM to reset your login, then use <strong>First-time setup</strong> with the new one-time code.</p>
          )}
        </form>
      </section>
    </div>
  )
}
