import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err: unknown) {
    console.error('[API /api/auth/logout Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to log out.' },
      { status: 500 }
    );
  }
}
