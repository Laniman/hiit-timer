import type { ChangeEvent, ReactNode } from 'react'
import { wrap } from '@reatom/core'
import styles from './controls.module.css'
import { MinusIcon, PlusIcon } from './icons.tsx'

type RangeFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onValue: (value: number) => void
}

type SwitchFieldProps = {
  label: string
  checked: boolean
  icon: ReactNode
  onToggle: () => void
}

export function RangeField({ label, value, min, max, step, onValue }: RangeFieldProps) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
  const change = (next: number) => {
    onValue(next)
  }

  return (
    <section className={styles.card}>
      <p className={styles.caption}>{label}</p>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={wrap(() => {
            change(value - step)
          })}
        >
          <MinusIcon />
        </button>
        <p className={styles.value}>{value}</p>
        <button
          type="button"
          className={styles.step}
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={wrap(() => {
            change(value + step)
          })}
        >
          <PlusIcon />
        </button>
      </div>
      <input
        className={styles.range}
        style={{ ['--pct' as string]: `${percent}%` }}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onChange={wrap((event: ChangeEvent<HTMLInputElement>) => {
          change(Number(event.currentTarget.value))
        })}
      />
    </section>
  )
}

export function SwitchField({ label, checked, icon, onToggle }: SwitchFieldProps) {
  return (
    <button
      type="button"
      className={styles.switchRow}
      role="switch"
      aria-checked={checked}
      onClick={wrap(onToggle)}
    >
      <span className={styles.switchLabel}>
        {icon}
        {label}
      </span>
      <span className={checked ? styles.switchOn : styles.switchOff}>
        <span className={styles.knob} />
      </span>
    </button>
  )
}
