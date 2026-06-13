import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { findUserById } from './db.js'

export interface JwtPayload {
  userId: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      user?: ReturnType<typeof findUserById>
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as JwtPayload
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (!token) {
    res.status(401).json({ message: 'Access token required' })
    return
  }

  try {
    const decoded = verifyToken(token)
    const user = findUserById(decoded.userId)
    if (!user) {
      res.status(401).json({ message: 'User not found' })
      return
    }
    req.user = user
    next()
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' })
  }
}
