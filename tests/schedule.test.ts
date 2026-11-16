import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  advanceSession,
  catchUpSession,
  remainingUntil,
  startSession,
  type Plan,
} from '../src/schedule.ts'

const plan: Plan = {
  rounds: 3,
  workMs: 30_000,
  restMs: 10_000,
  prepareMs: 0,
}

describe('remainingUntil', () => {
  it('uses the absolute end timestamp', () => {
    assert.equal(remainingUntil(10_000, 4_000), 6_000)
    assert.equal(remainingUntil(10_000, 10_000), 0)
    assert.equal(remainingUntil(10_000, 12_000), 0)
  })
})

describe('advanceSession', () => {
  it('walks work, rest, and a final work without a trailing rest', () => {
    const started = startSession(0, plan)
    assert.deepEqual(started, { phase: 'work', round: 1, endTime: 30_000 })

    const rest = advanceSession(started, plan)
    assert.deepEqual(rest, { phase: 'rest', round: 1, endTime: 40_000 })

    const work2 = advanceSession(rest, plan)
    assert.deepEqual(work2, { phase: 'work', round: 2, endTime: 70_000 })

    const rest2 = advanceSession(work2, plan)
    const work3 = advanceSession(rest2, plan)
    assert.equal(work3.phase, 'work')
    assert.equal(work3.round, 3)
    assert.equal(advanceSession(work3, plan).phase, 'done')
  })

  it('skips rest when rest is zero', () => {
    const noRest: Plan = { ...plan, rounds: 2, restMs: 0, workMs: 1_000 }
    const first = startSession(0, noRest)
    const second = advanceSession(first, noRest)
    assert.deepEqual(second, { phase: 'work', round: 2, endTime: 2_000 })
    assert.equal(advanceSession(second, noRest).phase, 'done')
  })

  it('starts with prepare when asked', () => {
    const prepared: Plan = { ...plan, rounds: 1, prepareMs: 5_000, workMs: 1_000 }
    const ready = startSession(1_000, prepared)
    assert.deepEqual(ready, { phase: 'prepare', round: 1, endTime: 6_000 })
    const work = advanceSession(ready, prepared)
    assert.deepEqual(work, { phase: 'work', round: 1, endTime: 7_000 })
    assert.equal(advanceSession(work, prepared).phase, 'done')
  })
})

describe('catchUpSession', () => {
  it('does nothing before the phase ends', () => {
    const started = startSession(0, plan)
    const result = catchUpSession(started, plan, 29_999)
    assert.equal(result.cues.length, 0)
    assert.equal(result.session.endTime, 30_000)
  })

  it('lands inside a later phase using the original schedule', () => {
    const started = startSession(0, plan)
    const midRound2 = catchUpSession(started, plan, 50_000)
    assert.deepEqual(midRound2.session, { phase: 'work', round: 2, endTime: 70_000 })
    assert.deepEqual(midRound2.cues, ['work'])

    const duringRest = catchUpSession(started, plan, 35_000)
    assert.deepEqual(duringRest.session, { phase: 'rest', round: 1, endTime: 40_000 })
    assert.deepEqual(duringRest.cues, ['rest'])
  })

  it('collapses a long background gap into a single finish cue', () => {
    const started = startSession(0, plan)
    const finished = catchUpSession(started, plan, 200_000)
    assert.equal(finished.session.phase, 'done')
    assert.equal(finished.session.endTime, null)
    assert.deepEqual(finished.cues, ['done'])
  })

  it('keeps the pause contract: resume continues from the frozen remainder', () => {
    const endTime = 31_000
    const pausedAt = 20_000
    const held = remainingUntil(endTime, pausedAt)
    const resumedAt = 90_000
    assert.equal(held, 11_000)
    assert.equal(remainingUntil(resumedAt + held, resumedAt), held)
  })
})
