'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BedDouble, Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { RoomOccupancySummary, Hostel, RoomType } from '@/types';

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<RoomOccupancySummary[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedHostel, setSelectedHostel] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomOccupancySummary | null>(null);
  const [hostelId, setHostelId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [status, setStatus] = useState<'AVAILABLE' | 'OCCUPIED' | 'UNDER_MAINTENANCE'>('AVAILABLE');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<RoomOccupancySummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load hostels & room types
  useEffect(() => {
    async function loadMeta() {
      try {
        const [hRes, tRes] = await Promise.all([
          fetch('/api/hostels').then((r) => r.json()),
          fetch('/api/room-types').then((r) => r.json()),
        ]);
        if (hRes.success) setHostels(hRes.data);
        if (tRes.success) setRoomTypes(tRes.data);
      } catch (err) {
        console.error('Error fetching meta:', err);
      }
    }
    loadMeta();
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedHostel) params.append('hostel_id', selectedHostel);
      if (selectedType) params.append('room_type_id', selectedType);
      if (selectedStatus) params.append('occupancy_status', selectedStatus);

      const res = await fetch(`/api/rooms?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.data);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, selectedType, selectedStatus]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const openAddModal = () => {
    setEditingRoom(null);
    setHostelId(hostels[0]?.hostel_id ? String(hostels[0].hostel_id) : '');
    setRoomTypeId(roomTypes[0]?.room_type_id ? String(roomTypes[0].room_type_id) : '');
    setRoomNumber('');
    setFloor('1');
    setStatus('AVAILABLE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (r: RoomOccupancySummary) => {
    setEditingRoom(r);
    setHostelId(String(r.hostel_id));
    setRoomTypeId(String(r.room_type_id));
    setRoomNumber(r.room_number);
    setFloor(String(r.floor));
    setStatus(r.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const url = editingRoom ? `/api/rooms/${editingRoom.room_id}` : '/api/rooms';
      const method = editingRoom ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostel_id: parseInt(hostelId, 10),
          room_type_id: parseInt(roomTypeId, 10),
          room_number: roomNumber,
          floor: parseInt(floor, 10) || 1,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || 'Operation failed.');
        setFormLoading(false);
        return;
      }

      setIsModalOpen(false);
      fetchRooms();
    } catch (err) {
      console.error('Room form error:', err);
      setFormError('A network error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/rooms/${deleteTarget.room_id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to delete room.');
        setDeleteLoading(false);
        return;
      }

      setDeleteTarget(null);
      fetchRooms();
    } catch (err) {
      console.error('Delete room error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Inventory & Status</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage physical rooms, capacities, and maintenance locks across properties.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hostel</label>
          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white outline-none"
          >
            <option value="">All Hostels</option>
            {hostels.map((h) => (
              <option key={h.hostel_id} value={h.hostel_id}>
                {h.hostel_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sharing Tier</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white outline-none"
          >
            <option value="">All Sharing Tiers</option>
            {roomTypes.map((rt) => (
              <option key={rt.room_type_id} value={rt.room_type_id}>
                {rt.type_name} ({rt.capacity} beds)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Availability</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white outline-none"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="FULL">Full</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
          </select>
        </div>
      </div>

      {/* Rooms Table */}
      {loading ? (
        <LoadingSpinner message="Loading room inventory..." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Room</th>
                <th className="px-6 py-3.5">Hostel</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-center">Floor</th>
                <th className="px-6 py-3.5 text-center">Bed Occupancy</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Rent</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <tr key={r.room_id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-indigo-600" />
                    Room {r.room_number}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-800">{r.hostel_name}</td>
                  <td className="px-6 py-4 text-xs text-indigo-600 font-medium">{r.type_name}</td>
                  <td className="px-6 py-4 text-center text-xs font-medium">Floor {r.floor}</td>
                  <td className="px-6 py-4 text-center text-xs">
                    <span className="font-bold text-slate-900">{r.occupied_beds}</span> / {r.capacity} beds filled
                    <span className="block text-[10px] text-emerald-600 font-semibold">{r.available_beds} available</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={r.occupancy_status || r.status} />
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    ₹{Number(r.monthly_rent).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(r)}
                        title="Edit Room / Status"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        title="Delete Room"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel Property</label>
            <select
              required
              disabled={!!editingRoom}
              value={hostelId}
              onChange={(e) => setHostelId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white disabled:bg-slate-100 outline-none"
            >
              {hostels.map((h) => (
                <option key={h.hostel_id} value={h.hostel_id}>
                  {h.hostel_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number</label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 101, B-202"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Level</label>
              <input
                type="number"
                required
                min={0}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Room Category</label>
            <select
              required
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white outline-none"
            >
              {roomTypes.map((rt) => (
                <option key={rt.room_type_id} value={rt.room_type_id}>
                  {rt.type_name} ({rt.capacity} bed capacity)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Status</label>
            <select
              required
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white outline-none"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="OCCUPIED">OCCUPIED</option>
              <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Note: Database triggers automatically switch available status to OCCUPIED when beds fill.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {formLoading ? 'Saving...' : editingRoom ? 'Save Changes' : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Room"
        message={`Are you sure you want to delete Room "${deleteTarget?.room_number}"? You cannot delete rooms that have active student allocations.`}
        confirmLabel="Delete Room"
        isDestructive={true}
        isLoading={deleteLoading}
      />
    </div>
  );
}
