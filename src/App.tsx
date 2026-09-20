import type { Session } from '@supabase/supabase-js'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/ui'
import { loadProfile, signOut } from './lib/api'
import { friendlyError } from './lib/format'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import type { Profile, ToastMessage, ToastTone } from './types'

const PlayerDashboard = lazy(() => import('./pages/PlayerDashboard').then((module) => ({ default: module.PlayerDashboard })))
const DmDashboard = lazy(() => import('./pages/DmDashboard').then((module) => ({ default: module.DmDashboard })))

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
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
      if (resolvedSession) setProfile(await loadProfile(resolvedSession.user.id))
      else setProfile(null)
    } catch (error) {
      notify(friendlyError(error), 'error')
      setProfile(null)
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    if (!supabase) return
    void hydrate()
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
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
      setSession(null)
      setProfile(null)
    } catch (error) {
      notify(friendlyError(error), 'error')
    }
  }

  return (
    <>
      <AppShell profile={profile} onSignOut={() => void handleSignOut()}>
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
