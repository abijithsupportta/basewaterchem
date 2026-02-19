# Aqua Service Manager - MNC-Level Architecture

## 📋 Architecture Overview

This project follows a **Clean Architecture with Domain-Driven Design (DDD)** pattern, organized into carefully separated layers to maximize maintainability, testability, and scalability.

---

## 📁 New Folder Structure

```
src/
├── app/                              # PRESENTATION LAYER - Next.js App Router
│   ├── (auth)/                      # Authentication pages
│   │   ├── login/
│   │   └── forgot-password/
│   ├── api/                          # API routes (APPLICATION LAYER)
│   │   ├── chatbot/                 # OpenRouter AI chatbot
│   │   ├── cron/                    # Scheduled tasks
│   │   ├── customers/               # Customer CRUD
│   │   ├── invoices/                # Invoice operations
│   │   ├── services/                # Service CRUD
│   │   ├── staff/                   # Staff management
│   │   ├── notify/                  # Notifications
│   │   └── settings/                # System settings
│   └── dashboard/                   # Customer/Staff UI
│       ├── customers/
│       ├── invoices/
│       ├── services/
│       ├── staff/
│       └── settings/
│
├── domain/                           # DOMAIN LAYER - Business Logic (Completely UI-Agnostic)
│   ├── entities/                    # Domain entities & value objects
│   │   ├── customer.ts
│   │   ├── service.ts
│   │   ├── invoice.ts
│   │   ├── staff.ts
│   │   ├── complaint.ts
│   │   ├── notification.ts
│   │   └── index.ts
│   │
│   ├── services/                    # Domain services - business logic
│   │   ├── customer.service.ts      # Create, update, delete customers
│   │   ├── service.service.ts       # Service scheduling, completion
│   │   ├── invoice.service.ts       # Invoice generation, calculations
│   │   ├── staff.service.ts         # Staff lifecycle management
│   │   ├── notification.service.ts  # Notification business logic
│   │   ├── complaint.service.ts     # Complaint handling rules
│   │   ├── pdf.service.ts           # PDF generation (domain-agnostic)
│   │   ├── email.service.ts         # Email composition (domain-agnostic)
│   │   ├── chat.service.ts          # Chat/AI business logic
│   │   └── index.ts
│   │
│   ├── repositories/                # Repository interfaces (abstraction)
│   │   ├── customer.repository.ts
│   │   ├── service.repository.ts
│   │   ├── invoice.repository.ts
│   │   ├── staff.repository.ts
│   │   ├── notification.repository.ts
│   │   └── index.ts
│   │
│   ├── rules/                       # Business rules & validation
│   │   ├── service-rules.ts         # Service scheduling rules
│   │   ├── complaint-rules.ts       # Complaint escalation rules
│   │   ├── validation-rules.ts      # Domain-level validation
│   │   └── index.ts
│   │
│   ├── use-cases/                   # Application use cases (orchestration)
│   │   ├── customer/
│   │   │   ├── create-customer.ts
│   │   │   ├── update-customer.ts
│   │   │   └── deactivate-customer.ts
│   │   ├── service/
│   │   │   ├── schedule-service.ts
│   │   │   ├── complete-service.ts
│   │   │   └── send-reminders.ts
│   │   ├── invoice/
│   │   │   ├── generate-invoice.ts
│   │   │   └── send-invoice.ts
│   │   ├── staff/
│   │   │   ├── create-staff.ts
│   │   │   ├── activate-staff.ts
│   │   │   ├── deactivate-staff.ts
│   │   │   └── delete-staff.ts
│   │   └── index.ts
│   │
│   └── errors/                      # Custom domain errors
│       ├── app-error.ts
│       ├── validation-error.ts
│       ├── not-found-error.ts
│       └── index.ts
│
├── infrastructure/                  # INFRASTRUCTURE LAYER - External services & DB
│   ├── repositories/                # Repository implementations
│   │   ├── supabase-customer.repository.ts
│   │   ├── supabase-service.repository.ts
│   │   ├── supabase-invoice.repository.ts
│   │   ├── supabase-staff.repository.ts
│   │   ├── supabase-notification.repository.ts
│   │   └── index.ts
│   │
│   ├── external/                    # External service clients
│   │   ├── supabase-client.ts       # Supabase initialization
│   │   ├── openrouter-client.ts     # OpenRouter AI client
│   │   ├── nodemailer-client.ts     # Email client
│   │   └── index.ts
│   │
│   └── persistence/                 # Database schemas & migrations
│       └── supabase/                # Moved from root supabase/
│           └── migrations/
│
├── presentation/                    # PRESENTATION LAYER - React Components
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                      # Primitive components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   │
│   │   ├── forms/                   # Domain-specific forms
│   │   │   ├── customer-form.tsx    # Create/edit customer
│   │   │   ├── service-form.tsx     # Create/edit service
│   │   │   ├── invoice-form.tsx     # Invoice creation
│   │   │   └── staff-form.tsx       # Staff management
│   │   │
│   │   ├── features/                # Feature-specific components
│   │   │   ├── customers/
│   │   │   │   ├── customer-list.tsx
│   │   │   │   ├── customer-details.tsx
│   │   │   │   └── customer-stats.tsx
│   │   │   ├── services/
│   │   │   │   ├── service-calendar.tsx
│   │   │   │   ├── service-list.tsx
│   │   │   │   └── service-schedule.tsx
│   │   │   ├── invoices/
│   │   │   │   ├── invoice-table.tsx
│   │   │   │   ├── invoice-preview.tsx
│   │   │   │   └── invoice-stats.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── stats-cards.tsx
│   │   │   │   ├── upcoming-services.tsx
│   │   │   │   └── overdue-services.tsx
│   │   │   └── chat/
│   │   │       ├── chat-widget.tsx
│   │   │       ├── chat-message.tsx
│   │   │       └── chat-input.tsx
│   │   │
│   │   └── layout/
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── breadcrumb.tsx
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── use-customers.ts         # Customer CRUD hook
│   │   ├── use-services.ts          # Service CRUD hook
│   │   ├── use-invoices.ts          # Invoice CRUD hook
│   │   ├── use-auth.ts              # Authentication hook
│   │   ├── use-debounce.ts          # Debounce utility
│   │   └── index.ts
│   │
│   ├── providers/                   # React context providers
│   │   ├── auth-provider.tsx        # Auth context
│   │   └── theme-provider.tsx       # Theme context
│   │
│   └── stores/                      # Zustand/TanStack stores (optional)
│       ├── user.store.ts
│       └── ui.store.ts
│
├── shared/                          # SHARED UTILITIES - No domain/UI dependencies
│   ├── constants/
│   │   ├── app-constants.ts         # General app constants
│   │   ├── api-constants.ts         # API routes & configs
│   │   ├── feature-flags.ts         # Feature flags
│   │   └── index.ts
│   │
│   ├── types/                       # Shared TypeScript types/interfaces
│   │   ├── api.ts                   # API request/response types
│   │   ├── domain.ts                # Domain entity types (exported from domain/)
│   │   ├── ui.ts                    # UI-specific types
│   │   └── index.ts
│   │
│   ├── utils/                       # Pure utility functions
│   │   ├── format.ts                # Formatting utilities
│   │   ├── math.ts                  # Math utilities
│   │   ├── string.ts                # String utilities
│   │   ├── validators.ts            # Validation functions
│   │   ├── date-helpers.ts          # Date utilities
│   │   └── index.ts
│   │
│   ├── lib/                         # Library wrappers
│   │   ├── authz.ts                 # Authorization utilities
│   │   └── index.ts
│   │
│   └── errors/                      # Shared error classes
│       ├── app-error.ts
│       ├── http-error.ts
│       └── index.ts
│
├── config/                          # CONFIGURATION - Environment & settings
│   ├── env.ts                       # Environment variables (typed)
│   ├── api.config.ts                # API configuration
│   ├── supabase.config.ts           # Database configuration
│   └── index.ts
│
├── middleware/                      # MIDDLEWARE - Authentication, CORS, etc.
│   └── auth.middleware.ts
│
└── styles/                          # GLOBAL STYLES
    └── globals.css
```

