// Pure sync-engine math, shared by client and tests.
//
// The server is the single source of truth for playback: it stores
// { url, isPlaying, position, atServerTime } and broadcasts it on every
// change. Each client knows its clock offset to the server and continuously
// steers its local player toward where the video *should* be right now.

export interface PlaybackState {
  url: string | null
  isPlaying: boolean
  /** Playback position in seconds at the moment the server recorded it. */
  position: number
  /** Server wall-clock ms when `position` was recorded. */
  atServerTime: number
}

/** Where the video should be right now, given the server's time. */
export function targetPosition(state: PlaybackState, serverNowMs: number): number {
  if (!state.isPlaying) return state.position
  return state.position + Math.max(0, serverNowMs - state.atServerTime) / 1000
}

/** Estimate clock offset from one ping: offset = serverNow - (localMidpoint). */
export function offsetSample(localSentMs: number, serverNowMs: number, localReceivedMs: number): number {
  const midpoint = localSentMs + (localReceivedMs - localSentMs) / 2
  return serverNowMs - midpoint
}

/** Robust combination of repeated offset samples. */
export function combineOffsets(samples: number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export type Correction =
  | { type: 'none' }
  | { type: 'rate'; rate: number }
  | { type: 'seek'; to: number }

// Tolerances (seconds). Under SOFT_SYNC we leave the player alone; between
// SOFT_SYNC and HARD_SYNC we nudge playback rate (invisible to the viewer);
// beyond HARD_SYNC we hard-seek.
export const SOFT_SYNC_THRESHOLD = 0.3
export const HARD_SYNC_THRESHOLD = 2.0
const NUDGE = 0.08 // ±8% rate is imperceptible for a few seconds

/**
 * Decide how to steer the local player toward the target.
 * `drift` = localPosition - target (positive = we are ahead).
 * `allowedRates` restricts nudge rates for players with coarse rate support
 * (YouTube only allows 0.25-step rates).
 */
export function decideCorrection(
  localPosition: number,
  target: number,
  isPlaying: boolean,
  allowedRates?: number[],
): Correction {
  const drift = localPosition - target
  const abs = Math.abs(drift)

  if (!isPlaying) {
    // Paused: position should match exactly-ish; no rate games possible.
    return abs > SOFT_SYNC_THRESHOLD ? { type: 'seek', to: target } : { type: 'none' }
  }

  if (abs <= SOFT_SYNC_THRESHOLD) return { type: 'rate', rate: 1 } // settle back to normal speed
  if (abs >= HARD_SYNC_THRESHOLD) return { type: 'seek', to: target }

  const ideal = drift > 0 ? 1 - NUDGE : 1 + NUDGE
  if (!allowedRates || allowedRates.length === 0) return { type: 'rate', rate: ideal }

  // Pick the closest allowed rate on the correct side of 1.
  const candidates = allowedRates.filter((r) => (drift > 0 ? r < 1 : r > 1))
  if (candidates.length === 0) return { type: 'seek', to: target }
  const rate = candidates.reduce((best, r) => (Math.abs(r - ideal) < Math.abs(best - ideal) ? r : best))
  return { type: 'rate', rate }
}
