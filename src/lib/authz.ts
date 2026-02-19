// Role-based access utility
export type StaffRole = 'admin' | 'manager' | 'staff' | 'technician';

export function canDelete(role: StaffRole) {
  return role === 'admin';
}

export function canManageStaff(role: StaffRole) {
  return role === 'admin';
}

export function canCreateOrEdit(role: StaffRole) {
  return role === 'admin' || role === 'manager' || role === 'staff';
}

export function canManageCustomers(role: StaffRole) {
  return role === 'admin' || role === 'manager';
}

export function canAssignTechnician(role: StaffRole) {
  return role === 'admin' || role === 'manager' || role === 'staff';
}

export function isTechnician(role: StaffRole) {
  return role === 'technician';
}
// ...add more as needed
