import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, message: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for duplicate email
    const existing = await query<RowDataPacket[]>(
      'SELECT user_id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Hash password & insert student record
    const passwordHash = await hashPassword(password);
    const result = await query<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "student")',
      [name.trim(), normalizedEmail, passwordHash]
    );

    const newUserId = result.insertId;
    const safeUser = {
      user_id: newUserId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'student' as const,
    };

    // Create stateless session cookie
    await createSession(safeUser);

    // Record activity log in MongoDB post-commit
    await logActivity({
      action: 'STUDENT_REGISTERED',
      performedBy: newUserId,
      targetType: 'user',
      targetId: newUserId,
      studentId: newUserId,
      details: {
        name: safeUser.name,
        email: safeUser.email,
        registrationDate: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { user: safeUser },
        message: 'Account registered successfully.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed.';
    console.error('[API /api/auth/register Error]:', err);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred during registration.' },
      { status: 500 }
    );
  }
}
