'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Building2, Plus, Edit2, Trash2, Phone, MapPin } from 'lucide-react';

interface HostelRecord {
  hostel_id: number;
  hostel_name: string;
  address: string;
  contact_number: string;
  total_rooms: number;
  total_capacity: number;
  occupied_beds: number;
  available_beds: number;
}

export default function AdminHostelsPage() {
  const [hostels, setHostels] = useState<HostelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<HostelRecord | null>(null);
  const [hostelName, setHostelName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<HostelRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchHostels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hostels');
      const data = await res.json();
      if (data.success) {
        setHostels(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch hostels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostels();
  }, []);

  const openAddModal = () => {
    setEditingHostel(null);
    setHostelName('');
    setAddress('');
    setContactNumber('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (h: HostelRecord) => {
    setEditingHostel(h);
    setHostelName(h.hostel_name);
    setAddress(h.address);
    setContactNumber(h.contact_number);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const url = editingHostel ? `/api/hostels/${editingHostel.hostel_id}` : '/api/hostels';
      const method = editingHostel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostel_name: hostelName,
          address,
          contact_number: contactNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || 'Operation failed.');
        setFormLoading(false);
        return;
      }

      setIsModalOpen(false);
      fetchHostels();
    } catch (err) {
      console.error('Hostel form submission error:', err);
      setFormError('A network error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/hostels/${deleteTarget.hostel_id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to delete hostel.');
        setDeleteLoading(false);
        return;
      }

      setDeleteTarget(null);
      fetchHostels();
    } catch (err) {
      console.error('Delete hostel error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Properties</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage physical PG & hostel buildings, addresses, and warden contact records.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add New Hostel
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading hostel records..." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Hostel Name</th>
                <th className="px-6 py-3.5">Address & Contact</th>
                <th className="px-6 py-3.5 text-center">Rooms</th>
                <th className="px-6 py-3.5 text-center">Capacity</th>
                <th className="px-6 py-3.5 text-center">Occupied</th>
                <th className="px-6 py-3.5 text-center">Available</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hostels.map((h) => (
                <tr key={h.hostel_id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      {h.hostel_name}
                    </div>
                    <span className="text-xs text-slate-400">ID #{h.hostel_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {h.address}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {h.contact_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{h.total_rooms}</td>
                  <td className="px-6 py-4 text-center font-semibold text-slate-900">{h.total_capacity}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-800">{h.occupied_beds}</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">{h.available_beds}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(h)}
                        title="Edit Hostel"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(h)}
                        title="Delete Hostel"
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

      {/* Add / Edit Hostel Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHostel ? 'Edit Hostel Property' : 'Add New Hostel Property'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel Name</label>
            <input
              type="text"
              required
              value={hostelName}
              onChange={(e) => setHostelName(e.target.value)}
              placeholder="e.g. Blue Lagoon Boys PG"
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Physical Address</label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 124 Tech Park Road, Whitefield, Bangalore"
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Warden Contact Number</label>
            <input
              type="text"
              required
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
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
              {formLoading ? 'Saving...' : editingHostel ? 'Save Changes' : 'Create Hostel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Hostel Property"
        message={`Are you sure you want to delete "${deleteTarget?.hostel_name}"? This action will cascade delete all rooms associated with this property.`}
        confirmLabel="Delete Property"
        isDestructive={true}
        isLoading={deleteLoading}
      />
    </div>
  );
}
