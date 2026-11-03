'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { SafeUser } from '@/lib/auth/session';

interface NavbarProps {
  user: SafeUser;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4 sm:px-6">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-900 tracking-tight">Smart PG</span>
            <span className="text-xs text-slate-500 block -mt-1 font-medium">Hostel Management</span>
          </div>
        </Link>
      </div>

      {/* Right side: User Session + Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs">
            {user.role === 'admin' ? (
              <Shield className="w-4 h-4 text-indigo-600" />
            ) : (
              <UserIcon className="w-4 h-4 text-slate-500" />
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold text-slate-900 leading-none">{user.name}</div>
            <div className="text-xs text-slate-500 mt-1 capitalize flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'admin' ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
              {user.role}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </header>
  );
}
