import { Router } from 'express'
import {
  createUser, findUserByEmail, findUserByUsername,
  verifyPassword, setUserOnline, toPublicUser,
} from './db.js'
import { authenticateToken, signToken } from './middleware.js'

const router = Router()

router.post('/signup', (req, res) => {
  const { username, email, password } = req.body ?? {}

  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'All fields are required' })
  }
  const name = username.trim()
  if (name.length < 3 || name.length > 20) {
    return res.status(400).json({ message: 'Username must be 3-20 characters' })
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email is required' })
  }

  if (findUserByEmail(email)) {
    return res.status(400).json({ message: 'This email is already taken' })
  }
  if (findUserByUsername(name)) {
    return res.status(400).json({ message: 'This username is already taken' })
  }

  const user = createUser(name, email, password)
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

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: toPublicUser(req.user!) })
})

router.post('/logout', authenticateToken, (req, res) => {
  setUserOnline(req.user!.id, false)
  res.json({ message: 'Logout successful' })
})

export default router
