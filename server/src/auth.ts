import { Router } from 'express'
import {
  createUser, createGuest, upgradeGuestToAccount, updateUsername,
  findUserByEmail, findUserByUsername, setPublicKey,
  verifyPassword, setUserOnline, toPublicUser,
} from './db.js'
import { authenticateToken, optionalToken, signToken } from './middleware.js'

const router = Router()

const USERNAME_RE = /^[\w][\w .-]{1,18}[\w]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validUsername(name: unknown): name is string {
  return typeof name === 'string' && USERNAME_RE.test(name.trim())
}

/** Anonymous identity: anyone can join/host with zero setup. */
router.post('/guest', (req, res) => {
  const { username } = req.body ?? {}
  if (username !== undefined && !validUsername(username)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, spaces, ._-)' })
  }
  if (username && findUserByUsername(username)) {
    return res.status(400).json({ message: 'This username is already taken' })
  }
  const user = createGuest(username)
  const token = signToken({ userId: user.id, username: user.username })
  res.status(201).json({ message: 'Guest session created', token, user: toPublicUser(user) })
})

/** Signup. If called with a valid guest token, upgrades that guest in place (keeps id/history). */
router.post('/signup', optionalToken, (req, res) => {
  const { username, email, password } = req.body ?? {}

  if (!validUsername(username)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, spaces, ._-)' })
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email is required' })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }
  if (findUserByEmail(email)) {
    return res.status(400).json({ message: 'This email is already taken' })
  }
  const nameOwner = findUserByUsername(username)
  if (nameOwner && nameOwner.id !== req.user?.id) {
    return res.status(400).json({ message: 'This username is already taken' })
  }

  const user = req.user?.is_guest
    ? upgradeGuestToAccount(req.user.id, username, email, password)
    : createUser(username, email, password)

  const token = signToken({ userId: user.id, username: user.username })
  res.status(201).json({ message: 'Account created successfully', token, user: toPublicUser(user) })
})

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const user = findUserByEmail(email)
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  setUserOnline(user.id, true)
  const token = signToken({ userId: user.id, username: user.username })
  res.json({ message: 'Login successful', token, user: toPublicUser(user) })
})

router.post('/rename', authenticateToken, (req, res) => {
  const { username } = req.body ?? {}
  if (!validUsername(username)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, spaces, ._-)' })
  }
  const owner = findUserByUsername(username)
  if (owner && owner.id !== req.user!.id) {
    return res.status(400).json({ message: 'This username is already taken' })
  }
  const user = updateUsername(req.user!.id, username)
  const token = signToken({ userId: user.id, username: user.username })
  res.json({ message: 'Username updated', token, user: toPublicUser(user) })
})

/** Publish this account's ECDH public key (JWK) for E2E DMs. */
router.post('/public-key', authenticateToken, (req, res) => {
  const { publicKey } = req.body ?? {}
  if (typeof publicKey !== 'string' || publicKey.length > 2048) {
    return res.status(400).json({ message: 'publicKey (JWK JSON string) required' })
  }
  try {
    const jwk = JSON.parse(publicKey)
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) throw new Error('bad jwk')
  } catch {
    return res.status(400).json({ message: 'publicKey must be an EC P-256 JWK' })
  }
  setPublicKey(req.user!.id, publicKey)
  res.json({ message: 'Public key updated' })
})

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: toPublicUser(req.user!) })
})

router.post('/logout', authenticateToken, (req, res) => {
  setUserOnline(req.user!.id, false)
  res.json({ message: 'Logout successful' })
})

export default router
