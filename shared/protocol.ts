// Shared client/server protocol types.
// Every socket message and API shape crossing the wire is defined here, once.
// Server imports from ../shared, client via the @shared alias.

// ---------- Core entities ----------

export interface PublicUser {
  id: string
  username: string
  email?: string
  isGuest?: boolean
  isOnline?: boolean
  lastSeen?: number
  createdAt?: number
}

export interface Participant {
  id: string
  username: string
  socketId: string
}

export interface VideoState {
  url: string | null
  isPlaying: boolean
  currentTime: number
}

export interface FileInfo {
  name: string
  size: number
  type: string
}

export interface RoomFileShare {
  fileInfo: FileInfo
  hostId: string // socketId of the sharing host
}

export interface ChatMessage {
  username: string
  message: string
  timestamp: number
}

export interface PrivateMessage {
  from: { id: string; username: string }
  message: string
  timestamp: number
}

// Minimal ICE candidate shape (mirrors the DOM's RTCIceCandidateInit so the
// server can typecheck this file without DOM libs).
export interface IceCandidateInit {
  candidate?: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

// WebRTC signaling payload: an SDP description or an ICE candidate.
export type SignalPayload =
  | { type: 'offer' | 'answer'; sdp: string }
  | { candidate: IceCandidateInit }

// ---------- Socket events: client -> server ----------

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string }) => void
  'leave-room': (data: { roomId: string }) => void
  'get-server-time': (cb: (serverNow: number) => void) => void

  'video-url-set': (data: { roomId: string; url: string }) => void
  'video-play': (data: { roomId: string; currentTime: number; timestamp: number }) => void
  'video-pause': (data: { roomId: string; currentTime: number; timestamp: number }) => void
  'video-seek': (data: { roomId: string; currentTime: number; timestamp: number }) => void

  // Identity is taken from the authenticated socket; the payload carries only the text.
  'chat-message': (data: { roomId: string; message: string; timestamp?: number }) => void
  'private-message': (data: { to: string; message: string; timestamp: number }) => void

  'file-share-create': (data: { code: string; files: FileInfo[] }) => void
  'file-share-join': (data: { code: string }) => void
  'file-share-request': (data: { to: string }) => void
  'file-share-ready': (data: { to: string; fileInfo: FileInfo | FileInfo[] | null }) => void
  'file-share-signal': (data: { to: string; signal: SignalPayload }) => void
  'file-share-cancel': (data: { code: string }) => void

  'video-file-share': (data: { roomId: string; fileInfo: FileInfo }) => void
  'video-file-request': (data: { to: string }) => void
  'video-file-ready': (data: { to: string; fileInfo: FileInfo | null }) => void
  'video-file-signal': (data: { to: string; signal: SignalPayload }) => void
  'video-file-cancel': (data: { roomId: string }) => void
}

// ---------- Socket events: server -> client ----------

export interface ServerToClientEvents {
  'room-joined': (data: {
    participants: Participant[]
    isHost: boolean
    videoState: VideoState
    fileShare: RoomFileShare | null
  }) => void
  'user-joined': (data: { participants: Participant[]; user: { id: string; username: string } }) => void
  'user-left': (data: { participants: Participant[]; user: { id: string; username: string } }) => void
  // Presence refresh without a join/leave announcement (e.g. someone reconnected).
  'participants-updated': (data: { participants: Participant[] }) => void
  'host-changed': (data: { newHost: string }) => void

  'video-url-set': (data: { url: string }) => void
  'video-play': (data: { currentTime: number; timestamp: number }) => void
  'video-pause': (data: { currentTime: number }) => void
  'video-seek': (data: { currentTime: number }) => void

  'chat-message': (data: ChatMessage) => void
  'private-message': (data: PrivateMessage) => void
  'user-online': (data: { id: string; username: string }) => void
  'user-offline': (userId: string) => void

  'file-share-info': (data: { files: FileInfo[]; hostId: string; code: string }) => void
  'file-share-error': (data: { message: string }) => void
  'file-share-request': (data: { from: string }) => void
  'file-share-ready': (data: { from: string; fileInfo: FileInfo | FileInfo[] | null }) => void
  'file-share-signal': (data: { from: string; signal: SignalPayload }) => void

  'video-file-info': (data: { fileInfo: FileInfo; hostId: string }) => void
  'video-file-request': (data: { from: string }) => void
  'video-file-ready': (data: { from: string; fileInfo: FileInfo | null }) => void
  'video-file-signal': (data: { from: string; signal: SignalPayload }) => void
  'video-file-cancel': () => void
}

// ---------- REST API shapes ----------

export interface AuthResponse {
  message: string
  token: string
  user: PublicUser
}

export interface ConversationSummary {
  user: { id: string; username: string }
  lastMessage: { message: string; timestamp: number }
  unreadCount: number
}

export interface MessagesResponse {
  messages: Array<{
    id: string
    from: { id: string; username: string }
    to: { id: string; username: string }
    message: string
    timestamp: number
    read: boolean
  }>
}
