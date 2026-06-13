import { offsetSample, combineOffsets } from '@shared/sync'

// Estimates the offset between local time and server time by pinging the
// server several times and combining the samples (NTP-lite).

const PING_TIMEOUT_MS = 3000

function pingOnce(socket) {
  return new Promise((resolve, reject) => {
    const sent = Date.now()
    const timer = setTimeout(() => reject(new Error('clock ping timeout')), PING_TIMEOUT_MS)
    socket.emit('get-server-time', (serverNow) => {
      clearTimeout(timer)
      resolve(offsetSample(sent, serverNow, Date.now()))
    })
  })
}

export function createClock(socket) {
  let offset = 0
  let calibrated = false

  async function calibrate(samples = 5) {
    const collected = []
    for (let i = 0; i < samples; i++) {
      try {
        collected.push(await pingOnce(socket))
      } catch {
        // skip failed sample
      }
    }
    if (collected.length > 0) {
      offset = combineOffsets(collected)
      calibrated = true
    }
    return offset
  }

  return {
    calibrate,
    serverNow: () => Date.now() + offset,
    isCalibrated: () => calibrated,
    getOffset: () => offset,
  }
}
