import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { comparePassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user record from MySQL
    const rows = await query<RowDataPacket[]>(
      'SELECT user_id, name, email, password_hash, role FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const dbUser = rows[0];

    // Verify bcrypt password hash
    const isValid = await comparePassword(password, dbUser.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const safeUser = {
      user_id: dbUser.user_id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    };

    // Issue signed session cookie
    await createSession(safeUser);

    return NextResponse.json({
      success: true,
      data: { user: safeUser },
      message: 'Login successful.',
    });
  } catch (err: unknown) {
    console.error('[API /api/auth/login Error]:', err);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred during login.' },
      { status: 500 }
    );
  }
}
