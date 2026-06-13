import { z } from 'zod'

// Zod schemas for every client -> server socket payload. Anything that fails
// parsing is dropped at the boundary before reaching a handler.

const roomId = z.string().min(1).max(64)
const socketId = z.string().min(1).max(64)

export const signalPayload = z.union([
  z.object({ type: z.enum(['offer', 'answer']), sdp: z.string().max(100_000) }),
  z.object({
    candidate: z.object({
      candidate: z.string().max(2048).optional(),
      sdpMid: z.string().max(64).nullable().optional(),
      sdpMLineIndex: z.number().int().nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    }),
  }),
])

export const fileInfo = z.object({
  name: z.string().min(1).max(512),
  size: z.number().int().nonnegative().max(1024 * 1024 * 1024 * 1024),
  type: z.string().max(256),
})

export const schemas = {
  'join-room': z.object({ roomId }),
  'leave-room': z.object({ roomId }),
  'video-url-set': z.object({ roomId, url: z.string().min(1).max(4096) }),
  'video-play': z.object({ roomId, currentTime: z.number().finite(), timestamp: z.number().optional() }),
  'video-pause': z.object({ roomId, currentTime: z.number().finite(), timestamp: z.number().optional() }),
  'video-seek': z.object({ roomId, currentTime: z.number().finite(), timestamp: z.number().optional() }),
  'stream-request': z.object({ roomId, url: z.string().min(1).max(4096) }),
  'stream-respond': z.object({ roomId, requestId: z.string().min(1).max(64), approve: z.boolean() }),
  'chat-message': z.object({
    roomId,
    message: z.string().min(1).max(2000),
    timestamp: z.number().optional(),
    username: z.string().optional(), // ignored; identity comes from the socket
  }),
  'private-message': z.object({
    to: z.string().min(1).max(64),
    // Generous cap: E2E envelopes are base64 (~1.4x) plus JSON overhead.
    message: z.string().min(1).max(20000),
    timestamp: z.number().optional(),
  }),
  'dm-file-offer': z.object({ to: z.string().min(1).max(64), transferId: z.string().min(1).max(64), fileInfo }),
  'dm-file-request': z.object({ to: z.string().min(1).max(64), transferId: z.string().min(1).max(64) }),
  'dm-file-decline': z.object({ to: z.string().min(1).max(64), transferId: z.string().min(1).max(64) }),
  'dm-file-signal': z.object({ to: z.string().min(1).max(64), signal: signalPayload }),
  'dm-party-invite': z.object({ to: z.string().min(1).max(64), roomId }),
  'file-share-create': z.object({
    code: z.string().regex(/^[A-Za-z0-9]{4,16}$/),
    files: z.array(fileInfo).min(1).max(100),
  }),
  'file-share-join': z.object({ code: z.string().min(1).max(16) }),
  'file-share-request': z.object({ to: socketId }),
  'file-share-ready': z.object({ to: socketId, fileInfo: z.unknown().optional() }),
  'file-share-signal': z.object({ to: socketId, signal: signalPayload }),
  'file-share-cancel': z.object({ code: z.string().min(1).max(16) }),
  'video-file-share': z.object({ roomId, fileInfo }),
  'video-file-request': z.object({ to: socketId }),
  'video-file-ready': z.object({ to: socketId, fileInfo: fileInfo.nullable().optional() }),
  'video-file-signal': z.object({ to: socketId, signal: signalPayload }),
  'video-file-cancel': z.object({ roomId }),
  'voice-join': z.object({ roomId }),
  'voice-leave': z.object({ roomId }),
  'voice-signal': z.object({ to: socketId, signal: signalPayload }),
} as const

export type SchemaMap = typeof schemas
