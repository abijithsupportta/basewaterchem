-- ============================================
-- Migration 027: Branch Deletion Reassignment
-- ============================================
-- When a branch is deleted, reassign all data to default branch (HO)
-- This prevents data loss and maintains referential integrity

-- Drop existing FK constraints that don't have ON DELETE SET DEFAULT
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_branch_id_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_branch_id_fkey;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_branch_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_branch_id_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_branch_id_fkey;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_branch_id_fkey;
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_branch_id_fkey;
ALTER TABLE amc_contracts DROP CONSTRAINT IF EXISTS amc_contracts_branch_id_fkey;

-- Recreate all branch_id FKs with ON DELETE SET DEFAULT
-- This ensures deleted branch data is reassigned to the default branch (HO)
ALTER TABLE staff
  ADD CONSTRAINT staff_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE customers
  ADD CONSTRAINT customers_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE services
  ADD CONSTRAINT services_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE complaints
  ADD CONSTRAINT complaints_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE quotations
  ADD CONSTRAINT quotations_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

ALTER TABLE amc_contracts
  ADD CONSTRAINT amc_contracts_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET DEFAULT;

-- Verify all constraints are properly set
COMMENT ON TABLE staff IS 'When a branch is deleted, staff are reassigned to HO branch';
COMMENT ON TABLE customers IS 'When a branch is deleted, customers are reassigned to HO branch';
COMMENT ON TABLE services IS 'When a branch is deleted, services are reassigned to HO branch';
COMMENT ON TABLE invoices IS 'When a branch is deleted, invoices are reassigned to HO branch';
COMMENT ON TABLE expenses IS 'When a branch is deleted, expenses are reassigned to HO branch';
COMMENT ON TABLE complaints IS 'When a branch is deleted, complaints are reassigned to HO branch';
COMMENT ON TABLE quotations IS 'When a branch is deleted, quotations are reassigned to HO branch';
COMMENT ON TABLE amc_contracts IS 'When a branch is deleted, AMC contracts are reassigned to HO branch';
