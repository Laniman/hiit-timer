import {
  action,
  addChangeHook,
  atom,
  computed,
  effect,
  withConnectHook,
} from '@reatom/core'
import { playPattern, resumeAudio, unlockAudio } from './audio.ts'
import {
  catchUpSession,
  formatClock,
  remainingUntil,
  startSession,
  type ClockSession,
  type Cue,
  type Plan,
  type RunPhase,
} from './schedule.ts'
import { acquireWakeLock, releaseWakeLock } from './wakeLock.ts'

const STORAGE_KEY = 'hiit-timer.settings'
const PREPARE_MS = 5_000

export const LIMITS = {
  work: { min: 5, max: 180, step: 5 },
  rest: { min: 0, max: 180, step: 5 },
  rounds: { min: 1, max: 50, step: 1 },
} as const

type Limit = (typeof LIMITS)[keyof typeof LIMITS]

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done'
export type TimerPhase = 'idle' | RunPhase

export interface TimerState {
  status: TimerStatus
  phase: TimerPhase
  round: number
  /** Timestamp when the current phase ends. Null while idle, paused, or done. */
  endTime: number | null
  /** Milliseconds frozen at pause. Live running time is not stored here. */
  remainingTime: number
  plan: Plan | null
}

interface StoredSettings {
  workSeconds: number
  restSeconds: number
  rounds: number
  sound: boolean
  initialDelay: boolean
}

const stored = readSettings()

export const workSeconds = atom(
  storedNumber(stored.workSeconds, LIMITS.work, 30),
  'workSeconds',
)
export const restSeconds = atom(
  storedNumber(stored.restSeconds, LIMITS.rest, 30),
  'restSeconds',
)
export const rounds = atom(storedNumber(stored.rounds, LIMITS.rounds, 10), 'rounds')
export const sound = atom(storedBoolean(stored.sound, false), 'sound')
export const initialDelay = atom(storedBoolean(stored.initialDelay, false), 'initialDelay')

const idleTimer: TimerState = {
  status: 'idle',
  phase: 'idle',
  round: 1,
  endTime: null,
  remainingTime: 0,
  plan: null,
}

export const timer = atom<TimerState>(idleTimer, 'timer')

/** Clock subscription. The displayed value still comes from `Date.now()`. */
const now = atom(Date.now(), 'now')

export const endTime = computed(() => timer().endTime, 'endTime')

export const remainingTime = computed(() => {
  const state = timer()
  const endsAt = endTime()
  if (state.status === 'running' && endsAt != null) {
    now()
    return remainingUntil(endsAt, Date.now())
  }
  return state.remainingTime
}, 'remainingTime')

export const totalSeconds = computed(() => {
  const restGaps = Math.max(0, rounds() - 1)
  const prepare = initialDelay() ? PREPARE_MS / 1000 : 0
  return workSeconds() * rounds() + restSeconds() * restGaps + prepare
}, 'totalSeconds')

export const setWorkSeconds = action((value: number) => {
  workSeconds.set(snap(value, LIMITS.work))
}, 'setWorkSeconds')

export const setRestSeconds = action((value: number) => {
  restSeconds.set(snap(value, LIMITS.rest))
}, 'setRestSeconds')

export const setRounds = action((value: number) => {
  rounds.set(snap(value, LIMITS.rounds))
}, 'setRounds')

export const toggleSound = action(() => {
  sound.set((enabled) => !enabled)
}, 'toggleSound')

export const toggleInitialDelay = action(() => {
  initialDelay.set((enabled) => !enabled)
}, 'toggleInitialDelay')

export const start = action(() => {
  const state = timer()
  if (state.status === 'running' || state.status === 'paused') return
  unlockAudio()
  const plan: Plan = {
    rounds: rounds(),
    workMs: workSeconds() * 1000,
    restMs: restSeconds() * 1000,
    prepareMs: initialDelay() ? PREPARE_MS : 0,
  }
  const session = startSession(Date.now(), plan)
  timer.set({
    status: 'running',
    phase: session.phase,
    round: session.round,
    endTime: session.endTime,
    remainingTime: session.endTime == null ? 0 : remainingUntil(session.endTime, Date.now()),
    plan,
  })
  if (sound()) void playPattern('start')
  void acquireWakeLock()
  syncDocumentTitle()
}, 'timer.start')

export const pause = action(() => {
  const state = timer()
  if (state.status !== 'running' || state.endTime == null) return
  timer.set({
    ...state,
    status: 'paused',
    endTime: null,
    remainingTime: remainingUntil(state.endTime, Date.now()),
  })
  void releaseWakeLock()
  syncDocumentTitle()
}, 'timer.pause')

export const resume = action(() => {
  const state = timer()
  if (state.status !== 'paused') return
  unlockAudio()
  const end = Date.now() + state.remainingTime
  timer.set({
    ...state,
    status: 'running',
    endTime: end,
  })
  void acquireWakeLock()
  syncDocumentTitle()
}, 'timer.resume')

