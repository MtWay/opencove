import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminalSessionState } from '../../../src/shared/contracts/dto'
import { TerminalHeuristicStateWatcher } from '../../../src/contexts/agent/infrastructure/watchers/TerminalHeuristicStateWatcher'

const QUIET_MS = 800

function createWatcher() {
  const states: TerminalSessionState[] = []
  const watcher = new TerminalHeuristicStateWatcher({
    sessionId: 'session-1',
    onState: (_sessionId, state) => {
      states.push(state)
    },
  })
  watcher.start()
  return { watcher, states }
}

describe('TerminalHeuristicStateWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not mark the session working from startup output before any submit', () => {
    const { watcher, states } = createWatcher()

    watcher.noteOutput('Welcome to Custom CLI\r\n> ')
    vi.advanceTimersByTime(QUIET_MS * 2)

    expect(states).toEqual([])
  })

  it('marks working on submit, sustains via output, then falls back to standby', () => {
    const { watcher, states } = createWatcher()

    watcher.noteInteraction('\r')
    expect(states).toEqual(['working'])

    vi.advanceTimersByTime(QUIET_MS - 100)
    watcher.noteOutput('thinking...')
    vi.advanceTimersByTime(QUIET_MS - 100)
    // Still within a sustained turn, no standby yet.
    expect(states).toEqual(['working'])

    vi.advanceTimersByTime(QUIET_MS)
    expect(states).toEqual(['working', 'standby'])
  })

  it('ignores output again once a turn has completed', () => {
    const { watcher, states } = createWatcher()

    watcher.noteInteraction('\n')
    vi.advanceTimersByTime(QUIET_MS)
    expect(states).toEqual(['working', 'standby'])

    // Idle prompt redraw after the turn ends must not re-trigger working.
    watcher.noteOutput('[2K> ')
    vi.advanceTimersByTime(QUIET_MS * 2)
    expect(states).toEqual(['working', 'standby'])
  })

  it('does not start a turn from plain keystrokes without a newline', () => {
    const { watcher, states } = createWatcher()

    watcher.noteInteraction('h')
    watcher.noteOutput('h')
    vi.advanceTimersByTime(QUIET_MS * 2)

    expect(states).toEqual([])
  })
})
