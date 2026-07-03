// End-to-end encryption for direct messages.
//
// Each account generates an ECDH P-256 keypair on this device. The public key
// is published to the server; the PRIVATE key never leaves IndexedDB here.
// A message is encrypted with AES-256-GCM under the key derived from
// ECDH(my private, their public) — the server stores and relays only the
// envelope `{v:1, iv, ct}` and physically cannot read it. Sender and
// recipient derive the same key, so both can read the conversation history.
//
// Keys are per-device by default. To move history to another device, a user
// can export a passphrase-encrypted backup of their private key (see
// exportKeyBackup / importKeyBackup below). Keys are therefore generated
// extractable — but the private key still only ever leaves the device through
// that explicit, passphrase-gated action, never over the network.

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
    true, // extractable, so the key can be backed up under a passphrase
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

// ---------- Passphrase key backup ----------
//
// DM keys are per-device: a new device can't read old messages. Backup lets a
// user carry their private key to another device, protected by a passphrase.
// The key JWK is encrypted with AES-256-GCM under a key derived from the
// passphrase via PBKDF2 (200k iterations, SHA-256, random salt). The resulting
// blob is safe to store or send — it's useless without the passphrase.
//
// Keys are generated extractable so this export is possible. The private key
// still only ever leaves the device through this explicit, passphrase-gated
// action — never over the network, never to the server.

const KDF_ITERATIONS = 200_000

async function deriveBackupKey(passphrase, salt, usage) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

/**
 * Encrypt this device's DM private key under `passphrase`. Returns a JSON
 * string blob the user can save. Throws if the key predates backup support
 * (older keys were generated non-extractable).
 */
export async function exportKeyBackup(userId, passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters')
  const record = await idbGet(`ecdh-${userId}`)
  if (!record) throw new Error('No message key on this device yet')
  let privateJwk
  try {
    privateJwk = await crypto.subtle.exportKey('jwk', record.privateKey)
  } catch {
    throw new Error('This device’s key predates backup support and can’t be exported')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(passphrase, salt, ['encrypt'])
  const payload = new TextEncoder().encode(JSON.stringify({ userId, privateJwk, publicJwk: record.publicJwk }))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  return JSON.stringify({ v: 1, kdf: 'PBKDF2', it: KDF_ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) })
}

/**
 * Decrypt a backup blob with `passphrase` and install the key on this device
 * (overwriting any existing key for this user). Returns the imported public
 * JWK so the caller can republish it. Throws on a wrong passphrase or a blob
 * for a different account.
 */
export async function importKeyBackup(userId, passphrase, blob) {
  let parsed
  try {
    parsed = JSON.parse(blob)
  } catch {
    throw new Error('That doesn’t look like a backup file')
  }
  if (parsed.v !== 1 || !parsed.salt || !parsed.iv || !parsed.ct) throw new Error('Unrecognized backup format')
  const key = await deriveBackupKey(passphrase, unb64(parsed.salt), ['decrypt'])
  let plain
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parsed.iv) }, key, unb64(parsed.ct))
  } catch {
    throw new Error('Wrong passphrase, or the backup is corrupted')
  }
  const data = JSON.parse(new TextDecoder().decode(plain))
  if (data.userId !== userId) throw new Error('This backup belongs to a different account')
  const privateKey = await crypto.subtle.importKey(
    'jwk', data.privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'],
  )
  await idbSet(`ecdh-${userId}`, { privateKey, publicJwk: data.publicJwk })
  keyCache.clear() // shared-key cache is keyed on the other party, not us, but be safe
  return data.publicJwk
}
