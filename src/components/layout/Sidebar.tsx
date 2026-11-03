'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  ClipboardList,
  KeyRound,
  FilePlus,
  Shield,
  GraduationCap,
} from 'lucide-react';
import { UserRole } from '@/types';

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const studentNavItems = [
    { label: 'Overview', href: '/student', icon: LayoutDashboard },
    { label: 'Browse Rooms', href: '/student/rooms', icon: BedDouble },
    { label: 'Apply for Bed', href: '/student/apply', icon: FilePlus },
    { label: 'My Applications', href: '/student/applications', icon: ClipboardList },
    { label: 'My Allocated Room', href: '/student/allocated-room', icon: KeyRound },
  ];

  const adminNavItems = [
    { label: 'Occupancy Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Hostel Properties', href: '/admin/hostels', icon: Building2 },
    { label: 'Room Inventory', href: '/admin/rooms', icon: BedDouble },
    { label: 'Student Applications', href: '/admin/applications', icon: ClipboardList },
    { label: 'Room Allocations', href: '/admin/allocations', icon: KeyRound },
  ];

  const navItems = role === 'admin' ? adminNavItems : studentNavItems;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Role Banner */}
        <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
          {role === 'admin' ? (
            <div className="h-7 w-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          ) : (
            <div className="h-7 w-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              {role === 'admin' ? 'Warden Portal' : 'Student Portal'}
            </div>
            <div className="text-[11px] text-slate-500">
              {role === 'admin' ? 'Full Management Access' : 'Accommodation Services'}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 px-3">
        Smart PG & Hostel v1.0 • DBMS Level 3
      </div>
    </aside>
  );
}
