# Project Updates

Canonical timeline of production-impacting updates, organized by date.

## 2026-03-16

### List Pagination Return-State Fix (Invoices and Services)

- Timestamp: 2026-03-16 21:05 IST (+05:30).
- Fixed list reset issue where opening an item from page 2+ and returning would drop users back to page 1.
- Implemented URL-backed list state for invoice and service pages (`page`, `pageSize`, and active filters).
- Added safe `returnTo` navigation wiring from list -> detail so back actions preserve the exact list context.
- Prevented mount-time page reset that previously overrode restored URL page state.

### Build Error Resolution

- Timestamp: 2026-03-16 21:12 IST (+05:30).
- Fixed Next.js build failure in inventory product stock-adjustment API caused by duplicate `user` variable declaration.

### Files Changed

- `src/app/dashboard/invoices/page.tsx`
- `src/app/dashboard/services/page.tsx`
- `src/app/dashboard/invoices/[id]/page.tsx`
- `src/app/dashboard/services/[id]/page.tsx`
- `src/app/api/inventory/products/[id]/route.ts`

### Validation and Verification

- Type diagnostics: no errors in changed files.
- Production build succeeded: `npm run build`.

### Issues Found During Work

- Found and resolved one unrelated compile-time issue (duplicate variable in inventory product API route).

### Invoice and Service Search Reliability Hardening

- Timestamp: 2026-03-16 20:10 IST (+05:30).
- Fixed inconsistent search behavior on invoice and service list pages for staff/superadmin when typing quickly.
- Root cause 1: Search OR filters mixed base-table and joined customer fields in a single expression, which can produce unreliable related-table matching.
- Root cause 2: In-flight request race condition allowed older, slower responses to overwrite newer search results.

### Files Changed

- `src/infrastructure/repositories/invoice.repository.ts`
- `src/infrastructure/repositories/service.repository.ts`
- `src/hooks/use-invoices.ts`
- `src/hooks/use-services.ts`

### Validation and Verification

- Search now supports identifier and customer fields reliably:
	- Invoices: invoice number, customer name, customer code, customer phone.
	- Services: service number, customer name, customer code, customer phone.
- Added request sequencing guard in list hooks so only the latest typed search result can update UI state.

### Issues Found During Work

- None.

### Follow-up Fix: Customer Name/Phone Search (Case-Insensitive)

- Timestamp: 2026-03-16 20:34 IST (+05:30).
- Addressed remaining bug where typing customer name/phone (including lowercase input for capitalized names) did not reliably return invoices/services.
- Replaced joined-table OR filtering in invoice/service repositories with a deterministic two-step approach:
	- Find matching customers by `full_name`, `customer_code`, `phone` (ILIKE, case-insensitive).
	- Filter invoices/services using `customer_id.in(...)` OR invoice/service number match on base table.
- This avoids PostgREST embedded relation OR edge-cases and ensures consistent behavior for staff/superadmin.

### Files Changed (Follow-up)

- `src/infrastructure/repositories/invoice.repository.ts`
- `src/infrastructure/repositories/service.repository.ts`

### Verification (Follow-up)

- Type diagnostics: no errors in changed files.
- Expected behavior: lowercase/uppercase customer name input and phone input now return related invoices/services.

### Issues Found During Follow-up Work

- None.

## 2026-03-12

### Dashboard Pending Payments and Invoice Drill-Down

- Updated dashboard `Pending Payments` to show all-time due invoice count (branch-aware, not time-chip dependent).
- Added direct drill-down from dashboard pending-payment stat to invoice list with pre-applied due-focused filters.
- Added invoice list support for `pending_due` status filter (`balance_due > 0` and not `cancelled`).

### Invoice Sorting and Filter UX Hardening

- Changed default invoice list ordering to `invoice_date` latest-to-oldest.
- Added dedicated sort options including due-amount sorting (`balance_due_desc` and `balance_due_asc`).
- Added URL persistence for invoice filters (`search`, `status`, `sort`, date filters) without navigation flicker.
- Added back/forward (`popstate`) sync for invoice list filter state.
- Restricted payment status filter options to required set in UI: Due, Paid, Partial (with `Pending Due` retained for dashboard deep-link flow).

### Scheduled Reminder Delivery Reliability

- Added `vercel.json` cron schedule for `/api/cron/service-reminders` (every 30 minutes).
- Extended cron API route to support both `GET` (Vercel Cron) and `POST` triggers.
- Hardened cron authorization handling for Vercel header, bearer token, and query-secret based schedulers.
- Added safe `dryRun` mode (`?dryRun=1`) to verify cron authorization/readiness without sending reminders.

### Cron Root Cause Found and Fixed

- Found that global auth proxy/middleware was still intercepting `/api/cron/service-reminders` and returning `401` before route logic executed.
- Updated proxy matcher to exclude `/api/cron/service-reminders` from session-based auth middleware.
- Re-verified cron endpoint locally using Vercel-style header (`x-vercel-cron: 1`) with `dryRun=1` and confirmed successful response.

### Validation and Delivery

- Resolved TypeScript and lint-blocking issues introduced during enhancements.
- Verified successful production build (`next build`).
- Changes committed and pushed to `main`.

## 2026-03-07

### Invoice Number Customization and Uniqueness

- Added support to create invoices with a custom `invoice_number`.
- Added support to edit existing invoice numbers from the invoice edit screen.
- Kept auto-generation behavior when invoice number is left blank.
- Added friendly duplicate handling in UI and API: users now get a clear message when invoice number already exists.

### Role Coverage

- Confirmed invoice create/edit flows are available to staff and superadmin according to existing access controls.

### Database Hardening

- Added migration `supabase/migrations/042_fix_invoice_autonumber_with_custom_values.sql`.
- Updated auto-number function to work safely with custom invoice values.
- Switched auto-number sequencing to `invoice_number_seq` for concurrency-safe generation.
- Preserved DB-level uniqueness via existing `invoice_number TEXT UNIQUE` constraint.

### Build and Delivery

- Verified production build success (`next build`).
- Changes committed and pushed to `main`.

---

## Update Entry Template

Use this template for future updates:

```md
## YYYY-MM-DD

### Title

- What changed
- Why it changed
- Who is impacted

### Database

- Migrations added/updated
- Constraints, triggers, policies, backfill notes

### Validation and Error Handling

- New validations
- User-facing error behavior

### Verification

- Build/test/lint status
- Deployment or release notes
```
