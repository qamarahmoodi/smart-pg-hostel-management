'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { BedDouble, Filter, RotateCcw } from 'lucide-react';
import { RoomOccupancySummary, Hostel, RoomType } from '@/types';

export default function BrowseRoomsPage() {
  const [rooms, setRooms] = useState<RoomOccupancySummary[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [maxRent, setMaxRent] = useState<string>('');

  // Fetch filter metadata
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
        console.error('Error fetching filter metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch rooms with filters
  useEffect(() => {
    async function fetchRooms() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedHostel) params.append('hostel_id', selectedHostel);
        if (selectedType) params.append('room_type_id', selectedType);
        if (selectedStatus) params.append('occupancy_status', selectedStatus);
        if (maxRent) params.append('max_rent', maxRent);

        const res = await fetch(`/api/rooms?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setRooms(data.data);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRooms();
  }, [selectedHostel, selectedType, selectedStatus, maxRent]);

  const resetFilters = () => {
    setSelectedHostel('');
    setSelectedType('');
    setSelectedStatus('');
    setMaxRent('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Browse Rooms & Vacancies</h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore real-time room occupancies, bed capacities, and rates across our PG & hostel properties.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-indigo-600" />
            Filter Rooms
          </div>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Hostel Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hostel Property</label>
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Hostels</option>
              {hostels.map((h) => (
                <option key={h.hostel_id} value={h.hostel_id}>
                  {h.hostel_name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Room Sharing Category</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Categories</option>
              {roomTypes.map((rt) => (
                <option key={rt.room_type_id} value={rt.room_type_id}>
                  {rt.type_name} ({rt.capacity} beds)
                </option>
              ))}
            </select>
          </div>

          {/* Occupancy Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Availability</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available for Allocation</option>
              <option value="FULL">Fully Occupied</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            </select>
          </div>

          {/* Max Rent Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max Monthly Rent (₹)</label>
            <input
              type="number"
              placeholder="e.g. 10000"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Room Listing Grid */}
      {loading ? (
        <LoadingSpinner message="Querying live room occupancy summary..." />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms match your filter criteria"
          description="Try broadening your filters or resetting to view all rooms."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const roomStatus = String(room.status || room.occupancy_status || room.physical_status || 'AVAILABLE');
            const isAvailable = room.available_beds > 0 && roomStatus !== 'UNDER_MAINTENANCE' && roomStatus !== 'OCCUPIED';

            return (
              <div
                key={room.room_id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div className="p-6">
                  {/* Top Bar: Room # & Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                        Room {room.room_number}
                      </h3>
                      <p className="text-xs text-slate-500">Floor {room.floor}</p>
                    </div>
                    <StatusBadge status={room.occupancy_status || room.status} />
                  </div>

                  {/* Hostel Details */}
                  <div className="text-sm font-semibold text-slate-800">{room.hostel_name}</div>
                  <div className="text-xs text-indigo-600 font-medium mt-0.5">{room.type_name}</div>

                  {/* Bed Occupancy Meter */}
                  <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-500">Bed Occupancy</span>
                      <span className="font-semibold text-slate-800">
                        {room.occupied_beds} / {room.capacity} beds filled
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          room.available_beds === 0
                            ? 'bg-rose-500'
                            : room.occupied_beds > 0
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(room.occupied_beds / room.capacity) * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                      <span>Available beds: <strong className="text-slate-800">{room.available_beds}</strong></span>
                      <span className="capitalize">{(room.status || room.occupancy_status || room.physical_status || 'AVAILABLE').toLowerCase().replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Price & Apply Action */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-slate-900">
                      ₹{Number(room.monthly_rent).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-500 block -mt-1">per month</span>
                  </div>

                  {isAvailable ? (
                    <Link
                      href={`/student/apply?hostel=${room.hostel_id}&type=${room.room_type_id}`}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                    >
                      Apply Now
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg cursor-not-allowed">
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