export const reset = action(() => {
  timer.set(idleTimer)
  void releaseWakeLock()
  syncDocumentTitle()
}, 'timer.reset')

export const skip = action(() => {
  const state = timer()
  if (state.plan == null || state.phase === 'idle' || state.phase === 'done') return
  if (state.status !== 'running' && state.status !== 'paused') return
  unlockAudio()
  const nowMs = Date.now()
  commit(state, catchUpSession(
    { phase: state.phase, round: state.round, endTime: nowMs },
    state.plan,
    nowMs,
  ))
}, 'timer.skip')

export const onVisibilityChange = action(() => {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
  catchUp()
  now.set(Date.now())
  syncDocumentTitle()
  if (timer().status === 'running') {
    void resumeAudio()
    void acquireWakeLock()
  }
}, 'timer.onVisibilityChange')

export const appLifecycle = atom(0, 'appLifecycle').extend(
  withConnectHook(() => {
    let frame = 0
    let lastPaint = 0

    const stop = () => {
      if (!frame) return
      cancelAnimationFrame(frame)
      frame = 0
    }

    const ensure = () => {
      if (timer().status === 'running') {
        if (!frame) frame = requestAnimationFrame(loop)
        return
      }
      stop()
    }

    const loop = (time: number) => {
      frame = 0
      const changed = catchUp()
      if (changed || time - lastPaint >= 100) {
        lastPaint = time
        now.set(Date.now())
        syncDocumentTitle()
      }
      ensure()
    }

    ensure()
    const unhook = addChangeHook(timer, ensure)
    const onVisible = () => {
      onVisibilityChange()
    }
    const onKey = (event: KeyboardEvent) => {
      onKeyDown(event)
    }
    const onPageHide = () => {
      void releaseWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      unhook()
      stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pagehide', onPageHide)
      void releaseWakeLock()
    }
  }),
)

effect(() => {
  const payload: StoredSettings = {
    workSeconds: workSeconds(),
    restSeconds: restSeconds(),
    rounds: rounds(),
    sound: sound(),
    initialDelay: initialDelay(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Private mode and blocked storage still leave the timer usable.
  }
}, 'persistSettings')

function catchUp(): boolean {
  const state = timer()
  if (state.status !== 'running' || state.endTime == null || state.plan == null) return false
  if (state.phase !== 'prepare' && state.phase !== 'work' && state.phase !== 'rest') return false
  if (Date.now() < state.endTime) return false
  commit(
    state,
    catchUpSession(
      { phase: state.phase, round: state.round, endTime: state.endTime },
      state.plan,
      Date.now(),
    ),
  )
  return true
}

function commit(
  state: TimerState,
  result: { session: ClockSession; cues: Cue[] },
): void {
  const done = result.session.phase === 'done'
  const end = result.session.endTime
  const nowMs = Date.now()
  timer.set({
    ...state,
    status: done ? 'done' : 'running',
    phase: done ? 'done' : result.session.phase,
    round: result.session.round,
    endTime: done ? null : end,
    remainingTime: done || end == null ? 0 : remainingUntil(end, nowMs),
  })
  if (done) void releaseWakeLock()
  else void acquireWakeLock()
  playCues(result.cues)
  syncDocumentTitle()
}

function playCues(cues: Cue[]): void {
  if (!sound() || cues.length === 0) return
  if (cues.includes('done')) {
    void playPattern('done')
    return
  }
  if (cues.includes('work')) void playPattern('work')
  else if (cues.includes('rest')) void playPattern('rest')
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('button, input, textarea, a, select')) return
  if (event.code === 'Space') {
    event.preventDefault()
    const status = timer().status
    if (status === 'idle' || status === 'done') start()
    else if (status === 'running') pause()
    else resume()
    return
  }
  if (event.code === 'KeyR') reset()
  if (event.code === 'KeyS') skip()
}

let lastTitle = ''

function syncDocumentTitle(): void {
  if (typeof document === 'undefined') return
  const state = timer()
  let title = 'Simple HIIT Timer'
  if (state.status === 'done') title = 'Done · HIIT Timer'
  else if (state.status === 'running' || state.status === 'paused') {
    const remaining = state.status === 'paused' || state.endTime == null
      ? state.remainingTime
      : remainingUntil(state.endTime, Date.now())
    const label = state.phase === 'prepare'
      ? 'Get ready'
      : state.phase === 'rest'
        ? 'Rest'
        : 'Work'
    title = `${formatClock(remaining)} ${label}`
  }
  if (title === lastTitle) return
  lastTitle = title
  document.title = title
}

export function snap(value: number, limit: Limit): number {
  if (!Number.isFinite(value)) return limit.min
  const steps = Math.round((value - limit.min) / limit.step)
  const snapped = limit.min + steps * limit.step
  return Math.min(limit.max, Math.max(limit.min, snapped))
}

function readSettings(): Partial<StoredSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Partial<StoredSettings>
  } catch {
    return {}
  }
}

function storedNumber(value: unknown, limit: Limit, fallback: number): number {
  return typeof value === 'number' ? snap(value, limit) : fallback
}

function storedBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
