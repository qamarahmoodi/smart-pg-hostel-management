'use client';

import React, { useState, useEffect } from 'react';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KeyRound, Building2, MapPin, Calendar, Users, DollarSign, Layers } from 'lucide-react';

interface AllocationDetails {
  allocation_id: number;
  room_id: number;
  room_number: string;
  floor: number;
  hostel_id: number;
  hostel_name: string;
  type_name: string;
  capacity: number;
  monthly_rent: number;
  allocation_date: string;
  start_date: string;
  status: string;
}

export default function StudentAllocatedRoomPage() {
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllocation() {
      try {
        const res = await fetch('/api/allocations?status=ACTIVE');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          setAllocation(data.data[0]);
        }
      } catch (err) {
        console.error('Failed to load allocation details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllocation();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Retrieving your room allocation details..." />;
  }

  if (!allocation) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Allocated Room</h1>
          <p className="text-sm text-slate-500 mt-1">Review physical accommodation and lease details.</p>
        </div>
        <EmptyState
          icon={KeyRound}
          title="No active room allocation found"
          description="You have not been assigned to a room yet. Submit an application or check with your hostel warden."
          actionHref="/student/apply"
          actionLabel="Apply for Accommodation"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Allocated Room</h1>
            <p className="text-sm text-slate-500 mt-1">
              Your official accommodation and bed allocation record.
            </p>
          </div>
          <StatusBadge status={allocation.status} />
        </div>
      </div>

      {/* Main Room Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-indigo-600 px-6 py-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider block">
              Allocated Room
            </span>
            <div className="text-3xl font-extrabold tracking-tight mt-0.5">
              Room {allocation.room_number}
            </div>
            <div className="text-sm text-indigo-100 flex items-center gap-1.5 mt-1">
              <Building2 className="w-4 h-4" />
              {allocation.hostel_name}
            </div>
          </div>

          <div className="sm:text-right bg-indigo-700/50 p-3 sm:p-4 rounded-xl border border-indigo-500/30">
            <div className="text-2xl font-black text-white">
              ₹{Number(allocation.monthly_rent).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-indigo-200">Monthly Rent</div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
              <Layers className="w-4 h-4 text-indigo-600" /> Floor Level
            </div>
            <div className="text-base font-bold text-slate-900">Floor {allocation.floor}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
              <Users className="w-4 h-4 text-indigo-600" /> Room Sharing Tier
            </div>
            <div className="text-base font-bold text-slate-900">{allocation.type_name}</div>
            <div className="text-xs text-slate-500">{allocation.capacity} Bed Capacity</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
              <Calendar className="w-4 h-4 text-indigo-600" /> Start Date
            </div>
            <div className="text-base font-bold text-slate-900">
              {new Date(allocation.start_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 sm:px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>Allocation ID: <code className="bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-800">#{allocation.allocation_id}</code></div>
        </div>
      </div>
    </div>
  );
}
