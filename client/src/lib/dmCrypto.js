// End-to-end encryption for direct messages.
//
// Each account generates an ECDH P-256 keypair on this device. The public key
// is published to the server; the PRIVATE key never leaves IndexedDB here.
// A message is encrypted with AES-256-GCM under the key derived from
// ECDH(my private, their public) — the server stores and relays only the
// envelope `{v:1, iv, ct}` and physically cannot read it. Sender and
// recipient derive the same key, so both can read the conversation history.
//
// Known limitation (documented in QUESTIONS.md): keys are per-device. A new
// device generates a new keypair and cannot read old ciphertext (passphrase
// key backup is a planned follow-up).

const DB_NAME = 'beacon-keys'
const STORE = 'keys'

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key, value) {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Keypair for this user on this device (created on first use). */
export async function getOrCreateKeyPair(userId) {
  const slot = `ecdh-${userId}`
  const existing = await idbGet(slot)
  if (existing) return existing

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // private key not extractable — it cannot leave this device
    ['deriveKey'],
  )
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const record = { privateKey: pair.privateKey, publicJwk }
  await idbSet(slot, record)
  return record
}

const keyCache = new Map() // theirJwkString -> CryptoKey

async function sharedKey(myPrivateKey, theirPublicJwkString) {
  let key = keyCache.get(theirPublicJwkString)
  if (key) return key
  const theirPublic = await crypto.subtle.importKey(
    'jwk', JSON.parse(theirPublicJwkString),
    { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )
  key = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  keyCache.set(theirPublicJwkString, key)
  return key
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))

export async function encryptMessage(myPrivateKey, theirPublicJwkString, plaintext) {
  const key = await sharedKey(myPrivateKey, theirPublicJwkString)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext),
  )
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) })
}

export function isEnvelope(text) {
  if (typeof text !== 'string' || !text.startsWith('{')) return false
  try {
    const obj = JSON.parse(text)
    return obj.v === 1 && typeof obj.iv === 'string' && typeof obj.ct === 'string'
  } catch {
    return false
  }
}

/** Returns the plaintext, or null when this device cannot decrypt. */
export async function decryptMessage(myPrivateKey, theirPublicJwkString, envelopeText) {
  try {
    const { iv, ct } = JSON.parse(envelopeText)
    const key = await sharedKey(myPrivateKey, theirPublicJwkString)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

// ---------- Group messages ----------
//
// ECDH is pairwise, so a group message is encrypted once per recipient into an
// envelope map { userId: envelope }. The server stores it opaquely and stays
// zero-knowledge. The sender is omitted from the map: ECDH is symmetric, so to
// read their own history they decrypt any member's envelope with that member's
// public key.

/** Build the per-member envelope map (JSON string) for a group message. */
export async function encryptGroupMessage(myPrivateKey, members, myId, plaintext) {
  const map = {}
  for (const m of members) {
    if (m.id === myId || !m.publicKey) continue
    map[m.id] = await encryptMessage(myPrivateKey, m.publicKey, plaintext)
  }
  return JSON.stringify(map)
}

/** Decrypt a group envelope map for `myId`, given who sent it. */
export async function decryptGroupMessage(myPrivateKey, members, myId, senderId, bodyJson) {
  let map
  try {
    map = JSON.parse(bodyJson)
  } catch {
    return bodyJson // legacy plaintext
  }
  if (!map || typeof map !== 'object' || map.v) return bodyJson
  if (!myPrivateKey) return '🔒 (encrypted)'

  // Recipient path: decrypt the envelope addressed to me using the sender's key.
  if (map[myId]) {
    const sender = members.find((m) => m.id === senderId)
    return (await decryptMessage(myPrivateKey, sender?.publicKey, map[myId])) ?? '🔒 (sent to another device)'
  }
  // Sender path: no envelope for me — decrypt any member's with their key.
  for (const m of members) {
    if (m.id !== myId && m.publicKey && map[m.id]) {
      const plain = await decryptMessage(myPrivateKey, m.publicKey, map[m.id])
      if (plain != null) return plain
    }
  }
  return '🔒 (sent to another device)'
}