---

## 🏛️ Architectural Principles

### 1. **Separation of Concerns**
- **Domain**: Pure business logic, no framework dependencies
- **Infrastructure**: Database, APIs, external services
- **Presentation**: React UI, pages, components
- **Application**: HTTP request/response handling, DTOs
- **Shared**: Cross-cutting utilities

### 2. **Dependency Flow (Clean Architecture)**
```
Presentation → Application → Domain ← Infrastructure
                    ↓
                  Shared (Utilities, Types, Errors)
```
- **Never**: Presentation → Domain directly
- **Never**: Domain → Framework (React, Next.js)
- **Never**: Domain → Infrastructure (use Dependency Injection)

### 3. **Domain-Driven Design (DDD)**
- **Entities**: Core domain objects (Customer, Service, Invoice)
- **Use Cases**: Orchestrate domain services for specific workflows
- **Services**: Implement business rules and logic
- **Repositories**: Abstract data access (interface → implementation)
- **Rules**: Encapsulate complex business rules separately

### 4. **Performance & Bundle Size**
- **Code Splitting**: Each feature in separate folder for dynamic imports
- **Tree-Shaking**: Pure functions, ES6 modules, no side effects
- **Lazy Loading**: Pages and components loaded on-demand
- **Caching**: API response caching with SWR/React Query hooks
- **Image Optimization**: Next.js Image component usage

