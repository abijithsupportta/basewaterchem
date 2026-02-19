'use client';

import { useState } from 'react';
import { useUserRole } from '@/lib/use-user-role';
import { STAFF_ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RoleOption = (typeof STAFF_ROLES)[number]['value'];

type StaffItem = {
  id: number;
  name: string;
  email: string;
  role: RoleOption;
  is_active: boolean;
  phone: string;
  created_at: string;
  updated_at: string;
};

const INITIAL_STAFF: StaffItem[] = [
  { id: 1, name: 'John Doe', email: 'john.doe@example.com', role: 'admin', is_active: true, phone: '123-456-7890', created_at: '2023-01-01', updated_at: '2023-01-02' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', role: 'staff', is_active: false, phone: '987-654-3210', created_at: '2023-01-02', updated_at: '2023-01-03' },
];

export default function StaffPage() {
  const userRole = useUserRole();
  const [staffList, setStaffList] = useState<StaffItem[]>(INITIAL_STAFF);
  const [role, setRole] = useState<RoleOption>('staff');

  if (userRole === 'staff' || userRole === 'technician') {
    return <div className="p-8 text-center text-red-600">Access denied.</div>;
  }

  const handleAddStaff = (staff: Omit<StaffItem, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
    const now = new Date().toISOString();
    setStaffList((prev) => [
      ...prev,
      {
        ...staff,
        id: prev.length ? Math.max(...prev.map((s) => s.id)) + 1 : 1,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  };

  const handleDelete = (id: number) => {
    setStaffList((prev) => prev.filter((staff) => staff.id !== id));
  };

  const handleToggleActive = (id: number) => {
    setStaffList((prev) =>
      prev.map((staff) =>
        staff.id === id
          ? { ...staff, is_active: !staff.is_active, updated_at: new Date().toISOString() }
          : staff
      )
    );
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Staff Management</h1>
      <p>Only admin/manager can access. Staff/technician cannot access.</p>
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
              <td className="border p-2">{staff.name}</td>
              <td className="border p-2">{staff.role}</td>
              <td className="border p-2">{staff.is_active ? 'Active' : 'Inactive'}</td>
              <td className="border p-2">{staff.email}</td>
              <td className="border p-2">{staff.phone}</td>
              <td className="border p-2">{new Date(staff.created_at).toLocaleDateString()}</td>
              <td className="border p-2">{new Date(staff.updated_at).toLocaleDateString()}</td>
              <td className="border p-2 space-x-2">
                {(userRole === 'admin' || userRole === 'manager') && (
                  <Button onClick={() => handleToggleActive(staff.id)} size="sm" variant="outline">
                    {staff.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
                {userRole === 'admin' && (
                  <Button onClick={() => handleDelete(staff.id)} size="sm" variant="destructive">
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleAddStaff({
            name: String(formData.get('name') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            role,
            phone: String(formData.get('phone') || '').trim(),
          });
          e.currentTarget.reset();
          setRole('staff');
        }}
      >
        <Input name="name" placeholder="Name" required />
        <Input name="email" type="email" placeholder="Email" required />
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
        <Input name="phone" placeholder="Phone" required />
        <div className="sm:col-span-4">
          <Button type="submit">Add Staff</Button>
        </div>
      </form>
    </div>
  );
}
