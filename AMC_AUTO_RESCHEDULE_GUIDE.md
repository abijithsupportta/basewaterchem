# AMC Auto-Reschedule on Service Deletion

## Overview
When a **scheduled AMC service** is deleted, the system automatically creates a new scheduled service for the next interval period, ensuring no gap in AMC coverage.

## Trigger Conditions
Auto-reschedule **only** happens if ALL of these are true:
1. ✅ Service being deleted is an AMC service (`is_under_amc = TRUE`)
2. ✅ Service type is `amc_service`
3. ✅ Service status is `scheduled` (not already completed or in progress)
4. ✅ AMC contract exists and is `active`
5. ✅ Service count hasn't exceeded total services included in contract

## Auto-Reschedule Logic

### Next Service Date Calculation
1. **Find last completed service** for the AMC contract
   - Searches for services with status `completed` or `in_progress`
   - Must have a `service_date` recorded
2. **If no completed service found** → Use contract `start_date`
3. **Calculate next date** = last completed date + `service_interval_months`

**Example:**
- AMC interval: 3 months
- Last service completed: 2025-12-15
- New scheduled date: 2026-03-15

### Details Inherited from Deleted Service
The new automatically-created service inherits:
- ✅ `technician_staff_id` (assigned technician)
- ✅ `branch_id` (assigned location)
- ✅ `free_service_valid_until` (free service window)
- ✅ Base notes with `[Auto-rescheduled from deleted service]` suffix

### Service Count Validation
```sql
completed_count = COUNT(services with status IN ('completed', 'in_progress'))
total_services = amc_contract.total_services_included (default 1)

reschedule = (completed_count + 1) < total_services
```

**Example:**
- AMC includes 4 total services
- 2 services completed + 1 deleted
- Remaining: 1 service slot → ✅ **Will auto-reschedule**

## Database Implementation

**Migration File:** [030_amc_auto_reschedule_on_delete.sql](./030_amc_auto_reschedule_on_delete.sql)

**Trigger Name:** `trigger_amc_auto_reschedule_on_delete`
- Fires on: `BEFORE DELETE` on `services` table
- Function: `handle_amc_service_deletion()`

## How to Use

### Customer Deletes a Scheduled Service
```javascript
// Frontend API call
DELETE /api/services/{serviceId}
```

The database trigger automatically:
1. ✅ Validates it's a scheduled AMC service
2. ✅ Finds the last completed service date
3. ✅ Calculates next interval date
4. ✅ Creates new scheduled service
5. ✅ Updates AMC contract's `next_service_date`

**Result:** New service appears in "Upcoming Services" dashboard

### Example Workflow
**Initial State:**
- Customer has 3-month AMC
- Service 1: Completed 2025-12-15
- Service 2: Scheduled 2026-03-15 (to be deleted)
- Service 3: None yet

**Delete Action:**
```sql
DELETE FROM services WHERE id = 'service-2-id';
```

**Trigger Auto-Creates:**
- Service 3: Scheduled 2026-06-15
- Notes: "Rescheduled after deletion: [original description] [Auto-rescheduled from deleted service]"

**Result:**
- Upcoming → Service 3 is now visible for 2026-06-15
- No gap in AMC coverage ✅

## Edge Cases

### ❌ Won't Reschedule If:
1. Service is not AMC (`is_under_amc = FALSE`)
2. Service is already completed/in progress (not `scheduled`)
3. AMC contract is not active (status ≠ 'active')
4. All contracted services already completed
5. No AMC contract linked to service

### ✅ Special Handling:
- **First service deletion:** Uses AMC start date as baseline
- **Partial cancellation:** Respects total service count limit
- **Inherited notes:** Preserved with "[Auto-rescheduled]" marker for audit trail

## Testing Checklist

- [ ] Delete a scheduled AMC service from a 3-month AMC
- [ ] Verify new service auto-creates with next interval date
- [ ] Check technician/branch/free_service details are inherited
- [ ] Confirm contract's `next_service_date` updates
- [ ] Try deleting a non-AMC service (should NOT reschedule)
- [ ] Try deleting from an inactive AMC (should NOT reschedule)
- [ ] Verify service count limit is respected

## UI Implications
After deletion, users should see:
1. ✅ Original service removed from list
2. ✅ New scheduled service auto-appears in "Upcoming"
3. ✅ Toast notification could show: "Service deleted. Next AMC service scheduled for [date]"

## Related Files
- [service.repository.ts](../../infrastructure/repositories/service.repository.ts) - Delete method (line 153)
- [services/[id]/page.tsx](../../app/dashboard/services/[id]/page.tsx) - Delete button UI
- [amc_contracts table](../../../schema.sql) - Contract structure
