import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { query } from '@/lib/db/mysql';
import { RowDataPacket } from 'mysql2/promise';
import { UserRole } from '@/types';

const AUTH_SECRET = process.env.AUTH_SECRET || 'smart-pg-hostel-management-default-secret-key-32-chars';
const SECRET_KEY = new TextEncoder().encode(AUTH_SECRET);
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'smart_pg_session';
const MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '604800', 10); // 7 days

export interface SessionPayload {
  userId: number;
  email: string;
  role: UserRole;
  name: string;
  exp?: number;
  iat?: number;
}

export interface SafeUser {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

/**
 * Creates and signs a stateless JWT session token.
 */
export async function signSessionToken(payload: Omit<SessionPayload, 'exp' | 'iat'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(SECRET_KEY);
}

/**
 * Verifies a JWT session token and returns the payload.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sets the signed session cookie in the HTTP response headers.
 */
export async function createSession(user: {
  user_id: number;
  email: string;
  role: UserRole;
  name: string;
}): Promise<string> {
  const token = await signSessionToken({
    userId: user.user_id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });

  return token;
}

/**
 * Retrieves and validates the current session payload from cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Retrieves the current authenticated user and validates existence in MySQL.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const rows = await query<RowDataPacket[]>(
      'SELECT user_id, name, email, role, created_at FROM users WHERE user_id = ?',
      [session.userId]
    );

    if (!rows.length) return null;
    const dbUser = rows[0];

    return {
      user_id: dbUser.user_id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      created_at: dbUser.created_at,
    };
  } catch (err) {
    console.error('getCurrentUser Error:', err);
    return null;
  }
}

/**
 * Destroys the session by clearing the HTTP-only cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Guard utility for Route Handlers to ensure the caller is authenticated.
 * Returns the SafeUser or throws a structured HTTP error object.
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error: any = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const error: any = new Error('Access denied. Insufficient permissions.');
    error.status = 403;
    throw error;
  }

  return user;
}

/**
 * Guard utility for Route Handlers to enforce administrative access.
 */
export async function requireAdmin(): Promise<SafeUser> {
  return requireAuth(['admin']);
}
