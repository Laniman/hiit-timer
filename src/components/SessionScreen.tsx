import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { formatClock, phaseDurationMs, type Plan, type RunPhase } from '../schedule.ts'
import {
  pause,
  remainingTime,
  reset,
  resume,
  skip,
  start,
  timer,
  type TimerPhase,
} from '../model.ts'
import styles from './SessionScreen.module.css'

const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function durationOf(phase: TimerPhase, plan: Plan | null): number {
  if (!plan || !isRunPhase(phase)) return 0
  return phaseDurationMs(phase, plan)
}

function isRunPhase(phase: TimerPhase): phase is Exclude<RunPhase, 'done'> {
  return phase === 'prepare' || phase === 'work' || phase === 'rest'
}

export const SessionScreen = reatomComponent(() => {
  const state = timer()
  const remaining = remainingTime()
  const duration = durationOf(state.phase, state.plan)
  const progress = state.status === 'done' || duration <= 0
    ? 1
    : Math.min(1, Math.max(0, 1 - remaining / duration))
  const tone = state.phase === 'rest' ? styles.rest : state.phase === 'prepare' ? styles.prepare : styles.work
  const label = state.phase === 'prepare'
    ? 'Get ready'
    : state.phase === 'rest'
      ? 'Rest'
      : state.phase === 'done'
        ? 'Done'
        : 'Work'
  const totalRounds = state.plan?.rounds ?? 0
  const activeDot = state.phase === 'prepare' ? -1 : state.round - 1

  return (
    <section className={styles.session} aria-label="Workout">
      <p className={styles.live} aria-live="polite">
        {label}
        {state.status === 'done' ? '' : `, round ${state.round} of ${totalRounds}`}
      </p>
      {state.status !== 'done' && <p className={`${styles.phase} ${tone}`}>{label}</p>}
      <div
        className={styles.ring}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.max(duration, 0)}
        aria-valuenow={Math.max(0, Math.round(duration - remaining))}
        aria-label={label}
      >
        <svg viewBox="0 0 100 100" className={styles.svg}>
          <circle className={styles.track} cx="50" cy="50" r={RADIUS} />
          {progress > 0.001 && (
            <circle
              className={`${styles.bar} ${tone}`}
              cx="50"
              cy="50"
              r={RADIUS}
              transform="rotate(-90 50 50)"
              style={{
                strokeDasharray: CIRCUMFERENCE,
                strokeDashoffset: CIRCUMFERENCE * (1 - progress),
              }}
            />
          )}
        </svg>
        {state.status === 'done' ? (
          <p className={styles.done}>Done</p>
        ) : (
          <p className={styles.time}>{formatClock(remaining)}</p>
        )}
      </div>
      {state.status === 'done' ? (
        <p className={styles.meta}>
          {state.plan ? `${state.plan.rounds} rounds · ${state.plan.workMs / 1000}s / ${state.plan.restMs / 1000}s` : 'Workout complete'}
        </p>
      ) : (
        <>
          <p className={styles.meta}>Round {state.round} / {totalRounds}</p>
          <div className={styles.dots} aria-hidden="true">
            {Array.from({ length: totalRounds }, (_, index) => (
              <span
                key={index}
                className={
                  index < activeDot
                    ? `${styles.dot} ${styles.dotDone}`
                    : index === activeDot
                      ? `${styles.dot} ${styles.dotNow} ${tone}`
                      : styles.dot
                }
              />
            ))}
          </div>
        </>
      )}
      <div className={styles.actions}>
        {state.status === 'done' ? (
          <button type="button" className={styles.primary} onClick={wrap(start)}>
            Start again
          </button>
        ) : state.status === 'paused' ? (
          <button type="button" className={styles.primary} onClick={wrap(resume)}>
            Resume
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={wrap(pause)}>
            Pause
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={wrap(reset)}>
          {state.status === 'done' ? 'Edit' : 'Reset'}
        </button>
        {state.status !== 'done' && (
          <button type="button" className={styles.skip} onClick={wrap(skip)}>
            Skip
          </button>
        )}
      </div>
    </section>
  )
}, 'SessionScreen')
