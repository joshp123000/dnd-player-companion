import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const realtimeMocks = vi.hoisted(() => {
  const changeCallbacks: Array<() => void> = []
  const statusCallbacks: Array<(status: string) => void> = []
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
      changeCallbacks.push(callback)
      return channel
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      statusCallbacks.push(callback)
      return channel
    }),
  }
  return {
    changeCallbacks,
    statusCallbacks,
    channel,
    channelFactory: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('./supabase', () => ({
  supabase: {
    channel: realtimeMocks.channelFactory,
    removeChannel: realtimeMocks.removeChannel,
  },
}))

import { useRealtimeRefresh } from './realtime'

function RealtimeHarness({ paused, onRefresh }: { paused: boolean; onRefresh: () => Promise<void> }) {
  const { refreshPending } = useRealtimeRefresh({
    channelName: 'test-channel',
    onRefresh,
    paused,
  })
  return <span>{refreshPending ? 'waiting' : 'ready'}</span>
}

beforeEach(() => {
  vi.useFakeTimers()
  realtimeMocks.changeCallbacks.length = 0
  realtimeMocks.statusCallbacks.length = 0
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useRealtimeRefresh', () => {
  it('coalesces a burst of database events into one background refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<RealtimeHarness paused={false} onRefresh={onRefresh} />)

    act(() => {
      realtimeMocks.changeCallbacks[0]?.()
      realtimeMocks.changeCallbacks[2]?.()
      vi.advanceTimersByTime(449)
    })
    expect(onRefresh).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('waits while local edits are unsaved, then catches up automatically', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const view = render(<RealtimeHarness paused onRefresh={onRefresh} />)

    await act(async () => {
      realtimeMocks.changeCallbacks[0]?.()
      vi.advanceTimersByTime(450)
      await Promise.resolve()
    })
    expect(onRefresh).not.toHaveBeenCalled()
    expect(screen.getByText('waiting')).toBeInTheDocument()

    view.rerender(<RealtimeHarness paused={false} onRefresh={onRefresh} />)
    await act(async () => {
      vi.advanceTimersByTime(450)
      await Promise.resolve()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('ready')).toBeInTheDocument()
  })
})
