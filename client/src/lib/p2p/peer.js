// WebRTC peer connection with the "perfect negotiation" pattern
// (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example).
//
// Why: the old implementation created offers ad-hoc and dropped ICE
// candidates that arrived before the remote description (it polled with a
// setInterval hack). Perfect negotiation makes glare (both sides offering at
// once) safe by giving one side the "polite" role, and we queue early ICE
// candidates properly.

const DEFAULT_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * @param {object} opts
 * @param {(signal: object) => void} opts.sendSignal relay a signal to the remote peer
 * @param {boolean} opts.polite this side yields on glare (rule: pick by comparing ids)
 * @param {RTCIceServer[]} [opts.iceServers]
 * @param {(state: string) => void} [opts.onConnectionState]
 * @param {(channel: RTCDataChannel) => void} [opts.onDataChannel]
 */
export function createPeer({ sendSignal, polite, iceServers, onConnectionState, onDataChannel }) {
  const pc = new RTCPeerConnection({
    iceServers: iceServers?.length ? iceServers : DEFAULT_ICE,
    iceCandidatePoolSize: 4,
  })

  let makingOffer = false
  let ignoreOffer = false
  const pendingCandidates = []
  let closed = false

  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true
      await pc.setLocalDescription()
      sendSignal({ type: pc.localDescription.type, sdp: pc.localDescription.sdp })
    } catch (err) {
      console.error('negotiationneeded failed:', err)
    } finally {
      makingOffer = false
    }
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendSignal({ candidate: candidate.toJSON() })
  }

  pc.onconnectionstatechange = () => {
    onConnectionState?.(pc.connectionState)
  }

  pc.ondatachannel = ({ channel }) => {
    onDataChannel?.(channel)
  }

  async function handleSignal(signal) {
    if (closed) return
    try {
      if (signal.type === 'offer' || signal.type === 'answer') {
        const description = signal
        const offerCollision = description.type === 'offer'
          && (makingOffer || pc.signalingState !== 'stable')

        ignoreOffer = !polite && offerCollision
        if (ignoreOffer) return

        await pc.setRemoteDescription(description)
        // Flush candidates that arrived before the description.
        while (pendingCandidates.length) {
          await pc.addIceCandidate(pendingCandidates.shift()).catch(() => {})
        }
        if (description.type === 'offer') {
          await pc.setLocalDescription()
          sendSignal({ type: pc.localDescription.type, sdp: pc.localDescription.sdp })
        }
      } else if (signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate).catch((err) => {
            if (!ignoreOffer) throw err
          })
        } else {
          pendingCandidates.push(signal.candidate)
        }
      }
    } catch (err) {
      console.error('Signal handling failed:', err)
    }
  }

  return {
    pc,
    handleSignal,
    createDataChannel: (label, options) => pc.createDataChannel(label, options),
    close: () => {
      closed = true
      try { pc.close() } catch { /* already closed */ }
    },
  }
}

/** Deterministic politeness: both sides agree without negotiation. */
export function isPolite(mySocketId, theirSocketId) {
  return mySocketId < theirSocketId
}