---

## 📦 Current File Mapping (Refactoring Guide)

### From Old → To New Structure

```
OLD STRUCTURE                          NEW STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/types/                          →  src/shared/types/
src/lib/utils.ts                    →  src/shared/utils/utils.ts
src/lib/validators.ts               →  src/shared/utils/validators.ts
src/lib/constants.ts                →  src/shared/constants/app-constants.ts
src/lib/authz.ts                    →  src/shared/lib/authz.ts

src/lib/invoice-pdf.ts              →  src/domain/services/pdf.service.ts
src/lib/service-pdf.ts              →               ↓ (same)
src/lib/email.ts                    →  src/domain/services/email.service.ts
src/lib/notify-client.ts            →  src/infrastructure/external/notification-client.ts

src/core/services/                  →  src/domain/services/ (business logic)
src/core/errors/                    →  src/domain/errors/
src/infrastructure/repositories/    →  src/infrastructure/repositories/ (implementations)

src/components/                     →  src/presentation/components/
src/hooks/                          →  src/presentation/hooks/

src/app/api/                        →  src/app/api/ (stays, but calls domain)
src/app/dashboard/                  →  src/app/dashboard/ (stays, but uses presentation/)
src/app/(auth)/                     →  src/app/(auth)/ (stays, but uses presentation/)
```

---

## 🚀 Performance Optimizations

### 1. **Code Splitting**
```tsx
// Before: Large bundle
import * as Components from '@/components'

// After: Lazy load by feature
const CustomerList = dynamic(() => import('@/presentation/components/features/customers/customer-list'))
const ServiceForm = dynamic(() => import('@/presentation/components/forms/service-form'))
```

### 2. **Smart Caching**
```tsx
// Using SWR for API response caching
const { data, mutate } = useSWR('/api/customers', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // 1 minute
})
```

### 3. **Middleware Optimization**
- Auth check only on protected routes
- CORS Headers properly configured
- Proper HTTP caching headers

### 4. **Database Query Optimization**
```ts
// Moved to repositories - use select-specific columns
const customers = await supabase
  .from('customers')
  .select('id, name, email, phone') // Only needed fields
  .eq('is_active', true)
```

### 5. **Image/Asset Optimization**
- Use Next.js Image component
- Proper responsive sizing
- WebP format support

---

## 📊 DDD Examples

### Example 1: Create Customer Use Case

**Flow**:
```
API Route (app/api/customers) 
  → CreateCustomerUseCase (domain/use-cases/)
    → CustomerService.validate() (domain/services/)
    → ValidationRules (domain/rules/)
    → CustomerRepository.save() (infrastructure/repositories/)
    → EmailService.sendWelcome() (domain/services/)
    → API Response
```

### Example 2: Schedule Service

**Flow**:
```
Form Component (presentation/components/forms/)
  → Hook (presentation/hooks/useServices)
    → API Route (app/api/services)
      → ScheduleServiceUseCase (domain/use-cases/)
        → ServiceService.schedule() (domain/services/)
        → ServiceRules.canSchedule() (domain/rules/)
        → ServiceRepository (infrastructure/repositories/)
        → NotificationService.notify() (domain/services/)
        → Cache invalidation (hook mutate)
        → UI Update
```

---

## ✅ Migration Checklist

- [ ] Create new folder structure
- [ ] Move domain logic to `src/domain/`
- [ ] Move components to `src/presentation/`
- [ ] Move utilities to `src/shared/`
- [ ] Create interface-based repositories
- [ ] Update all imports (use path aliases)
- [ ] Implement lazy loading for routes/components
- [ ] Add response caching with SWR
- [ ] Update tsconfig paths
- [ ] Test build and functionality
- [ ] Performance audit (Lighthouse, bundle analysis)

---

## 🔧 Implementation Priority

1. **Phase 1**: Folder structure + Move files
2. **Phase 2**: Update imports + Fix build errors
3. **Phase 3**: Add lazy loading + Performance optimizations
4. **Phase 4**: Add caching + Additional features

---

## 📚 References

- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Domain-Driven Design: https://martinfowler.com/bliki/DomainDrivenDesign.html
- Next.js App Router: https://nextjs.org/docs/app
- TypeScript Best Practices: https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
