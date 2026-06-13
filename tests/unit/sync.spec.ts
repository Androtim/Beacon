import { test, expect } from '@playwright/test'
import {
  targetPosition, offsetSample, combineOffsets, decideCorrection,
  SOFT_SYNC_THRESHOLD, HARD_SYNC_THRESHOLD,
} from '../../shared/sync'

// Pure-function tests for the sync engine math. No browser involved.

test.describe('targetPosition', () => {
  test('advances by elapsed server time while playing', () => {
    const state = { url: 'x', isPlaying: true, position: 10, atServerTime: 1_000_000 }
    expect(targetPosition(state, 1_005_000)).toBeCloseTo(15)
  })

  test('frozen while paused', () => {
    const state = { url: 'x', isPlaying: false, position: 42, atServerTime: 1_000_000 }
    expect(targetPosition(state, 9_999_999)).toBe(42)
  })

  test('never goes backwards from clock skew', () => {
    const state = { url: 'x', isPlaying: true, position: 10, atServerTime: 1_000_000 }
    expect(targetPosition(state, 999_000)).toBe(10)
  })
})

test.describe('clock offset estimation', () => {
  test('offsetSample uses the RTT midpoint', () => {
    // sent at 1000, received at 1200 (RTT 200) -> midpoint 1100; server said 5000
    expect(offsetSample(1000, 5000, 1200)).toBe(3900)
  })

  test('combineOffsets takes the median (robust to one bad sample)', () => {
    expect(combineOffsets([100, 102, 98, 5000, 101])).toBe(101)
    expect(combineOffsets([10, 20])).toBe(15)
    expect(combineOffsets([])).toBe(0)
  })
})

test.describe('decideCorrection', () => {
  test('settles to normal rate when within tolerance', () => {
    expect(decideCorrection(10.1, 10.0, true)).toEqual({ type: 'rate', rate: 1 })
  })

  test('nudges slower when ahead, faster when behind', () => {
    const ahead = decideCorrection(11.0, 10.0, true)
    expect(ahead.type).toBe('rate')
    expect((ahead as any).rate).toBeLessThan(1)

    const behind = decideCorrection(9.0, 10.0, true)
    expect(behind.type).toBe('rate')
    expect((behind as any).rate).toBeGreaterThan(1)
  })

  test('hard-seeks beyond the hard threshold', () => {
    const c = decideCorrection(10 + HARD_SYNC_THRESHOLD + 1, 10, true)
    expect(c).toEqual({ type: 'seek', to: 10 })
  })

  test('paused players seek instead of rate games', () => {
    expect(decideCorrection(10, 10.1, false)).toEqual({ type: 'none' })
    expect(decideCorrection(15, 10, false)).toEqual({ type: 'seek', to: 10 })
  })

  test('respects coarse allowed rates (YouTube)', () => {
    const yt = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
    const behind = decideCorrection(9.0, 10.0, true, yt)
    expect(behind).toEqual({ type: 'rate', rate: 1.25 })
    const ahead = decideCorrection(11.0, 10.0, true, yt)
    expect(ahead).toEqual({ type: 'rate', rate: 0.75 })
  })

  test('boundary: exactly at soft threshold stays gentle', () => {
    const c = decideCorrection(10 + SOFT_SYNC_THRESHOLD, 10, true)
    expect(c.type).toBe('rate')
  })
})
