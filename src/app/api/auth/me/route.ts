import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. No active session found.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user },
    });
  } catch (err: unknown) {
    console.error('[API /api/auth/me Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve user profile.' },
      { status: 500 }
    );
  }
}
