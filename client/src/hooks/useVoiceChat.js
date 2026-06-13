import { useCallback, useEffect, useRef, useState } from 'react'
import { createPeer, isPolite } from '../lib/p2p/peer'

let iceServersCache
async function fetchIceServers() {
  if (iceServersCache !== undefined) return iceServersCache
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/ice-servers', { headers: { Authorization: `Bearer ${token}` } })
    iceServersCache = (await res.json()).iceServers
  } catch {
    iceServersCache = null
  }
  return iceServersCache
}

/**
 * Mesh voice chat for a watch party. The joiner dials every existing voice
 * member; members answer dials lazily on the first signal. All audio flows
 * peer-to-peer (DTLS-SRTP encrypted by the platform).
 */
export function useVoiceChat(socket, roomId) {
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [peers, setPeers] = useState({}) // socketId -> { username, stream }

  const peersRef = useRef(new Map()) // socketId -> { peer }
  const localStreamRef = useRef(null)
  const joinedRef = useRef(false)
  joinedRef.current = joined

  const teardownPeer = useCallback((peerId) => {
    peersRef.current.get(peerId)?.peer.close()
    peersRef.current.delete(peerId)
    setPeers((prev) => {
      if (!(peerId in prev)) return prev
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }, [])

  const buildPeer = useCallback(async (peerId, username) => {
    const iceServers = await fetchIceServers()
    const peer = createPeer({
      sendSignal: (signal) => socket.emit('voice-signal', { to: peerId, signal }),
      polite: isPolite(socket.id, peerId),
      iceServers,
      onConnectionState: (state) => {
        if (state === 'failed' || state === 'closed') teardownPeer(peerId)
      },
    })
    peer.pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      setPeers((prev) => ({ ...prev, [peerId]: { username: prev[peerId]?.username ?? username, stream } }))
    }
    for (const track of localStreamRef.current?.getTracks() ?? []) {
      peer.pc.addTrack(track, localStreamRef.current)
    }
    peersRef.current.set(peerId, { peer })
    setPeers((prev) => ({ ...prev, [peerId]: { username, stream: prev[peerId]?.stream ?? null } }))
    return peer
  }, [socket, teardownPeer])

  const leave = useCallback(() => {
    if (socket && joinedRef.current) socket.emit('voice-leave', { roomId })
    for (const peerId of [...peersRef.current.keys()]) teardownPeer(peerId)
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setJoined(false)
    setMuted(false)
  }, [socket, roomId, teardownPeer])

  const join = useCallback(async () => {
    if (!socket || joinedRef.current) return
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (err) {
      console.error('Microphone unavailable:', err)
      return
    }
    setJoined(true)
    socket.emit('voice-join', { roomId })
  }, [socket, roomId])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMuted(!track.enabled)
  }, [])

  useEffect(() => {
    if (!socket) return

    const onMembers = async ({ members }) => {
      for (const member of members) await buildPeer(member.socketId, member.username)
    }
    const onPeerJoined = ({ socketId, username }) => {
      // They will dial us; remember the name for when their signal arrives.
      if (joinedRef.current) {
        setPeers((prev) => ({ ...prev, [socketId]: { username, stream: prev[socketId]?.stream ?? null } }))
      }
    }
    const onPeerLeft = ({ socketId }) => teardownPeer(socketId)
    const onSignal = async ({ from, signal }) => {
      if (!joinedRef.current) return
      let entry = peersRef.current.get(from)
      if (!entry) {
        await buildPeer(from, peersRef.current.get(from)?.username)
        entry = peersRef.current.get(from)
      }
      entry?.peer.handleSignal(signal)
    }

    socket.on('voice-members', onMembers)
    socket.on('voice-peer-joined', onPeerJoined)
    socket.on('voice-peer-left', onPeerLeft)
    socket.on('voice-signal', onSignal)
    return () => {
      socket.off('voice-members', onMembers)
      socket.off('voice-peer-joined', onPeerJoined)
      socket.off('voice-peer-left', onPeerLeft)
      socket.off('voice-signal', onSignal)
    }
  }, [socket, buildPeer, teardownPeer])

  // Leave voice when unmounting (navigating away from the party).
  useEffect(() => leave, [leave])

  return { joined, muted, peers, join, leave, toggleMute }
}
