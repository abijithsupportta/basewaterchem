export type ExpenseCategory =
  | 'travel'
  | 'salary'
  | 'office'
  | 'utilities'
  | 'maintenance'
  | 'marketing'
  | 'purchase'
  | 'misc';

export interface Expense {
  id: string;
  expense_date: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  description: string | null;
  created_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFormData {
  expense_date: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  payment_method?: string;
  reference_no?: string;
  description?: string;
}
