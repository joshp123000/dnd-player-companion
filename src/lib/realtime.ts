import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export const REALTIME_TABLES = [
  'campaigns',
  'characters',
  'character_classes',
  'character_spells',
  'character_abilities',
  'spells',
  'abilities',
  'class_progression',
] as const

interface RealtimeRefreshOptions {
  channelName: string
  onRefresh: () => Promise<void> | void
  paused?: boolean
  debounceMs?: number
  tables?: readonly string[]
}

/**
 * Coalesces database-change bursts into quiet background refreshes.
 * A paused refresh is remembered and runs automatically when local edits are safe.
 */
export const useRealtimeRefresh = ({
  channelName,
  onRefresh,
  paused = false,
  debounceMs = 450,
  tables = REALTIME_TABLES,
}: RealtimeRefreshOptions) => {
  const [refreshPending, setRefreshPending] = useState(false)
  const refreshRef = useRef(onRefresh)
  const pausedRef = useRef(paused)
  const scheduleRef = useRef<() => void>(() => undefined)

  refreshRef.current = onRefresh
  pausedRef.current = paused

  useEffect(() => {
    if (paused || !refreshPending) return
    setRefreshPending(false)
    scheduleRef.current()
  }, [paused, refreshPending])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let disposed = false
    let timer: number | undefined
    let refreshRunning = false
    let refreshQueued = false
    let hasSubscribed = false

    const schedule = () => {
      if (disposed) return
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = undefined
        void runRefresh()
      }, debounceMs)
    }

    const runRefresh = async () => {
      if (disposed) return
      if (pausedRef.current) {
        setRefreshPending(true)
        return
      }
      if (refreshRunning) {
        refreshQueued = true
        return
      }

      refreshRunning = true
      setRefreshPending(false)
      try {
        await refreshRef.current()
      } finally {
        refreshRunning = false
        if (refreshQueued && !disposed) {
          refreshQueued = false
          schedule()
        }
      }
    }

    scheduleRef.current = schedule

    let channel = client.channel(channelName)
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        schedule,
      )
    }

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (hasSubscribed) schedule()
      hasSubscribed = true
    })

    const catchUpWhenVisible = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    window.addEventListener('online', schedule)
    document.addEventListener('visibilitychange', catchUpWhenVisible)

    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      scheduleRef.current = () => undefined
      window.removeEventListener('online', schedule)
      document.removeEventListener('visibilitychange', catchUpWhenVisible)
      void client.removeChannel(channel)
    }
  }, [channelName, debounceMs, tables])

  return { refreshPending }
}
