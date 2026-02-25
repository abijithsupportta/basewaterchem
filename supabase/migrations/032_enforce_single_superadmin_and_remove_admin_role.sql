-- Normalize legacy admin role usage and enforce single-superadmin model
-- Roles supported by application: superadmin, manager, staff, technician

BEGIN;

-- 1) Normalize existing staff roles:
--    - Keep the earliest superadmin/admin as superadmin
--    - Demote any additional superadmin/admin users to manager
WITH privileged_staff AS (
  SELECT id,
         row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM staff
  WHERE role IN ('superadmin', 'admin')
)
UPDATE staff s
SET role = CASE WHEN p.rn = 1 THEN 'superadmin'::user_role ELSE 'manager'::user_role END
FROM privileged_staff p
WHERE s.id = p.id;

-- 2) Sync auth metadata role from staff table for users linked to staff
UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', s.role::text)
FROM staff s
WHERE s.auth_user_id = u.id
  AND (u.raw_user_meta_data->>'role') IS DISTINCT FROM s.role::text;

-- 3) Block future usage of legacy admin role in staff table
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_no_admin;
ALTER TABLE staff ADD CONSTRAINT staff_role_no_admin CHECK (role <> 'admin');

-- 4) Enforce at most one superadmin row
CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_single_superadmin
ON staff ((role))
WHERE role = 'superadmin';

COMMIT;
