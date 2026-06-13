// OPFS storage worker. FileSystemSyncAccessHandle persists writes
// immediately (unlike createWritable, which only persists on close) — that's
// what makes transfers resumable across page reloads — but it is only
// available inside a worker.

const handles = new Map() // key -> FileSystemSyncAccessHandle

async function getDir() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle('beacon-transfers', { create: true })
}

self.onmessage = async (event) => {
  const { op, key, reqId } = event.data
  try {
    if (op === 'open') {
      const dir = await getDir()
      const fileHandle = await dir.getFileHandle(key, { create: true })
      const handle = await fileHandle.createSyncAccessHandle()
      handles.set(key, handle)
      const size = handle.getSize()
      // Trim any torn trailing chunk so we restart on a chunk boundary.
      const { chunkSize } = event.data
      const have = Math.floor(size / chunkSize)
      handle.truncate(have * chunkSize)
      self.postMessage({ reqId, ok: true, have })
    } else if (op === 'write') {
      const handle = handles.get(key)
      if (!handle) throw new Error(`no open handle for ${key}`)
      handle.write(new Uint8Array(event.data.bytes), { at: event.data.position })
      self.postMessage({ reqId, ok: true })
    } else if (op === 'close') {
      const handle = handles.get(key)
      if (handle) {
        handle.flush()
        handle.close()
        handles.delete(key)
      }
      self.postMessage({ reqId, ok: true })
    } else if (op === 'remove') {
      const handle = handles.get(key)
      if (handle) {
        try { handle.close() } catch { /* already closed */ }
        handles.delete(key)
      }
      const dir = await getDir()
      await dir.removeEntry(key).catch(() => {})
      self.postMessage({ reqId, ok: true })
    }
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: String(err?.message ?? err) })
  }
}
