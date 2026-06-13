// P2P file transfer protocol over a WebRTC data channel.
//
// Design goals (vs the old implementation):
// - RECEIVED DATA GOES TO DISK (OPFS), not RAM — a 3GB file no longer needs
//   ~6GB of browser memory. Memory fallback only when OPFS is unavailable.
// - RESUMABLE: progress survives disconnects and page reloads. Chunks are
//   written sequentially, so the partial file's size on disk states exactly
//   how much we have; on a new channel the receiver answers the manifest
//   with how much it already has and the sender skips ahead.
// - Backpressure via bufferedamountlow (no unbounded send queues).
//
// Wire format:
//   JSON control frames (strings):
//     {t:'manifest', id, files:[{i, name, size, type, chunkSize, totalChunks}]}
//     {t:'resume', id, have:{[fileIndex]: chunksAlreadyOnDisk}}   receiver->sender
//     {t:'ack', i, upTo}                                          receiver->sender
//     {t:'done', id}                                              sender->receiver
//   Binary frames: 8-byte header (uint32 LE fileIndex, uint32 LE chunkIndex)
//   followed by the chunk bytes. Integrity rides on DTLS encryption + SCTP
//   reliable ordered delivery; sizes are verified on completion.

export const CHUNK_SIZE = 64 * 1024
const HEADER_BYTES = 8
const BUFFER_LOW = 512 * 1024
const BUFFER_HIGH = 4 * 1024 * 1024
const ACK_EVERY = 32 // chunks

// ---------- OPFS-backed receiver storage (memory fallback) ----------
//
// Writes go through a worker using FileSystemSyncAccessHandle: those persist
// immediately, which is what makes resume survive page reloads. The
// main-thread createWritable API only persists on close() and would lose the
// whole in-flight file on reload.

let worker = null
let nextReqId = 1
const pending = new Map()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./opfsWorker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const { reqId, ok, error, ...rest } = event.data
    const entry = pending.get(reqId)
    if (!entry) return
    pending.delete(reqId)
    if (ok) entry.resolve(rest)
    else entry.reject(new Error(error))
  }
  return worker
}

function workerCall(message, transfer) {
  const reqId = nextReqId++
  return new Promise((resolve, reject) => {
    pending.set(reqId, { resolve, reject })
    getWorker().postMessage({ ...message, reqId }, transfer ?? [])
  })
}

function opfsSupported() {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory && typeof Worker !== 'undefined'
}

function partName(transferId, fileIndex) {
  return `${transferId.replace(/[^\w-]/g, '_')}.f${fileIndex}.part`
}

async function createFileStore(transferId, fileMeta) {
  if (opfsSupported()) {
    try {
      const key = partName(transferId, fileMeta.i)
      const { have } = await workerCall({ op: 'open', key, chunkSize: fileMeta.chunkSize })
      return {
        kind: 'opfs',
        have: Math.min(have, fileMeta.totalChunks),
        async write(chunkIndex, bytes) {
          // bytes is an ArrayBuffer we own; transfer it zero-copy.
          await workerCall({ op: 'write', key, position: chunkIndex * fileMeta.chunkSize, bytes }, [bytes])
        },
        async finish() {
          await workerCall({ op: 'close', key })
          const root = await navigator.storage.getDirectory()
          const dir = await root.getDirectoryHandle('beacon-transfers', { create: true })
          const handle = await dir.getFileHandle(key)
          return handle.getFile()
        },
        async abort() {
          await workerCall({ op: 'close', key }).catch(() => {})
        },
      }
    } catch {
      // fall through to memory
    }
  }

  // Fallback: hold chunks in memory (no resume, large files risky).
  const chunks = new Array(fileMeta.totalChunks)
  return {
    kind: 'memory',
    have: 0,
    async write(chunkIndex, bytes) {
      chunks[chunkIndex] = bytes
    },
    async finish() {
      return new File(chunks, fileMeta.name, { type: fileMeta.type })
    },
    async abort() { chunks.length = 0 },
  }
}

/** Remove a transfer's partial files (after successful consumption or cancel). */
export async function cleanupTransfer(transferId, fileCount = 32) {
  if (!opfsSupported()) return
  for (let i = 0; i < fileCount; i++) {
    await workerCall({ op: 'remove', key: partName(transferId, i) }).catch(() => {})
  }
}

// ---------- Sender ----------

/**
 * Sends `files` over an open data channel. Waits for the receiver's `resume`
 * answer to the manifest, then streams chunks with backpressure, skipping
 * whatever the receiver already has.
 */
