import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { SafeUser } from '@/lib/auth/session';

interface DashboardLayoutProps {
  user: SafeUser;
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} />
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="hidden md:block shrink-0">
          <Sidebar role={user.role} />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
