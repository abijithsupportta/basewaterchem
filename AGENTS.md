# AI Agent Onboarding & Development Guide (`AGENTS.md`)

Welcome to **Aqua Service Manager**! This document serves as the canonical onboarding reference for AI engineering agents working on this repository. It details the architecture, code patterns, data models, business rules, and strict development guidelines required to maintain the stability and clean design of this system.

---

## 1. Project Overview & Business Logic

### Core Mission
Aqua Service Manager is an operational workflow engine tailored for water filter service businesses (specifically **Base Water Chemicals**). It coordinates:
*   **Customer & Service Lifecycle**: Requesting, scheduling, assigning, and completing field services.
*   **AMC (Annual Maintenance Contracts)**: Automating recurring service intervals and maintaining service continuity.
*   **Revenue & Operational Finance**: Automated invoicing, tracking balance dues, expenses, and day-book context.
*   **Inventory Integration**: Tracking spare parts and deducting stock when technicians use items to complete a service.
*   **Staff Governance**: Superadmin-controlled staff lifecycle (Technicians, Staff, Managers, Superadmins) with secure credentials and access controls.

### User Roles & Navigation Guards
1.  **Technician**:
    *   *Dashboard*: Focused execution-only metrics (today's assigned services, individual service dues, stock alerts).
    *   *Access*: Day Book, Customers, Services, Service Calendar.
    *   *Restrictions*: Cannot access Invoices, Inventory, Expenses, Branches, Staff, or Settings. Enforced via UI navigation hiding and hard API route redirects.
2.  **Staff**:
    *   *Access*: Day Book, Customers, Services, Service Calendar, Invoices, Inventory, Expenses.
    *   *Restrictions*: Cannot access Staff Management, Branches, or Settings.
3.  **Manager**:
    *   *Access*: Full dashboard analytics, Day Book, Customers, Services, Calendar, Invoices, Inventory, Expenses, Branches, and Settings.
    *   *Restrictions*: Cannot perform superadmin-only Staff operations.
4.  **Superadmin**:
    *   *Access*: Unrestricted access across all operational modules, including sensitive Staff lifecycle controls.

---

## 2. Clean Architecture & Domain-Driven Design (DDD)

This codebase follows **Clean Architecture with Domain-Driven Design (DDD)**. Strict layer boundaries must be respected.

### The Dependency Rule
> **Presentation $\rightarrow$ Application $\rightarrow$ Domain $\leftarrow$ Infrastructure**
> All dependencies must point *inwards*. The Domain layer has zero knowledge of React, HTTP, Next.js, or Supabase.

```
       [ Presentation Layer ] (Next.js Pages, React Components, Hooks)
                 │
                 ▼
       [ Application Layer ]  (API Route Handlers, DTOs)
                 │
                 ▼
       [ Domain Layer ]       (Entities, Services, Business Rules)
                 ▲
                 │
       [ Infrastructure Layer] (Supabase client, Repositories, External services)
```

### Directory Structure of `src/`
*   [`src/domain/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain): **Pure Domain Layer**
    *   [`entities/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain/entities): Rich domain models (e.g. `Customer`, `Service`, `Invoice`, `Staff`).
    *   [`services/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain/services): Domain services executing business logic (e.g. `invoice.service.ts` for tax/discount calculation, `pdf.service.ts` for generation).
    *   [`repositories/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain/repositories): Interface abstractions defining data contracts (e.g. `customer.repository.ts`).
    *   [`rules/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain/rules): Reusable business validation rules.
    *   [`use-cases/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/domain/use-cases): Orchestrators for specific multi-step workflows.
*   [`src/infrastructure/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/infrastructure): **Infrastructure Layer**
    *   [`repositories/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/infrastructure/repositories): Concrete implementations of domain repositories using Supabase client (e.g. `supabase-customer.repository.ts`).
    *   [`external/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/infrastructure/external): External API wrappers (Supabase, OpenRouter AI, Nodemailer).
*   [`src/presentation/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/presentation): **Presentation Layer**
    *   [`components/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/presentation/components): shadcn/ui primitives (`ui/`), domain forms (`forms/`), and feature boards (`features/`).
    *   [`hooks/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/presentation/hooks): SWR-backed custom hooks for data fetching and mutation (e.g. `use-services.ts`).
    *   [`providers/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/presentation/providers): React context providers.
*   [`src/app/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/app): **Routing & Orchestration Layer**
    *   [`api/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/app/api): Next.js API Routes serving as application controllers. They instantiate repositories and call domain services/use-cases.
    *   [`dashboard/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/app/dashboard): Route pages organizing presentation components.
*   [`src/shared/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/shared): **Cross-Cutting Utilities**
    *   Pure utilities, TypeScript schemas (`types/`), constants, and custom HTTP error classes. Contains no domain logic.

---

## 3. Database, Security & Access Controls

### Database Engine
*   **Supabase Postgres** with Row-Level Security (RLS) enabled.
*   Schema migrations live in [`supabase/migrations/`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/supabase/migrations).

### User Authentication & Role Resolution
Session roles are resolved deterministically to prevent race conditions or missing staff records:
1.  **Primary**: `user.user_metadata.role` (retrieved instantly from the Supabase Auth session token).
2.  **Fallback**: Look up role inside the DB `staff` table if metadata is blank.
3.  **Default**: Revert to the lowest execution privilege (`technician`) if unresolved.

### API Authorization Guards
API endpoints (e.g., [`/api/staff`](file:///c:/Personal%20Projects/Basewaterchem/aqua-service-manager/src/app/api/staff/route.ts)) must actively check roles before writing to the database:
```ts
const userRole = session.user.user_metadata.role;
if (userRole !== 'superadmin') {
  return new NextResponse('Forbidden', { status: 403 });
}
```

---

## 4. Key Workflows & Business Rules

### A. Non-Blocking Service Completion
*   **Problem**: In early iterations, completing a service was highly latent (taking 30s+) because inventory stock adjustment, AMC scheduling, and notifications were executed sequentially in a blocking chain.
*   **Solution**: The service completion route updates the critical service status *synchronously* to update UI immediately, while non-critical side effects (sending email notifications, generating invoice numbers, updating AMC) run as *parallel, non-blocking background operations*.
*   If a background action fails (e.g. email SMTP fails), the core service completion is logged as successful, and a warning is captured in logs.

### B. AMC Auto-Reschedule
*   **Trigger**: Triggered on `BEFORE DELETE` of a service.
*   **Execution Conditions**:
    1.  Service being deleted must be an AMC service (`is_under_amc = TRUE` and service type is `amc_service`).
    2.  Status must be `scheduled` (cannot reschedule from deleted completed/in-progress jobs).
    3.  The AMC contract must be `active`.
    4.  Completed service count must not exceed the contract's `total_services_included`.
*   **Calculation**: Next service date is calculated as `last_completed_service_date + service_interval_months`. If no service was ever completed, the contract `start_date` is used.
*   **Inherited Properties**: The new service inherits technician, branch, and free service parameters. Notes get appended with the suffix `[Auto-rescheduled from deleted service]`.

### C. URL-Based State Management
*   **Pattern**: Dashboard list pages (Customers, Invoices, Services, day-book) MUST use URL query parameters (`searchParams` + `useRouter`) instead of standard `useState` hooks.
*   **Rationale**: This preserves search queries, page sizes, and sorting values when navigating to a detail page and hitting the browser's "Back" button.
*   **Implementation**: Use the `useSearchParams` hook and debounce search inputs using `use-debounce` to prevent excessive API requests.

---

## 5. Development Best Practices & Gotchas

### Code Modification Guidelines
*   **Avoid Overwriting Layers**: Do not run direct database queries inside components. Always route reads/writes through presentation hooks $\rightarrow$ API endpoints $\rightarrow$ Repository/Domain layers.
*   **Keep Domain Logic Pure**: Domain files in `src/domain` must not import any libraries with side-effects (e.g. Next.js router, React hooks, Supabase instance). Use interfaces to receive external parameters.
*   **Verify Builds Regularly**: Run `npm run build` locally to verify TypeScript compile status. Do not push changes that break the compilation.

### Known Pitfalls (Gotchas)
1.  **In-Flight Search Race Conditions**: Fast typing can cause slow API queries to resolve after quick API queries, overwriting current results. Hooks (e.g. `use-services.ts`) must implement request-sequencing IDs so only the latest in-flight request updates the UI state.
2.  **Global Middleware Route Exclusions**: The global authentication middleware blocks unauthenticated calls. Direct system integrations (such as the scheduled cron route `/api/cron/service-reminders`) must be explicitly bypassed in `middleware.ts` and handle credentials via internal headers/secrets check.
3.  **Patch Tool Corruption**: When modifying large files with complex indentation, patch tools might miscalculate target positions. Verify files manually or overwrite the target file entirely to avoid compile-breaking artifacts.

---

## 6. Commands Reference

*   **Development Server**: `npm run dev`
*   **Build Project**: `npm run build`
*   **Linting**: `npm run lint` or `npx eslint src`
