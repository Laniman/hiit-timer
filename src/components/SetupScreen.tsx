import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { formatTotal } from '../schedule.ts'
import {
  initialDelay,
  LIMITS,
  restSeconds,
  rounds,
  setRestSeconds,
  setRounds,
  setWorkSeconds,
  sound,
  start,
  toggleInitialDelay,
  toggleSound,
  totalSeconds,
  workSeconds,
} from '../model.ts'
import { RangeField, SwitchField } from './controls.tsx'
import { ClockIcon, SpeakerIcon } from './icons.tsx'
import styles from './SetupScreen.module.css'

export const SetupScreen = reatomComponent(() => {
  const total = totalSeconds()
  const delay = initialDelay()

  return (
    <div className={styles.setup}>
      <RangeField
        label="Work"
        value={workSeconds()}
        min={LIMITS.work.min}
        max={LIMITS.work.max}
        step={LIMITS.work.step}
        onValue={setWorkSeconds}
      />
      <RangeField
        label="Rest"
        value={restSeconds()}
        min={LIMITS.rest.min}
        max={LIMITS.rest.max}
        step={LIMITS.rest.step}
        onValue={setRestSeconds}
      />
      <RangeField
        label="Rounds"
        value={rounds()}
        min={LIMITS.rounds.min}
        max={LIMITS.rounds.max}
        step={LIMITS.rounds.step}
        onValue={setRounds}
      />
      <fieldset className={styles.options}>
        <legend className={styles.srOnly}>Options</legend>
        <SwitchField
          label="Sound"
          checked={sound()}
          icon={<SpeakerIcon />}
          onToggle={toggleSound}
        />
        <SwitchField
          label="Initial delay (5s)"
          checked={delay}
          icon={<ClockIcon />}
          onToggle={toggleInitialDelay}
        />
      </fieldset>
      <p className={styles.summary}>
        {rounds()} rounds · {formatTotal(total)}
        {delay ? ' · 5s start' : ''}
      </p>
      <button type="button" className={styles.start} onClick={wrap(start)}>
        Start
      </button>
    </div>
  )
}, 'SetupScreen')
