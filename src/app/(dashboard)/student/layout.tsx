import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // RBAC guard: Prevent admins from seeing student portal layout
  if (user.role !== 'student') {
    redirect('/admin');
  }

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
