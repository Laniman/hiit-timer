export interface Plan {
  rounds: number
  workMs: number
  restMs: number
  prepareMs: number
}

export type RunPhase = 'prepare' | 'work' | 'rest' | 'done'

export interface ClockSession {
  phase: RunPhase
  round: number
  /** Absolute end of the current phase. Null once the workout is finished. */
  endTime: number | null
}

export type Cue = 'work' | 'rest' | 'done'

/** Remaining time from an absolute end timestamp. Never ticks down by itself. */
export function remainingUntil(endTime: number, now: number): number {
  return Math.max(0, endTime - now)
}

export function startSession(now: number, plan: Plan): ClockSession {
  if (plan.prepareMs > 0) {
    return { phase: 'prepare', round: 1, endTime: now + plan.prepareMs }
  }
  return { phase: 'work', round: 1, endTime: now + Math.max(1, plan.workMs) }
}

/**
 * Move to the next phase. The next `endTime` continues from the previous one,
 * so time spent with the tab frozen is not added on top of the interval.
 */
export function advanceSession(session: ClockSession, plan: Plan): ClockSession {
  if (session.phase === 'done' || session.endTime == null) return session

  const end = session.endTime
  const workMs = Math.max(1, plan.workMs)
  const restMs = Math.max(0, plan.restMs)

  if (session.phase === 'prepare') {
    return { phase: 'work', round: 1, endTime: end + workMs }
  }

  if (session.phase === 'work') {
    if (session.round >= plan.rounds) {
      return { phase: 'done', round: session.round, endTime: null }
    }
    if (restMs === 0) {
      return { phase: 'work', round: session.round + 1, endTime: end + workMs }
    }
    return { phase: 'rest', round: session.round, endTime: end + restMs }
  }

  if (session.round >= plan.rounds) {
    return { phase: 'done', round: session.round, endTime: null }
  }
  return { phase: 'work', round: session.round + 1, endTime: end + workMs }
}

export function catchUpSession(
  session: ClockSession,
  plan: Plan,
  now: number,
): { session: ClockSession; cues: Cue[] } {
  if (session.phase === 'done' || session.endTime == null || now < session.endTime) {
    return { session, cues: [] }
  }

  let current = session
  let steps = 0
  while (current.endTime != null && now >= current.endTime && steps < 1000) {
    const previousEnd = current.endTime
    current = advanceSession(current, plan)
    steps += 1
    if (current.phase === 'done') break
    if (current.endTime != null && current.endTime <= previousEnd) break
  }

  if (steps === 0) return { session, cues: [] }
  return { session: current, cues: cuesFor(current) }
}

export function phaseDurationMs(phase: Exclude<RunPhase, 'done'>, plan: Plan): number {
  if (phase === 'prepare') return plan.prepareMs
  if (phase === 'work') return plan.workMs
  return plan.restMs
}

export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes <= 0) return String(rest)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export function formatTotal(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const rest = totalSeconds % 60
  if (minutes <= 0) return `${rest}s`
  if (rest === 0) return `${minutes} min`
  return `${minutes} min ${rest}s`
}

function cuesFor(session: ClockSession): Cue[] {
  if (session.phase === 'done') return ['done']
  if (session.phase === 'work') return ['work']
  if (session.phase === 'rest') return ['rest']
  return []
}
