'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  KeyRound,
  Plus,
  Ban,
  Filter,
  Search,
  Calendar,
  Building2,
  BedDouble,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AllocationRow {
  allocation_id: number;
  application_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  room_id: number;
  room_number: string;
  floor: number;
  hostel_id: number;
  hostel_name: string;
  room_type_id: number;
  type_name: string;
  capacity: number;
  monthly_rent: number;
  allocation_date: string;
  start_date: string;
  end_date?: string | null;
  status: 'ACTIVE' | 'TERMINATED';
}

interface ApprovedApp {
  application_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  preferred_hostel_id: number;
  hostel_name: string;
  preferred_room_type_id: number;
  type_name: string;
  monthly_rent: number;
  status: string;
}

interface AvailableRoom {
  room_id: number;
  room_number: string;
  floor: number;
  hostel_id: number;
  hostel_name: string;
  room_type_id: number;
  type_name: string;
  capacity: number;
  occupied_places: number;
  available_places: number;
  monthly_rent: number;
}

function AllocationsContent() {
  const searchParams = useSearchParams();
  const prefillAppId = searchParams.get('app_id');

  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostelFilter, setHostelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New Allocation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvedApps, setApprovedApps] = useState<ApprovedApp[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocSubmitting, setAllocSubmitting] = useState(false);
  const [allocError, setAllocError] = useState('');
  const [allocSuccessMsg, setAllocSuccessMsg] = useState('');

  // Termination Dialog state
  const [terminateTarget, setTerminateTarget] = useState<AllocationRow | null>(null);
  const [terminating, setTerminating] = useState(false);

  // Success banner
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Load allocations
  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (hostelFilter) params.append('hostel_id', hostelFilter);
      const res = await fetch(`/api/allocations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAllocations(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch allocations:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, hostelFilter]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // Load approved applications & vacant rooms for the allocation modal
  const loadAllocationPrerequisites = async () => {
    try {
      const [appsRes, roomsRes] = await Promise.all([
        fetch('/api/applications?status=APPROVED').then((r) => r.json()),
        fetch('/api/rooms?available_only=true').then((r) => r.json()),
      ]);

      if (appsRes.success) setApprovedApps(appsRes.data);
      if (roomsRes.success) setAvailableRooms(roomsRes.data);
    } catch (err) {
      console.error('Failed to load allocation prerequisites:', err);
    }
  };

  // If URL has ?app_id=..., auto-open the modal and select that application
  useEffect(() => {
    if (prefillAppId) {
      setSelectedAppId(prefillAppId);
      setIsModalOpen(true);
      loadAllocationPrerequisites();
    }
  }, [prefillAppId]);

  const handleOpenModal = () => {
    setAllocError('');
    setSelectedAppId(prefillAppId || '');
    setSelectedRoomId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
    loadAllocationPrerequisites();
  };

  // Handle stored procedure room allocation
  const handleAllocateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId || !selectedRoomId || !startDate) {
      setAllocError('Please select an application, room, and start date.');
      return;
    }

    setAllocSubmitting(true);
    setAllocError('');

    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: selectedAppId,
          room_id: selectedRoomId,
          start_date: startDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAllocError(data.message || 'Room allocation failed.');
        setAllocSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      setBannerNotice(`Room successfully allocated! (Allocation #${data.data.allocation_id})`);
      fetchAllocations();
    } catch (err) {
      console.error('Error during room allocation:', err);
      setAllocError('A network error occurred during allocation.');
    } finally {
      setAllocSubmitting(false);
    }
  };

  // Handle allocation termination
  const handleTerminateAllocation = async () => {
    if (!terminateTarget) return;
    setTerminating(true);

    try {
      const res = await fetch(`/api/allocations/${terminateTarget.allocation_id}/terminate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to terminate allocation.');
        setTerminating(false);
        return;
      }

      setBannerNotice(
        `Allocation #${terminateTarget.allocation_id} for ${terminateTarget.student_name} terminated. Bed freed up.`
      );
      setTerminateTarget(null);
      fetchAllocations();
    } catch (err) {
      console.error('Termination error:', err);
      alert('A network error occurred while terminating allocation.');
    } finally {
      setTerminating(false);
    }
  };

  // Filtered allocations based on search
  const filteredAllocations = useMemo(() => {
    if (!searchQuery) return allocations;
    const q = searchQuery.toLowerCase();
    return allocations.filter(
      (a) =>
        a.student_name.toLowerCase().includes(q) ||
        a.student_email.toLowerCase().includes(q) ||
        a.room_number.toLowerCase().includes(q) ||
        a.hostel_name.toLowerCase().includes(q) ||
        String(a.allocation_id).includes(q)
    );
  }, [allocations, searchQuery]);

  // Aggregate stats
  const activeCount = allocations.filter((a) => a.status === 'ACTIVE').length;
  const terminatedCount = allocations.filter((a) => a.status === 'TERMINATED').length;

  // Selected app details for room matching recommendation
  const currentApp = useMemo(
    () => approvedApps.find((app) => String(app.application_id) === String(selectedAppId)),
    [approvedApps, selectedAppId]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Allocations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Execute atomic room assignments via ACID stored procedures and manage occupant records.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          New Allocation
        </button>
      </div>

      {/* Notice Banner */}
      {bannerNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{bannerNotice}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Allocations</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{allocations.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Occupants</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <BedDouble className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Terminated Records</p>
            <p className="text-2xl font-bold text-slate-500 mt-1">{terminatedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, email, room #, hostel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="TERMINATED">Terminated Only</option>
          </select>
        </div>
      </div>

      {/* Allocations Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <LoadingSpinner message="Loading room allocations..." />
        </div>
      ) : filteredAllocations.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No allocations found"
          description="There are no allocations matching your filter criteria. Create a new allocation to assign a room to an approved applicant."
          actionLabel="New Allocation"
          actionOnClick={handleOpenModal}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Room & Hostel</th>
                  <th className="px-6 py-3.5">Category & Rent</th>
                  <th className="px-6 py-3.5">Tenure</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllocations.map((alloc) => (
                  <tr key={alloc.allocation_id} className="hover:bg-slate-50/75 transition">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                      #{alloc.allocation_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{alloc.student_name}</div>
                      <div className="text-xs text-slate-500">{alloc.student_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <BedDouble className="w-4 h-4 text-indigo-600" />
                        Room {alloc.room_number} <span className="text-xs font-normal text-slate-500">(Fl. {alloc.floor})</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {alloc.hostel_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-800">{alloc.type_name}</div>
                      <div className="text-xs font-semibold text-slate-900 mt-0.5">
                        ₹{Number(alloc.monthly_rent).toLocaleString('en-IN')}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">From:</span> {new Date(alloc.start_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      {alloc.end_date && (
                        <div className="mt-0.5 text-slate-500">
                          <span className="text-slate-400">To:</span> {new Date(alloc.end_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={alloc.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {alloc.status === 'ACTIVE' ? (
                        <button
                          onClick={() => setTerminateTarget(alloc)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Vacate / Terminate
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Allocation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Atomic Room Allocation"
        maxWidth="lg"
      >
        <form onSubmit={handleAllocateRoom} className="space-y-4">
          <p className="text-xs text-slate-500">
            Assigns a student to a room via stored procedure <code className="text-indigo-600 font-mono">sp_allocate_room</code>. Enforces capacity checks and pessimistic row locking to prevent over-allocation.
          </p>

          {allocError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{allocError}</span>
            </div>
          )}

          {/* 1. Approved Application Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Approved Application *
            </label>
            {approvedApps.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                No approved applications available. Approve an application in the Applications portal first.
              </div>
            ) : (
              <select
                required
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Choose an Approved Application --</option>
                {approvedApps.map((app) => (
                  <option key={app.application_id} value={app.application_id}>
                    #{app.application_id} - {app.student_name} ({app.hostel_name} - {app.type_name})
                  </option>
                ))}
              </select>
            )}

            {currentApp && (
              <div className="mt-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-semibold text-slate-900">{currentApp.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Preferred Hostel:</span>
                  <span className="font-semibold text-slate-900">{currentApp.hostel_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Preferred Category:</span>
                  <span className="font-semibold text-slate-900">{currentApp.type_name} (₹{Number(currentApp.monthly_rent).toLocaleString('en-IN')}/mo)</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Room Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Available Room *
            </label>
            {availableRooms.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                No rooms currently have available vacancies. Add rooms or vacate existing allocations.
              </div>
            ) : (
              <select
                required
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Choose a Room with Vacant Places --</option>
                {availableRooms.map((room) => {
                  const isMatch =
                    currentApp &&
                    room.hostel_id === currentApp.preferred_hostel_id &&
                    room.room_type_id === currentApp.preferred_room_type_id;

                  return (
                    <option key={room.room_id} value={room.room_id}>
                      {isMatch ? '★ [MATCH] ' : ''}Room {room.room_number} ({room.hostel_name} • {room.type_name} • {room.available_places} place(s) left)
                    </option>
                  );
                })}
              </select>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Rooms marked with ★ match the applicant&apos;s preferred hostel and room category.
            </p>
          </div>

          {/* 3. Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Allocation Start Date *
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={allocSubmitting || approvedApps.length === 0 || availableRooms.length === 0}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {allocSubmitting ? 'Allocating Bed...' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Terminate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!terminateTarget}
        title="Terminate Allocation & Vacate Bed"
        message={
          terminateTarget
            ? `Are you sure you want to terminate Allocation #${terminateTarget.allocation_id} for ${terminateTarget.student_name} in Room ${terminateTarget.room_number}? This will set the allocation status to TERMINATED and increment vacant places in ${terminateTarget.hostel_name}.`
            : ''
        }
        confirmLabel="Terminate Allocation"
        isDestructive={true}
        isLoading={terminating}
        onConfirm={handleTerminateAllocation}
        onClose={() => setTerminateTarget(null)}
      />
    </div>
  );
}

export default function AdminAllocationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center">
          <LoadingSpinner message="Loading room allocations..." />
        </div>
      }
    >
      <AllocationsContent />
    </Suspense>
  );
}
