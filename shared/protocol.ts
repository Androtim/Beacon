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
  /** ECDH P-256 public key (JWK JSON) for E2E DMs. */
  publicKey?: string
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

// Authoritative playback state (see shared/sync.ts). The server broadcasts
// this on every change; clients steer their players toward it.
export interface PlaybackState {
  url: string | null
  isPlaying: boolean
  position: number
  atServerTime: number
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

  // Any participant can suggest a video; the host approves before it goes live.
  'stream-request': (data: { roomId: string; url: string }) => void
  'stream-respond': (data: { roomId: string; requestId: string; approve: boolean }) => void

  // Identity is taken from the authenticated socket; the payload carries only the text.
  'chat-message': (data: { roomId: string; message: string; timestamp?: number }) => void
  'private-message': (data: { to: string; message: string; timestamp: number }) => void

  // File-in-DM: P2P transfer between two accounts, relayed by userId.
  'dm-file-offer': (data: { to: string; transferId: string; fileInfo: FileInfo }) => void
  'dm-file-request': (data: { to: string; transferId: string }) => void
  'dm-file-decline': (data: { to: string; transferId: string }) => void
  'dm-file-signal': (data: { to: string; signal: SignalPayload }) => void
  'dm-party-invite': (data: { to: string; roomId: string }) => void

  // Group DMs. body is an opaque per-member envelope map for text; for
  // 'party-invite'/'file-offer' kinds the payload rides in meta.
  'group-message': (data: {
    groupId: string
    body: string
    timestamp: number
    kind?: string
    meta?: Record<string, unknown>
  }) => void

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

  'voice-join': (data: { roomId: string }) => void
  'voice-leave': (data: { roomId: string }) => void
  'voice-signal': (data: { to: string; signal: SignalPayload }) => void
}

// ---------- Socket events: server -> client ----------

export interface ServerToClientEvents {
  'room-joined': (data: {
    participants: Participant[]
    isHost: boolean
    playback: PlaybackState
    fileShare: RoomFileShare | null
  }) => void
  // Single authoritative playback broadcast — replaces per-action video events.
  'video-state': (data: { playback: PlaybackState }) => void
  // Sent to the host when a participant suggests a video.
  'stream-request': (data: { requestId: string; from: { id: string; username: string }; url: string }) => void
  // Sent to the requester when the host approves/denies their suggestion.
  'stream-request-resolved': (data: { requestId: string; approved: boolean; url: string }) => void
  'user-joined': (data: { participants: Participant[]; user: { id: string; username: string } }) => void
  'user-left': (data: { participants: Participant[]; user: { id: string; username: string } }) => void
  // Presence refresh without a join/leave announcement (e.g. someone reconnected).
  'participants-updated': (data: { participants: Participant[] }) => void
  'host-changed': (data: { newHost: string }) => void

  'chat-message': (data: ChatMessage) => void
  'private-message': (data: PrivateMessage) => void
  // File-in-DM, relayed from the other user.
  'dm-file-offer': (data: { from: string; fromUsername: string; transferId: string; fileInfo: FileInfo }) => void
  'dm-file-request': (data: { from: string; transferId: string }) => void
  'dm-file-decline': (data: { from: string; transferId: string }) => void
  'dm-file-signal': (data: { from: string; signal: SignalPayload }) => void
  'dm-party-invite': (data: { from: string; fromUsername: string; roomId: string }) => void
  // Group DMs: a new message in a group the recipient belongs to, and a
  // notification that they've been added to a freshly created group.
  'group-message': (data: {
    groupId: string
    id: string
    from: { id: string; username: string }
    body: string
    timestamp: number
    kind: string
    meta?: Record<string, unknown>
  }) => void
  'group-created': (data: { group: GroupSummary }) => void
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

  // Voice chat: the joiner receives the current members and dials each one;
  // existing members learn about the newcomer and answer their dials.
  'voice-members': (data: { members: Array<{ socketId: string; username: string }> }) => void
  'voice-peer-joined': (data: { socketId: string; username: string }) => void
  'voice-peer-left': (data: { socketId: string }) => void
  'voice-signal': (data: { from: string; signal: SignalPayload }) => void
}

// ---------- REST API shapes ----------

export interface AuthResponse {
  message: string
  token: string
  user: PublicUser
}

export interface ConversationSummary {
  user: { id: string; username: string; publicKey?: string }
  lastMessage: { message: string; timestamp: number }
  unreadCount: number
}

// ---------- Group DMs ----------

export interface GroupMember {
  id: string
  username: string
  publicKey?: string
}

export interface GroupSummary {
  id: string
  name: string
  members: GroupMember[]
  // We never decrypt on the server, so the preview is just metadata.
  lastMessage: { from: string; timestamp: number; kind: string } | null
}

export interface GroupMessagesResponse {
  group: GroupSummary
  messages: Array<{
    id: string
    from: { id: string; username: string }
    // For text: a per-member envelope map JSON ({ userId: envelope }).
    // For invite/offer kinds: a plaintext label; payload is in `meta`.
    body: string
    timestamp: number
    kind: string
    meta?: Record<string, unknown>
  }>
}

export interface MessagesResponse {
  messages: Array<{
    id: string
    from: { id: string; username: string }
    to: { id: string; username: string }
    message: string
    timestamp: number
    read: boolean
    // 'text' for ordinary DMs; 'party-invite' / 'file-offer' carry their
    // structured payload in `meta` and render as action cards in the chat.
    kind: string
    meta?: Record<string, unknown>
  }>
}
