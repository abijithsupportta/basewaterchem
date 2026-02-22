export type UserRole = 'superadmin' | 'admin' | 'manager' | 'staff' | 'technician';

export interface Staff {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  branch_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  branch?: {
    id: string;
    branch_name: string;
    branch_code: string;
  };
}

export interface StaffFormData {
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branch_id?: string | null;
  is_active?: boolean;
}
