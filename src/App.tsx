import type { Session } from '@supabase/supabase-js'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/ui'
import { changePassword, loadProfile, signOut, updateTheme } from './lib/api'
import { friendlyError } from './lib/format'
import { clearCharacterSession } from './lib/characterSession'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { normalizeThemeKey, type ThemeKey } from './lib/themes'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import type { Profile, ToastMessage, ToastTone } from './types'

const PlayerDashboard = lazy(() => import('./pages/PlayerDashboard').then((module) => ({ default: module.PlayerDashboard })))
const DmDashboard = lazy(() => import('./pages/DmDashboard').then((module) => ({ default: module.DmDashboard })))

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [themeKey, setThemeKey] = useState<ThemeKey>('classic')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastId = useRef(0)

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500)
  }, [])

  const notifyError = useCallback((message: string) => notify(message, 'error'), [notify])
  const notifySuccess = useCallback((message: string) => notify(message, 'success'), [notify])

  const hydrate = useCallback(async (nextSession?: Session | null, showLoader = true) => {
    if (!supabase) return
    if (showLoader) setLoading(true)
    try {
      const resolvedSession = nextSession ?? (await supabase.auth.getSession()).data.session
      setSession(resolvedSession)
      setThemeKey(normalizeThemeKey(resolvedSession?.user.user_metadata?.theme_key))
      if (resolvedSession) {
        setProfile(await loadProfile(resolvedSession.user.id))
      } else {
        setProfile(null)
      }
    } catch (error) {
      notify(friendlyError(error), 'error')
      setProfile(null)
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    document.documentElement.dataset.theme = themeKey
  }, [themeKey])

  useEffect(() => {
    if (!supabase) return
    void hydrate()
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        setThemeKey(normalizeThemeKey(nextSession?.user.user_metadata?.theme_key))
        return
      }
      if (event === 'SIGNED_OUT') {
        clearCharacterSession()
        setSession(null)
        setProfile(null)
        setThemeKey('classic')
        return
      }
      window.setTimeout(() => void hydrate(nextSession, false), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [hydrate])

  if (!isSupabaseConfigured) return <SetupPage />
  if (loading) return <div className="full-page-loader"><LoadingState label="Opening the compendium…" /></div>
  if (!session || !profile) return <LoginPage onAuthenticated={() => void hydrate()} />

  const handleSignOut = async () => {
    try {
      await signOut()
      clearCharacterSession(profile.id)
      setSession(null)
      setProfile(null)
    } catch (error) {
      notify(friendlyError(error), 'error')
    }
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await changePassword(currentPassword, newPassword)
    notifySuccess('Your password has been changed.')
  }

  const handleThemeChange = async (nextTheme: ThemeKey) => {
    const previousTheme = themeKey
    setThemeKey(nextTheme)
    try {
      await updateTheme(nextTheme)
      notifySuccess('Your style has been saved.')
    } catch (error) {
      setThemeKey(previousTheme)
      throw error
    }
  }

  return (
    <>
      <AppShell
        profile={profile}
        themeKey={themeKey}
        onChangePassword={handleChangePassword}
        onThemeChange={handleThemeChange}
        onSignOut={() => void handleSignOut()}
      >
        <Suspense fallback={<LoadingState label="Opening your dashboard…" />}>
          {profile.role === 'dm' ? (
            <DmDashboard
              onError={notifyError}
              onSuccess={notifySuccess}
            />
          ) : (
            <PlayerDashboard
              profile={profile}
              onError={notifyError}
              onSuccess={notifySuccess}
            />
          )}
        </Suspense>
      </AppShell>
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 /> : toast.tone === 'error' ? <AlertCircle /> : <Info />}
            <span>{toast.message}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={17} /></button>
          </div>
        ))}
      </div>
    </>
  )
}

export default App
