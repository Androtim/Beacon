import { useSocketContext } from '../context/SocketContext'

// Back-compat wrapper around the app-wide socket (see SocketContext).
export function useSocket() {
  const { socket } = useSocketContext()
  return socket
}

export function useSocketConnected() {
  const { connected } = useSocketContext()
  return connected
}
