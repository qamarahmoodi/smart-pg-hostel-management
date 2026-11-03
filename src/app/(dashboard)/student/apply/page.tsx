'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, BedDouble, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { Hostel, RoomType } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preHostel = searchParams.get('hostel') || '';
  const preType = searchParams.get('type') || '';

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>(preHostel);
  const [selectedType, setSelectedType] = useState<string>(preType);
  const [notes, setNotes] = useState<string>('');

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch hostels and room types
  useEffect(() => {
    async function loadMeta() {
      try {
        const [hostelsRes, typesRes] = await Promise.all([
          fetch('/api/hostels').then((r) => r.json()),
          fetch('/api/room-types').then((r) => r.json()),
        ]);
        if (hostelsRes.success) setHostels(hostelsRes.data);
        if (typesRes.success) setRoomTypes(typesRes.data);
      } catch (err) {
        console.error('Failed to load application form meta:', err);
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedHostel || !selectedType) {
      setError('Please select both a preferred hostel and room category.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_hostel_id: parseInt(selectedHostel, 10),
          preferred_room_type_id: parseInt(selectedType, 10),
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to submit application.');
        setSubmitting(false);
        return;
      }

      router.push('/student/applications');
      router.refresh();
    } catch (err) {
      console.error('Submission error:', err);
      setError('A network error occurred while submitting. Please try again.');
      setSubmitting(false);
    }
  };

  const currentTypeDetails = roomTypes.find((rt) => String(rt.room_type_id) === selectedType);

  if (loadingMeta) {
    return <LoadingSpinner message="Loading application preferences..." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Apply for Accommodation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit your preferred PG/Hostel building and room sharing tier. Once reviewed, an administrator will allocate an available bed.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hostel Preference */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Preferred Hostel Property
            </label>
            <select
              required
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3.5 py-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Choose a Hostel --</option>
              {hostels.map((h) => (
                <option key={h.hostel_id} value={h.hostel_id}>
                  {h.hostel_name} ({h.address})
                </option>
              ))}
            </select>
          </div>

          {/* Room Type Preference */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-indigo-600" />
              Preferred Room Sharing Category
            </label>
            <select
              required
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3.5 py-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Choose Room Sharing Tier --</option>
              {roomTypes.map((rt) => (
                <option key={rt.room_type_id} value={rt.room_type_id}>
                  {rt.type_name} — {rt.capacity} bed(s) per room (₹{Number(rt.monthly_rent).toLocaleString('en-IN')}/mo)
                </option>
              ))}
            </select>
          </div>

          {/* Type details callout */}
          {currentTypeDetails && (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-900 font-semibold block">
                  {currentTypeDetails.type_name}
                </span>
                <span className="text-xs text-indigo-700">
                  Capacity: {currentTypeDetails.capacity} occupant(s)
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-indigo-900">
                  ₹{Number(currentTypeDetails.monthly_rent).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-indigo-600 block -mt-1">per month</span>
              </div>
            </div>
          )}

          {/* Custom Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              Special Notes / Preferences (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ground floor preference, quiet study environment, college start date..."
              className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading application form..." />}>
      <ApplyForm />
    </Suspense>
  );
}
