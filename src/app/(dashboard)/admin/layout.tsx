import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // RBAC guard: Prevent non-admins from accessing the admin portal
  if (user.role !== 'admin') {
    redirect('/student');
  }

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
