import { BookOpenText, LogOut, Shield, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Profile } from '../types'
import { Button } from './ui'

export function AppShell({
  profile,
  onSignOut,
  children,
}: {
  profile: Profile
  onSignOut: () => void
  children: ReactNode
}) {
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
          <Button variant="ghost" onClick={onSignOut}>
            <LogOut size={17} />
            <span className="hide-small">Sign out</span>
          </Button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
