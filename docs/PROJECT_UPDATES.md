# Project Updates

Canonical timeline of production-impacting updates, organized by date.

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
