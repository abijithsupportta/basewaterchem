export interface Branch {
  id: string;
  branch_code: string;
  branch_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface BranchFormData {
  branch_code: string;
  branch_name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  manager_id?: string | null;
  is_active?: boolean;
}
