// Role-based access utility
export type StaffRole = 'superadmin' | 'manager' | 'staff' | 'technician';

// Only superadmin can delete
export function canDelete(role: StaffRole) {
  return role === 'superadmin';
}

// Only superadmin can manage staff
export function canManageStaff(role: StaffRole) {
  return role === 'superadmin' || role === 'manager';
}

// Superadmin, manager, staff, and technician can create/edit
export function canCreateOrEdit(role: StaffRole) {
  return role === 'superadmin' || role === 'manager' || role === 'staff' || role === 'technician';
}

// Staff cannot access dashboard
export function canAccessDashboard(role: StaffRole) {
  return role !== 'staff';
}

// Only superadmin can view staff module
export function canAccessStaffModule(role: StaffRole) {
  return role === 'superadmin' || role === 'manager';
}

// Superadmin and manager can manage branches
export function canManageBranches(role: StaffRole) {
  return role === 'superadmin' || role === 'manager';
}

export function canManageCustomers(role: StaffRole) {
  return role === 'superadmin' || role === 'manager';
}

export function canAssignTechnician(role: StaffRole) {
  return role === 'superadmin' || role === 'manager' || role === 'staff';
}

export function isTechnician(role: StaffRole) {
  return role === 'technician';
}

export function isSuperadmin(role: StaffRole) {
  return role === 'superadmin';
}
// ...add more as needed
