import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { query } from '@/lib/db/mysql';
import { StatusBadge } from '@/components/ui/Badge';
import {
  BedDouble,
  ClipboardList,
  KeyRound,
  FilePlus,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const user = (await getCurrentUser())!;

  // 1. Fetch student's most recent application
  const appRows = await query<RowDataPacket[]>(
    `SELECT a.*, h.hostel_name, rt.type_name, rt.monthly_rent
     FROM applications a
     JOIN hostels h ON a.preferred_hostel_id = h.hostel_id
     JOIN room_types rt ON a.preferred_room_type_id = rt.room_type_id
     WHERE a.student_id = ?
     ORDER BY a.application_date DESC
     LIMIT 1`,
    [user.user_id]
  );
  const latestApp = appRows[0] || null;

  // 2. Fetch student's active room allocation if any
  const allocRows = await query<RowDataPacket[]>(
    `SELECT al.*, r.room_number, r.floor, h.hostel_name, h.address, rt.type_name, rt.monthly_rent
     FROM allocations al
     JOIN rooms r ON al.room_id = r.room_id
     JOIN hostels h ON r.hostel_id = h.hostel_id
     JOIN room_types rt ON r.room_type_id = rt.room_type_id
     WHERE al.student_id = ? AND al.status = 'ACTIVE'
     LIMIT 1`,
    [user.user_id]
  );
  const activeAlloc = allocRows[0] || null;

  // 3. Fetch vacancies highlight from room_occupancy_summary view
  const availableRooms = await query<RowDataPacket[]>(
    `SELECT * FROM room_occupancy_summary 
     WHERE occupancy_status = 'AVAILABLE' 
     ORDER BY hostel_name, room_number 
     LIMIT 3`
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-100 border border-indigo-400/30 mb-3">
            Student Accommodation Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user.name}!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-indigo-100 leading-relaxed">
            Manage your accommodation requests, track application approvals, and review your allocated room details.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/student/rooms"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white text-indigo-900 hover:bg-indigo-50 shadow-sm transition"
            >
              <BedDouble className="w-4 h-4 text-indigo-600" />
              Browse Available Rooms
            </Link>
            {!activeAlloc && (!latestApp || latestApp.status === 'REJECTED') && (
              <Link
                href="/student/apply"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400 shadow-sm transition"
              >
                <FilePlus className="w-4 h-4" />
                Apply for Accommodation
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Status Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocated Room Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-slate-900">My Allocated Room</h3>
              </div>
              {activeAlloc && <StatusBadge status={activeAlloc.status} />}
            </div>

            {activeAlloc ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        Room {activeAlloc.room_number}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Floor {activeAlloc.floor}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-indigo-600">
                        ₹{Number(activeAlloc.monthly_rent).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400">Monthly Rent</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Hostel:</span>
                      <span className="font-medium text-slate-800">{activeAlloc.hostel_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Room Category:</span>
                      <span className="font-medium text-slate-800">{activeAlloc.type_name}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Allocated on:{' '}
                  {new Date(activeAlloc.allocation_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">You do not have an active room allocation yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Once your application is approved and allocated by a warden, your room details will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <Link
              href={activeAlloc ? '/student/allocated-room' : '/student/rooms'}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              {activeAlloc ? 'View Full Room Details' : 'Explore Vacancies'} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Current Application Status Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-slate-900">Application Status</h3>
              </div>
              {latestApp && <StatusBadge status={latestApp.status} />}
            </div>

            {latestApp ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Preferred Hostel:</span>
                    <span className="font-semibold text-slate-800">{latestApp.hostel_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Room Category:</span>
                    <span className="font-semibold text-slate-800">{latestApp.type_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Applied On:</span>
                    <span className="font-medium text-slate-700">
                      {new Date(latestApp.application_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {latestApp.notes && (
                    <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 block">Notes/Remarks:</span>
                      {latestApp.notes}
                    </div>
                  )}
                </div>

                {latestApp.status === 'PENDING' && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Your application is currently being reviewed by the hostel administration.
                  </p>
                )}
                {latestApp.status === 'APPROVED' && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Application approved! The warden will assign an available room shortly.
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">You haven&apos;t submitted any room applications yet.</p>
                <Link
                  href="/student/apply"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                >
                  <FilePlus className="w-3.5 h-3.5" /> Submit First Application
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <Link
              href="/student/applications"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View Application History <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Available Vacancies Live Highlights */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">Featured Available Rooms</h3>
              <p className="text-xs text-slate-500">Real-time room inventory from room_occupancy_summary view</p>
            </div>
          </div>
          <Link
            href="/student/rooms"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View All Rooms <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableRooms.map((room) => (
            <div
              key={room.room_id}
              className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">Room {room.room_number}</span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {room.available_beds} beds free
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">{room.hostel_name}</div>
                <div className="text-xs text-slate-400 mt-0.5">Floor {room.floor} • {room.type_name}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-600">
                  ₹{Number(room.monthly_rent).toLocaleString('en-IN')}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
                </span>
                <Link
                  href={`/student/apply?hostel=${room.hostel_id}&type=${room.room_type_id}`}
                  className="text-xs font-semibold text-slate-700 hover:text-indigo-600"
                >
                  Apply &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
