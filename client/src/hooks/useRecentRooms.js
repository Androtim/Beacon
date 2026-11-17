import { useCallback, useEffect, useState } from 'react'

// Tracks recently-visited watch party rooms so the sidebar, Home, and Rooms
// directory can offer rich quick re-entry. Backed by localStorage; broadcasts
// changes across the app via a window event so the rail updates live.

const KEY = 'beacon-recent-rooms'
const MAX = 12
const EVENT = 'beacon-recent-rooms-changed'

const ARTWORKS = [
  '/images/room-lighthouse.jpg',
  '/images/room-neon.jpg',
  '/images/hero-dunes.jpg',
]
const GRADIENTS = ['noir', 'clay', 'forest', 'ink']

function hashRoom(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

function enrichRoom(entry) {
  const id = entry.id
  const h = hashRoom(id)
  return {
    id,
    code: id,
    title: entry.title || `Room ${id}`,
    contents: entry.contents || (entry.url ? prettySourceName(entry.url) : 'Synchronized screening'),
    url: entry.url || null,
    image: entry.image !== undefined ? entry.image : (h % 3 === 0 ? null : ARTWORKS[h % ARTWORKS.length]),
    gradient: entry.gradient || GRADIENTS[h % GRADIENTS.length],
    isYours: entry.isYours ?? true,
    ts: entry.ts || Date.now(),
  }
}

export function prettySourceName(url = '') {
  if (!url) return 'Open screening'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube screening'
  if (url.startsWith('blob:')) return 'Local P2P stream'
  try {
    const last = url.split('/').filter(Boolean).pop()?.split('?')[0] || ''
    const cleaned = decodeURIComponent(last).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Shared video'
  } catch {
    return 'Shared video'
  }
}

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.map(enrichRoom) : []
  } catch {
    return []
  }
}

export function recordRoom(roomId, meta = {}) {
  if (!roomId) return
  const current = read()
  const existing = current.find((r) => r.id === roomId) || {}
  const updated = enrichRoom({
    ...existing,
    ...meta,
    id: roomId,
    ts: Date.now(),
  })
  const list = [updated, ...current.filter((r) => r.id !== roomId)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(EVENT))
}

export function useRecentRooms() {
  const [rooms, setRooms] = useState(read)

  useEffect(() => {
    const refresh = () => setRooms(read())
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const remove = useCallback((roomId) => {
    localStorage.setItem(KEY, JSON.stringify(read().filter((r) => r.id !== roomId)))
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { rooms, remove }
}
