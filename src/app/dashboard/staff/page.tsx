'use client';

import { useEffect, useState } from 'react';
import { useUserRole } from '@/lib/use-user-role';
import { STAFF_ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';

type RoleOption = (typeof STAFF_ROLES)[number]['value'];

type StaffItem = {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  role: RoleOption;
  is_active: boolean;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export default function StaffPage() {
  const userRole = useUserRole();
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<RoleOption>('staff');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const response = await fetch('/api/staff');
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error?.message || 'Failed to load staff');
        }
        setStaffList(payload.data ?? []);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    };

    if (userRole === 'admin') {
      loadStaff();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  if (loading) {
    return <Loading />;
  }

  if (userRole !== 'admin') {
    return <div className="p-8 text-center text-red-600">Access denied.</div>;
  }

  const handleAddStaff = async () => {
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
          is_active: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to create staff');
      }

      setStaffList((prev) => [payload.data, ...prev]);
      setName('');
      setEmail('');
      setPhone('');
      setRole('staff');
      toast.success('Staff created successfully');
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
      toast.success(makeActive ? 'Staff activated successfully' : 'Staff deactivated successfully');
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
      toast.success('Staff deleted from database and auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Staff Management</h1>
      <p>Only admin can access this module.</p>
      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead>
          <tr>
            <th className="border p-2 text-left">Name</th>
            <th className="border p-2 text-left">Role</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-left">Phone</th>
            <th className="border p-2 text-left">Created</th>
            <th className="border p-2 text-left">Updated</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map((staff) => (
            <tr key={staff.id}>
              <td className="border p-2">{staff.full_name}</td>
              <td className="border p-2">{staff.role}</td>
              <td className="border p-2">{staff.is_active ? 'Active' : 'Inactive'}</td>
              <td className="border p-2">{staff.email}</td>
              <td className="border p-2">{staff.phone || '-'}</td>
              <td className="border p-2">{new Date(staff.created_at).toLocaleDateString()}</td>
              <td className="border p-2">{new Date(staff.updated_at).toLocaleDateString()}</td>
              <td className="border p-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={updatingId === staff.id}
                    onClick={() => handleToggleStaff(staff, !staff.is_active)}
                  >
                    {staff.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={updatingId === staff.id}
                    onClick={() => handleDeleteStaff(staff)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddStaff();
        }}
      >
        <Input name="name" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input name="email" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as RoleOption)}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Input name="phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="sm:col-span-4">
          <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Staff'}</Button>
        </div>
      </form>
    </div>
  );
}
