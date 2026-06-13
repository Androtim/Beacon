import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

// Group DM list + creation. Membership and message bodies are managed by the
// Messages page (which owns decryption); this hook just keeps the roster of
// groups you belong to fresh as you're added or new messages arrive.
export function useGroups({ socket, enabled }) {
  const [groups, setGroups] = useState([])

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/groups')
      setGroups(res.data.groups)
    } catch {
      /* not signed in / offline — leave the list as-is */
    }
  }, [])

  useEffect(() => {
    if (enabled) refresh()
  }, [enabled, refresh])

  // Live: added to a new group, or a new message reorders the list.
  useEffect(() => {
    if (!socket) return
    const bump = () => refresh()
    socket.on('group-created', bump)
    socket.on('group-message', bump)
    return () => {
      socket.off('group-created', bump)
      socket.off('group-message', bump)
    }
  }, [socket, refresh])

  const createGroup = useCallback(async (name, memberIds) => {
    const res = await axios.post('/api/groups', { name, memberIds })
    await refresh()
    return res.data.group
  }, [refresh])

  return { groups, refresh, createGroup }
}
