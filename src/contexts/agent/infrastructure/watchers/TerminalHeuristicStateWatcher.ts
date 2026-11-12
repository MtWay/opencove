import type { TerminalSessionState } from '../../../../shared/contracts/dto'

interface TerminalHeuristicStateWatcherOptions {
  sessionId: string
  onState: (sessionId: string, state: TerminalSessionState) => void
  onError?: (error: unknown) => void
}

// Output-based turn-state heuristic for CLIs without a session file / API.
// A submit keystroke marks the turn "working"; once output stops flowing for
// QUIET_MS the turn is considered finished and we fall back to "standby".
const TERMINAL_HEURISTIC_QUIET_MS = 800

export class TerminalHeuristicStateWatcher {
  private readonly sessionId: string
  private readonly onState: (sessionId: string, state: TerminalSessionState) => void

  private disposed = false
  private lastState: TerminalSessionState | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private turnActive = false

  public constructor(options: TerminalHeuristicStateWatcherOptions) {
    this.sessionId = options.sessionId
    this.onState = options.onState
  }

  public start(): void {
    // No file/API to poll; state is driven entirely by noteInteraction/noteOutput.
  }

  public dispose(): void {
    this.disposed = true
    this.clearIdleTimer()
  }

  public noteInteraction(data?: string): void {
    if (this.disposed) {
      return
    }

    if (typeof data === 'string' && /[\r\n]/.test(data)) {
      this.turnActive = true
      this.emitState('working')
      this.armIdleTimer()
    }
  }

  public noteOutput(data: string): void {
    if (this.disposed || data.length === 0) {
      return
    }

    // Output only sustains an in-progress turn; it must not start one. Startup
    // banners and idle prompt redraws arrive before any submit, so treating raw
    // output as "working" would flip the session to busy the moment it launches.
    if (!this.turnActive) {
      return
    }

    this.emitState('working')
    this.armIdleTimer()
  }

  private emitState(state: TerminalSessionState): void {
    if (state === this.lastState) {
      return
    }

    this.lastState = state
    this.onState(this.sessionId, state)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private armIdleTimer(): void {
    this.clearIdleTimer()

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      this.turnActive = false
      this.emitState('standby')
    }, TERMINAL_HEURISTIC_QUIET_MS)
    this.idleTimer.unref?.()
  }
}