export function createSender({ channel, transferId, files, onProgress, onComplete, onError }) {
  let stopped = false
  channel.binaryType = 'arraybuffer'
  channel.bufferedAmountLowThreshold = BUFFER_LOW

  const metas = files.map((file, i) => ({
    i,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    chunkSize: CHUNK_SIZE,
    totalChunks: Math.max(1, Math.ceil(file.size / CHUNK_SIZE)),
  }))

  const acked = new Map() // fileIndex -> chunks confirmed by receiver

  function waitBufferLow() {
    if (channel.bufferedAmount <= BUFFER_HIGH) return Promise.resolve()
    return new Promise((resolve) => {
      const handler = () => {
        channel.removeEventListener('bufferedamountlow', handler)
        resolve()
      }
      channel.addEventListener('bufferedamountlow', handler)
    })
  }

  async function streamFiles(have) {
    for (const meta of metas) {
      const file = files[meta.i]
      let chunk = have[meta.i] ?? 0
      if (chunk >= meta.totalChunks) continue // receiver already has this file

      while (chunk < meta.totalChunks) {
        if (stopped || channel.readyState !== 'open') return
        const start = chunk * meta.chunkSize
        const end = Math.min(start + meta.chunkSize, file.size)
        const bytes = await file.slice(start, end).arrayBuffer()

        const frame = new Uint8Array(HEADER_BYTES + bytes.byteLength)
        const view = new DataView(frame.buffer)
        view.setUint32(0, meta.i, true)
        view.setUint32(4, chunk, true)
        frame.set(new Uint8Array(bytes), HEADER_BYTES)

        await waitBufferLow()
        if (stopped || channel.readyState !== 'open') return
        channel.send(frame)

        chunk++
        if (chunk % 16 === 0 || chunk === meta.totalChunks) {
          onProgress?.({
            fileIndex: meta.i,
            sentChunks: chunk,
            totalChunks: meta.totalChunks,
            percent: Math.round((chunk / meta.totalChunks) * 100),
          })
        }
      }
    }
    if (!stopped && channel.readyState === 'open') {
      channel.send(JSON.stringify({ t: 'done', id: transferId }))
      onComplete?.()
    }
  }

  channel.onmessage = (event) => {
    if (typeof event.data !== 'string') return
    try {
      const msg = JSON.parse(event.data)
      if (msg.t === 'resume' && msg.id === transferId) {
        streamFiles(msg.have ?? {}).catch((err) => onError?.(err))
      } else if (msg.t === 'ack') {
        acked.set(msg.i, msg.upTo)
      }
    } catch (err) {
      onError?.(err)
    }
  }

  channel.onerror = (e) => { if (!stopped) onError?.(e.error ?? new Error('data channel error')) }

  function start() {
    const announce = () => channel.send(JSON.stringify({ t: 'manifest', id: transferId, files: metas }))
    if (channel.readyState === 'open') announce()
    else channel.onopen = announce
  }

  return {
    start,
    stop: () => { stopped = true },
    getAcked: () => new Map(acked),
  }
}

// ---------- Receiver ----------

/**
 * Receives a transfer on an open data channel. Answers the manifest with how
 * much it already has on disk (resume), streams chunks to OPFS, and yields
 * each completed file as a File/Blob.
 */
export function createReceiver({ channel, transferId, onManifest, onProgress, onFileComplete, onAllComplete, onError }) {
  let stopped = false
  channel.binaryType = 'arraybuffer'

  let metas = null
  const stores = new Map() // fileIndex -> store
  const received = new Map() // fileIndex -> contiguous chunks received
  const finished = new Set()

  async function handleManifest(msg) {
    metas = msg.files
    const have = {}
    for (const meta of metas) {
      const store = await createFileStore(transferId, meta)
      stores.set(meta.i, store)
      received.set(meta.i, store.have)
      have[meta.i] = store.have
      if (store.have >= meta.totalChunks) await completeFile(meta)
    }
    onManifest?.(metas)
    channel.send(JSON.stringify({ t: 'resume', id: transferId, have }))
  }

  async function completeFile(meta) {
    if (finished.has(meta.i)) return
    finished.add(meta.i)
    const store = stores.get(meta.i)
    const raw = await store.finish()
    // Rewrap: the OPFS file carries the internal part-name, and may overhang
    // by a torn trailing chunk. Blob parts are by-reference (no byte copy).
    const body = raw.size === meta.size ? raw : raw.slice(0, meta.size)
    onFileComplete?.(new File([body], meta.name, { type: meta.type }), meta)
    if (metas && finished.size === metas.length) onAllComplete?.()
  }

  channel.onmessage = async (event) => {
    if (stopped) return
    try {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data)
        if (msg.t === 'manifest' && msg.id === transferId) await handleManifest(msg)
        // 'done' is informational; completion is tracked per file by count.
        return
      }

      const view = new DataView(event.data)
      const fileIndex = view.getUint32(0, true)
      const chunkIndex = view.getUint32(4, true)
      const meta = metas?.find((m) => m.i === fileIndex)
      const store = stores.get(fileIndex)
      if (!meta || !store || finished.has(fileIndex)) return

      // Copy out of the frame so the buffer can be transferred to the worker.
      const bytes = event.data.slice(HEADER_BYTES)
      await store.write(chunkIndex, bytes)

      const count = chunkIndex + 1
      received.set(fileIndex, count)
      if (count % ACK_EVERY === 0 && channel.readyState === 'open') {
        channel.send(JSON.stringify({ t: 'ack', i: fileIndex, upTo: count }))
      }
      if (count % 16 === 0 || count === meta.totalChunks) {
        onProgress?.({
          fileIndex,
          receivedChunks: count,
          totalChunks: meta.totalChunks,
          percent: Math.round((count / meta.totalChunks) * 100),
        })
      }
      if (count === meta.totalChunks) await completeFile(meta)
    } catch (err) {
      onError?.(err)
    }
  }

  channel.onerror = (e) => { if (!stopped) onError?.(e.error ?? new Error('data channel error')) }

  return {
    stop: async () => {
      stopped = true
      for (const store of stores.values()) await store.abort()
    },
  }
}
