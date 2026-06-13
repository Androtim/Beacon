import { useCallback, useEffect, useState } from 'react'

// Tracks recently-visited watch party rooms so the sidebar can offer quick
// re-entry (the "open parties" section). Backed by localStorage; broadcasts
// changes across the app via a window event so the rail updates live.

const KEY = 'beacon-recent-rooms'
const MAX = 6
const EVENT = 'beacon-recent-rooms-changed'

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function recordRoom(roomId) {
  if (!roomId) return
  const list = read().filter((r) => r.id !== roomId)
  list.unshift({ id: roomId, ts: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
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
