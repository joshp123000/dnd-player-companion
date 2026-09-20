import { BookOpenText, KeyRound, LogOut, Shield, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Profile } from '../types'
import { AccountSettingsForm } from './AccountSettingsForm'
import { Button, Modal } from './ui'

export function AppShell({
  profile,
  onChangePassword,
  onSignOut,
  children,
}: {
  profile: Profile
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onSignOut: () => void
  children: ReactNode
}) {
  const [accountOpen, setAccountOpen] = useState(false)

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
            <KeyRound size={17} />
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
          title="Change your password"
          description="Your username stays the same. Enter your current password before choosing a new one."
          onClose={() => setAccountOpen(false)}
        >
          <AccountSettingsForm
            onSubmit={onChangePassword}
            onCancel={() => setAccountOpen(false)}
          />
        </Modal>
      )}
    </div>
  )
}
