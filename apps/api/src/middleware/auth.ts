import { type Request, type Response, type NextFunction } from 'express';
import { auth, type Session } from '../auth.js';
import { fromNodeHeaders } from 'better-auth/node';

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      userId?: string;
    }
  }
}

/**
 * Middleware that extracts session from request.
 * Does not block unauthenticated requests - just attaches session if present.
 */
export async function sessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    
    if (session) {
      req.session = session;
      req.userId = session.user.id;
    }
  } catch (err) {
    // Session extraction failed - continue without session
    console.error('Session extraction error:', err);
  }
  
  next();
}

/**
 * Middleware that requires authentication.
 * Returns 401 if no valid session.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Support both real auth and X-User-Id header for testing/migration
  const testUserId = req.headers['x-user-id'] as string | undefined;
  
  if (req.userId) {
    // Real session exists
    next();
  } else if (testUserId) {
    // Test mode - use header
    req.userId = testUserId;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Helper to get userId from request.
 * Works with both real auth and X-User-Id header.
 */
export function getUserId(req: Request): string | null {
  return req.userId ?? (req.headers['x-user-id'] as string | undefined) ?? null;
}
