-- ============================================
-- Migration 028: Invoice Delete Cascades AMC
-- ============================================
-- If an invoice is deleted, remove its AMC contract and scheduled AMC services.

-- Ensure AMC contracts are deleted when the source invoice is deleted
ALTER TABLE amc_contracts DROP CONSTRAINT IF EXISTS amc_contracts_invoice_id_fkey;
ALTER TABLE amc_contracts
  ADD CONSTRAINT amc_contracts_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE;

-- Ensure AMC services are deleted when their AMC contract is deleted
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_amc_contract_id_fkey;
ALTER TABLE services
  ADD CONSTRAINT services_amc_contract_id_fkey
    FOREIGN KEY (amc_contract_id) REFERENCES amc_contracts(id)
    ON DELETE CASCADE;
