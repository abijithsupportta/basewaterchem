// Role-based access utility
export type StaffRole = 'superadmin' | 'admin' | 'manager' | 'staff' | 'technician';

// Superadmin can do everything including delete
export function canDelete(role: StaffRole) {
  return role === 'superadmin' || role === 'admin';
}

// Superadmin and managers can manage staff and branches
export function canManageStaff(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager';
}

// Superadmin, manager, staff, and technician can create/edit
export function canCreateOrEdit(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager' || role === 'staff' || role === 'technician';
}

// Staff cannot access dashboard
export function canAccessDashboard(role: StaffRole) {
  return role !== 'staff';
}

// Only superadmin, admin, and manager can view staff module
export function canAccessStaffModule(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager';
}

// Superadmin and manager can manage branches
export function canManageBranches(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager';
}

export function canManageCustomers(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager';
}

export function canAssignTechnician(role: StaffRole) {
  return role === 'superadmin' || role === 'admin' || role === 'manager' || role === 'staff';
}

export function isTechnician(role: StaffRole) {
  return role === 'technician';
}

export function isSuperadmin(role: StaffRole) {
  return role === 'superadmin' || role === 'admin';
}
// ...add more as needed
