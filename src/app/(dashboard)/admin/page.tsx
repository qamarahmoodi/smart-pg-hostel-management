import React from 'react';
import Link from 'next/link';
import { query } from '@/lib/db/mysql';
import { StatusBadge } from '@/components/ui/Badge';
import {
  Building2,
  BedDouble,
  Users,
  ClipboardList,
  KeyRound,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // 1. Fetch live aggregate metrics from MySQL
  const [statsRows] = await query<RowDataPacket[]>(`
    SELECT 
      (SELECT COUNT(*) FROM hostels) AS total_hostels,
      (SELECT COUNT(*) FROM rooms) AS total_rooms,
      (SELECT COALESCE(SUM(capacity), 0) FROM rooms r JOIN room_types rt ON r.room_type_id = rt.room_type_id) AS total_capacity,
      (SELECT COUNT(*) FROM allocations WHERE status = 'ACTIVE') AS occupied_beds,
      (SELECT COUNT(*) FROM applications WHERE status = 'PENDING') AS pending_applications,
      (SELECT COUNT(*) FROM applications WHERE status = 'APPROVED') AS approved_applications
  `);

  const stats = statsRows[0];
  const totalCapacity = Number(stats.total_capacity) || 0;
  const occupiedBeds = Number(stats.occupied_beds) || 0;
  const availableBeds = Math.max(0, totalCapacity - occupiedBeds);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

  // 2. Fetch hostel-level occupancy summary
  const hostelSummaries = await query<RowDataPacket[]>(`
    SELECT 
      h.hostel_id,
      h.hostel_name,
      h.contact_number,
      COUNT(DISTINCT r.room_id) AS room_count,
      COALESCE(SUM(rt.capacity), 0) AS bed_capacity,
      COUNT(DISTINCT CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END) AS occupied,
      (COALESCE(SUM(rt.capacity), 0) - COUNT(DISTINCT CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END)) AS available
    FROM hostels h
    LEFT JOIN rooms r ON h.hostel_id = r.hostel_id
    LEFT JOIN room_types rt ON r.room_type_id = rt.room_type_id
    LEFT JOIN allocations a ON r.room_id = a.room_id AND a.status = 'ACTIVE'
    GROUP BY h.hostel_id, h.hostel_name, h.contact_number
    ORDER BY h.hostel_id ASC
  `);

  // 3. Fetch recent 5 applications
  const recentApplications = await query<RowDataPacket[]>(`
    SELECT 
      a.application_id,
      u.name AS student_name,
      h.hostel_name,
      rt.type_name,
      a.application_date,
      a.status
    FROM applications a
    JOIN users u ON a.student_id = u.user_id
    JOIN hostels h ON a.preferred_hostel_id = h.hostel_id
    JOIN room_types rt ON a.preferred_room_type_id = rt.room_type_id
    ORDER BY a.application_date DESC
    LIMIT 5
  `);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warden Overview & Occupancy</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time hostel occupancy metrics, room capacities, and pending applicant workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/allocations"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
          >
            <KeyRound className="w-4 h-4" />
            Allocate Room
          </Link>
          <Link
            href="/admin/rooms"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm transition"
          >
            <BedDouble className="w-4 h-4 text-slate-500" />
            Manage Inventory
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Hostels & Rooms */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Properties & Rooms</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{stats.total_hostels} Hostels</div>
          <p className="text-xs text-slate-500 mt-1">{stats.total_rooms} physical rooms configured</p>
        </div>

        {/* Total Bed Capacity & Occupancy */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Bed Capacity</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{totalCapacity} Beds</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700">{occupancyRate}%</span>
          </div>
        </div>

        {/* Occupied vs Available */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Live Bed Status</span>
            <BedDouble className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{availableBeds}</span>
            <span className="text-sm font-medium text-emerald-600">vacant beds</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{occupiedBeds} currently assigned beds</p>
        </div>

        {/* Pending Applications */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Applications</span>
            <ClipboardList className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600">{stats.pending_applications}</div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.approved_applications} approved (ready for bed allocation)
          </p>
        </div>
      </div>

      {/* Property-Level Occupancy Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Property Occupancy Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">Physical bed capacity vs active allocations per hostel</p>
          </div>
          <Link
            href="/admin/hostels"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Manage Hostels <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Hostel Property</th>
                <th className="px-6 py-3.5">Contact</th>
                <th className="px-6 py-3.5">Total Rooms</th>
                <th className="px-6 py-3.5">Total Beds</th>
                <th className="px-6 py-3.5">Occupied</th>
                <th className="px-6 py-3.5">Available</th>
                <th className="px-6 py-3.5">Occupancy %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hostelSummaries.map((h) => {
                const cap = Number(h.bed_capacity) || 0;
                const occ = Number(h.occupied) || 0;
                const rate = cap > 0 ? Math.round((occ / cap) * 100) : 0;

                return (
                  <tr key={h.hostel_id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">{h.hostel_name}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{h.contact_number}</td>
                    <td className="px-6 py-4 font-medium">{h.room_count}</td>
                    <td className="px-6 py-4 font-medium">{cap}</td>
                    <td className="px-6 py-4 text-slate-900 font-bold">{occ}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">{h.available}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rate > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Applications Feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Student Applications</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest accommodation requests requiring warden action</p>
          </div>
          <Link
            href="/admin/applications"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Review All Applications <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">App ID</th>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Hostel & Category</th>
                <th className="px-6 py-3.5">Submission Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentApplications.map((app) => (
                <tr key={app.application_id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">#{app.application_id}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{app.student_name}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className="font-medium text-slate-800 block">{app.hostel_name}</span>
                    <span className="text-slate-500">{app.type_name}</span>
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
                    <Link
                      href="/admin/applications"
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Review &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
