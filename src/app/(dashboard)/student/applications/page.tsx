'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, PlusCircle, Calendar, Building2, BedDouble } from 'lucide-react';

interface ApplicationItem {
  application_id: number;
  hostel_name: string;
  type_name: string;
  monthly_rent: number;
  capacity: number;
  application_date: string;
  status: string;
  notes?: string;
  room_number?: string;
}

export default function StudentApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApplications() {
      try {
        const res = await fetch('/api/applications');
        const data = await res.json();
        if (data.success) {
          setApplications(data.data);
        }
      } catch (err) {
        console.error('Failed to load applications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadApplications();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track the status of your accommodation applications and warden approvals.
          </p>
        </div>
        <Link
          href="/student/apply"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition shrink-0 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Apply for Accommodation
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching your applications..." />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No applications submitted yet"
          description="Ready to secure your room? Submit an application specifying your preferred hostel and room category."
          actionHref="/student/apply"
          actionLabel="Apply Now"
        />
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.application_id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    APP #{app.application_id}
                  </span>
                  <StatusBadge status={app.status} />
                  {app.room_number && (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Assigned Room: {app.room_number}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {app.hostel_name}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <BedDouble className="w-4 h-4 text-slate-400" />
                    {app.type_name} ({app.capacity} beds) • ₹{Number(app.monthly_rent).toLocaleString('en-IN')}/mo
                  </div>
                </div>

                {app.notes && (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">Notes / Remarks: </span>
                    {app.notes}
                  </div>
                )}
              </div>

              <div className="text-left md:text-right shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <div className="text-xs text-slate-400 flex items-center md:justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Submitted:{' '}
                  {new Date(app.application_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>

                {app.status === 'ALLOCATED' && (
                  <Link
                    href="/student/allocated-room"
                    className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    View Room Details &rarr;
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
