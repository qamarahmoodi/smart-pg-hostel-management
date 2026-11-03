'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, CheckCircle2, XCircle, KeyRound, Filter, Building2, User, Calendar } from 'lucide-react';

interface ApplicationRow {
  application_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  preferred_hostel_id: number;
  hostel_name: string;
  preferred_room_type_id: number;
  type_name: string;
  monthly_rent: number;
  capacity: number;
  application_date: string;
  status: string;
  notes?: string;
  allocation_id?: number;
  room_number?: string;
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Review modal state
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/applications?status=${statusFilter}` : '/api/applications';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setApplications(data.data);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const openReviewModal = (app: ApplicationRow) => {
    setSelectedApp(app);
    setReviewNotes(app.notes || '');
    setActionError('');
  };

  const handleStatusUpdate = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionError('');

    try {
      const res = await fetch(`/api/applications/${selectedApp.application_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: reviewNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || 'Failed to update application.');
        setActionLoading(false);
        return;
      }

      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Update status error:', err);
      setActionError('A network error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review accommodation requests, issue warden approvals, or reject ineligible applications.
          </p>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-transparent outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved (Ready for Allocation)</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading student applications..." />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No applications found"
          description={
            statusFilter
              ? `No applications currently match the "${statusFilter}" status filter.`
              : 'No applications have been submitted by students yet.'
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">App ID</th>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Hostel & Category Preference</th>
                  <th className="px-6 py-3.5">Submitted On</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.application_id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-400 text-xs">#{app.application_id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{app.student_name}</div>
                      <div className="text-xs text-slate-500">{app.student_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-slate-800">{app.hostel_name}</div>
                      <div className="text-xs text-indigo-600 font-medium">
                        {app.type_name} • ₹{Number(app.monthly_rent).toLocaleString('en-IN')}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(app.application_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {app.status === 'APPROVED' ? (
                          <Link
                            href={`/admin/allocations?app_id=${app.application_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Allocate Bed
                          </Link>
                        ) : app.status === 'PENDING' ? (
                          <button
                            onClick={() => openReviewModal(app)}
                            className="px-3 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                          >
                            Review &rarr;
                          </button>
                        ) : (
                          <button
                            onClick={() => openReviewModal(app)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={selectedApp ? `Review Application #${selectedApp.application_id}` : ''}
        maxWidth="md"
      >
        {selectedApp && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-semibold text-slate-900">{selectedApp.student_name} ({selectedApp.student_email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preferred Hostel:</span>
                <span className="font-semibold text-slate-800">{selectedApp.hostel_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preferred Category:</span>
                <span className="font-semibold text-slate-800">{selectedApp.type_name} (₹{Number(selectedApp.monthly_rent).toLocaleString('en-IN')}/mo)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <StatusBadge status={selectedApp.status} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warden Notes & Remarks
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add remarks or justification for this decision..."
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>

              {selectedApp.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleStatusUpdate('REJECTED')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Application
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleStatusUpdate('APPROVED')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Application
                  </button>
                </div>
              ) : selectedApp.status === 'APPROVED' ? (
                <Link
                  href={`/admin/allocations?app_id=${selectedApp.application_id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  <KeyRound className="w-4 h-4" />
                  Proceed to Room Allocation &rarr;
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
