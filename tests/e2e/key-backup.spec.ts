import { test, expect } from '@playwright/test'

// Passphrase key backup: a private key exported under a passphrase can be
// restored on a "fresh" device (cleared IndexedDB) and then decrypts a message
// that was encrypted to its public key. A wrong passphrase must fail.

test('key backup round-trips and rejects a wrong passphrase', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const crypto_ = await import('/src/lib/dmCrypto.js')
    const { getOrCreateKeyPair, exportKeyBackup, importKeyBackup, encryptMessage, decryptMessage } = crypto_

    const userId = 'backup-user-' + Math.random().toString(36).slice(2)

    // Device 1: make a key, note its public JWK, encrypt a message to it from a
    // peer (simulate the peer with a second throwaway keypair).
    const mine = await getOrCreateKeyPair(userId)
    const myPubStr = JSON.stringify(mine.publicJwk)

    const peerId = 'peer-' + Math.random().toString(36).slice(2)
    const peer = await getOrCreateKeyPair(peerId)
    const peerPubStr = JSON.stringify(peer.publicJwk)

    const secret = 'meet at the lighthouse at dawn'
    // Peer encrypts to me; I (mine) decrypt with the peer's public key.
    const envelope = await encryptMessage(peer.privateKey, myPubStr, secret)

    // Export my key under a passphrase.
    const blob = await exportKeyBackup(userId, 'correct horse battery')

    // Wipe this "device": delete the IndexedDB key store so the key is gone.
    await new Promise((res, rej) => {
      const req = indexedDB.deleteDatabase('beacon-keys')
      req.onsuccess = () => res(undefined)
      req.onerror = () => rej(req.error)
      req.onblocked = () => res(undefined)
    })

    // Wrong passphrase must throw.
    let wrongRejected = false
    try {
      await importKeyBackup(userId, 'nope nope nope', blob)
    } catch {
      wrongRejected = true
    }

    // Right passphrase restores the key; it must decrypt the earlier message.
    const restoredPub = await importKeyBackup(userId, 'correct horse battery', blob)
    const restored = await getOrCreateKeyPair(userId) // now reads the imported key
    const plain = await decryptMessage(restored.privateKey, peerPubStr, envelope)

    return {
      wrongRejected,
      restoredMatchesPublic: JSON.stringify(restoredPub) === myPubStr,
      decrypted: plain,
      expected: secret,
    }
  })

  expect(result.wrongRejected).toBe(true)
  expect(result.restoredMatchesPublic).toBe(true)
  expect(result.decrypted).toBe(result.expected)
})
