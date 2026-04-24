import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Gate a route behind admin auth. Admin emails are read from the ADMIN_EMAILS
 * env var (comma-separated). If none is configured in production, admin routes
 * return 503 rather than silently allowing everyone through.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ message: 'Admin routes disabled (ADMIN_EMAILS not configured).' });
    }
    // In development we still require the session to exist, but any session passes.
    if (!req.session.userId) return res.status(401).json({ message: 'Authentication required.' });
    return next();
  }

  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user?.email || !adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ message: 'Admin only.' });
  }

  return next();
}

/**
 * Regenerate the session ID on login to prevent session fixation. Call this
 * BEFORE assigning req.session.userId = user.id, then set userId and save.
 */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
