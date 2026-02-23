'use client';

import { useEffect, useState } from 'react';
import { useUserRole } from '@/lib/use-user-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';
import { canAccessStaffModule, canDelete } from '@/lib/authz';
import { useBranchSelection } from '@/hooks/use-branch-selection';
import { useBranches } from '@/hooks/use-branches';

// Only allow adding these roles (no admin/superadmin)
const ADDABLE_STAFF_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'technician', label: 'Technician' },
];

type RoleOption = typeof ADDABLE_STAFF_ROLES[number]['value'];

type StaffItem = {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  role: RoleOption | 'admin' | 'superadmin';
  branch_id: string | null;
  is_active: boolean;
  phone: string | null;
  created_at: string;
  updated_at: string;
  branch?: {
    id: string;
    branch_name: string;
    branch_code: string;
  };
};

export default function StaffPage() {
  const userRole = useUserRole();
  const { selectedBranchId } = useBranchSelection();
  const { branches } = useBranches();
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<RoleOption>('staff');
  const [branchId, setBranchId] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const staffResponse = await fetch('/api/staff');
        const staffPayload = await staffResponse.json();

        if (!staffResponse.ok) {
          throw new Error(staffPayload?.error?.message || 'Failed to load staff');
        }

        setStaffList(staffPayload.data ?? []);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (canAccessStaffModule(userRole)) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  if (loading) {
    return <Loading />;
  }

  if (!canAccessStaffModule(userRole)) {
    return <div className="p-8 text-center text-red-600">Access denied.</div>;
  }

  const filteredStaffList =
    selectedBranchId === 'all'
      ? staffList
      : staffList.filter((staff) => staff.branch_id === selectedBranchId);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setRole('staff');
    setBranchId('');
    setShowAddModal(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role,
          branch_id: branchId || null,
          is_active: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to create staff');
      }

      setStaffList((prev) => [payload.data, ...prev]);
      toast.success('Staff created successfully');
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStaff = async (staff: StaffItem, makeActive: boolean) => {
    setUpdatingId(staff.id);
    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id, is_active: makeActive }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to update staff status');
      }

      setStaffList((prev) => prev.map((s) => (s.id === staff.id ? payload.data : s)));
      toast.success(makeActive ? 'Staff activated' : 'Staff deactivated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteStaff = async (staff: StaffItem) => {
    const confirmed = window.confirm(
      `Delete ${staff.full_name}? This removes both staff database record and Supabase auth user.`
    );
    if (!confirmed) return;

    setUpdatingId(staff.id);
    try {
      const response = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to delete staff');
      }

      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      toast.success('Staff deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage staff members and their branch assignments.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
          + Add Staff
        </Button>
      </div>

      {/* Staff List */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {filteredStaffList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No staff members found. Click "Add Staff" to create one.</p>
          </div>
        ) : (
          <table className="w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left font-medium text-gray-700">Name</th>
                <th className="p-3 text-left font-medium text-gray-700">Email</th>
                <th className="p-3 text-left font-medium text-gray-700">Role</th>
                <th className="p-3 text-left font-medium text-gray-700">Branch</th>
                <th className="p-3 text-left font-medium text-gray-700">Phone</th>
                <th className="p-3 text-left font-medium text-gray-700">Status</th>
                <th className="p-3 text-left font-medium text-gray-700">Created</th>
                <th className="p-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffList.map((staff) => (
                <tr key={staff.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{staff.full_name}</td>
                  <td className="p-3 text-gray-600">{staff.email}</td>
                  <td className="p-3 capitalize">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
                      {staff.role}
                    </span>
                  </td>
                  <td className="p-3">
                    {staff.branch ? (
                      <span className="text-gray-700">
                        {staff.branch.branch_name} ({staff.branch.branch_code})
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{staff.phone || '-'}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        staff.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-s text-gray-500">
                    {new Date(staff.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === staff.id}
                        onClick={() => handleToggleStaff(staff, !staff.is_active)}
                      >
                        {staff.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      {canDelete(userRole) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updatingId === staff.id}
                          onClick={() => handleDeleteStaff(staff)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Add New Staff</h2>
              <p className="mt-1 text-sm text-gray-500">Only Manager, Staff, and Technician roles can be added.</p>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <Input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Role *</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleOption)}
                >
                  {ADDABLE_STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Assign to Branch (Optional)</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">-- No Branch Assigned --</option>
                  {branches.length === 0 ? (
                    <option disabled>No branches available</option>
                  ) : (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_name} ({b.branch_code})
                      </option>
                    ))
                  )}
                </select>
                {branches.length === 0 && (
                  <p className="mt-1 text-xs text-orange-600">⚠️ No branches available. Create a branch first.</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {submitting ? 'Adding...' : 'Add Staff'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Backdrop Click Handler */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-40"
          onClick={resetForm}
        />
      )}
    </div>
  );
}
