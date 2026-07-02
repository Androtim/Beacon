// Share and room codes act as bearer capabilities (knowing one lets you join),
// so they come from the crypto RNG rather than Math.random.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function randomCode(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
