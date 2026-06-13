import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { findUserById, type UserRow } from './db.js'

export interface JwtPayload {
  userId: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      user?: UserRow
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as JwtPayload
}

function userFromAuthHeader(req: Request): UserRow | undefined {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return undefined
  try {
    return findUserById(verifyToken(token).userId)
  } catch {
    return undefined
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers['authorization']) {
    res.status(401).json({ message: 'Access token required' })
    return
  }
  const user = userFromAuthHeader(req)
  if (!user) {
    res.status(403).json({ message: 'Invalid or expired token' })
    return
  }
  req.user = user
  next()
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalToken(req: Request, _res: Response, next: NextFunction): void {
  req.user = userFromAuthHeader(req)
  next()
}

/** For features that need a persistent identity (DMs): guests are asked to sign up. */
export function requireAccount(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.is_guest) {
    res.status(403).json({ message: 'This feature requires an account' })
    return
  }
  next()
}
