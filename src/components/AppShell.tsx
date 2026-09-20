import { BookOpenText, KeyRound, LogOut, Palette, Settings2, Shield, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { friendlyError } from '../lib/format'
import { THEME_OPTIONS, type ThemeKey } from '../lib/themes'
import type { Profile } from '../types'
import { AccountSettingsForm } from './AccountSettingsForm'
import { Button, Field, Modal, Select } from './ui'

export function AppShell({
  profile,
  themeKey,
  onChangePassword,
  onThemeChange,
  onSignOut,
  children,
}: {
  profile: Profile
  themeKey: ThemeKey
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onThemeChange: (themeKey: ThemeKey) => Promise<void>
  onSignOut: () => void
  children: ReactNode
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [themeBusy, setThemeBusy] = useState(false)
  const [themeError, setThemeError] = useState('')
  const selectedTheme = THEME_OPTIONS.find((theme) => theme.value === themeKey) ?? THEME_OPTIONS[0]

  const changeTheme = async (nextTheme: ThemeKey) => {
    setThemeBusy(true)
    setThemeError('')
    try {
      await onThemeChange(nextTheme)
    } catch (error) {
      setThemeError(friendlyError(error))
    } finally {
      setThemeBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-lockup__mark"><BookOpenText size={22} /></span>
          <div>
            <strong>Campaign Compendium</strong>
            <span>Player cards, without the page flipping</span>
          </div>
        </div>
        <div className="topbar__account">
          <span className="account-pill">
            {profile.role === 'dm' ? <Shield size={16} /> : <UserRound size={16} />}
            <span>{profile.display_name}</span>
          </span>
          <Button variant="ghost" onClick={() => setAccountOpen(true)}>
            <Settings2 size={17} />
            <span className="hide-small">Account</span>
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            <LogOut size={17} />
            <span className="hide-small">Sign out</span>
          </Button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      {accountOpen && (
        <Modal
          title="Account settings"
          description="Choose your compendium style or update your password."
          onClose={() => setAccountOpen(false)}
        >
          <div className="account-settings">
            <section className="account-settings__section" aria-labelledby="appearance-heading">
              <h3 id="appearance-heading"><Palette size={18} /> Appearance</h3>
              <Field label="Compendium style" hint={selectedTheme.description}>
                <Select
                  value={themeKey}
                  disabled={themeBusy}
                  onChange={(event) => void changeTheme(event.target.value as ThemeKey)}
                >
                  {THEME_OPTIONS.map((theme) => (
                    <option value={theme.value} key={theme.value}>{theme.label}</option>
                  ))}
                </Select>
              </Field>
              {themeError && <div className="form-message form-message--error" role="alert">{themeError}</div>}
              {themeBusy && <span className="account-settings__saving">Saving style…</span>}
            </section>
            <section className="account-settings__section" aria-labelledby="password-heading">
              <h3 id="password-heading"><KeyRound size={18} /> Change password</h3>
              <AccountSettingsForm
                onSubmit={onChangePassword}
                onCancel={() => setAccountOpen(false)}
              />
            </section>
          </div>
        </Modal>
      )}
    </div>
  )
}
