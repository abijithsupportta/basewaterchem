# Quick Reference: New Architecture

## 📁 Where to Put Code?

### Business Logic
> **Location**: `src/domain/services/`
> **Example**: Create/validate customers, calculate invoice totals

```ts
// src/domain/services/customer.service.ts
export class CustomerService {
  async validateEmail(email: string): Promise<boolean> {
    // Pure business logic - no React, no HTTP
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
}
```

### API Endpoints
> **Location**: `src/app/api/customers/route.ts`
> **Purpose**: Handle HTTP requests/responses only

```ts
// src/app/api/customers/route.ts
import { customerService } from '@/domain/services'

export async function POST(request: Request) {
  const body = await request.json()
  
  // Call domain service
  const result = await customerService.create(body)
  
  return NextResponse.json(result, { status: 201 })
}
```

### React Components
> **Location**: `src/presentation/components/`
> **Rule**: No business logic, only UI display

```tsx
// src/presentation/components/features/customers/customer-list.tsx
import { useCustomers } from '@/presentation/hooks'

export function CustomerList() {
  const { data: customers, isLoading } = useCustomers()
  
  return <div>{customers?.map(c => <CustomerCard key={c.id} {...c} />)}</div>
}
```

### React Hooks
> **Location**: `src/presentation/hooks/`
> **Purpose**: Fetch data, manage UI state

```ts
// src/presentation/hooks/use-customers.ts
import useSWR from 'swr'

export function useCustomers() {
  const { data, mutate } = useSWR('/api/customers', fetcher, {
    revalidateOnFocus: false,
  })
  return { data, mutate }
}
```

### Utilities (No Dependencies)
> **Location**: `src/shared/utils/`
> **Rule**: Pure functions only, no imports from domain/app/presentation

```ts
// src/shared/utils/format.ts
export function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString('en-IN')}`
}
```

### Configuration
> **Location**: `src/config/`
> **For**: Environment variables, API URLs, feature flags

```ts
// src/config/env.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
export const CACHE_TTL = 60 // seconds
```

---

## 🔄 Data Flow Example: Create Customer

```
React Component
     ↓
useCustomers hook (POST /api/customers)
     ↓
API Route Handler (req/res)
     ↓
CustomerService.create() [Domain Layer]
     ↓
CustomerRepository.save() [Infrastructure]
     ↓
Supabase Database
     ↓
Return Success
```

### Code:

```tsx
// 1. Component triggers action
<Button onClick={async () => {
  await mutate(createCustomer({ name: 'John' }))
}}>Create</Button>

// 2. Hook makes API call
export function useCustomers() {
  return useSWR('/api/customers', fetcher)
}

// 3. API route receives request
export async function POST(req: Request) {
  const body = await req.json()
  const customer = await customerService.create(body)
  return NextResponse.json(customer)
}

// 4. Service contains business logic
export class CustomerService {
  async create(data: CreateCustomerDTO) {
    // Validate
    if (!data.email) throw new ValidationError('Email required')
    // Database call
    return await customerRepository.save(customer)
  }
}

// 5. Repository abstracts database
export class CustomerRepository {
  async save(customer: Customer) {
    return await supabase.from('customers').insert(customer)
  }
}
```

---

## 📦 Import Path Cheat Sheet

```ts
// ✅ CORRECT - Import from appropriate layer
import { emailService } from '@/domain/services'
import { useCustomers } from '@/presentation/hooks'
import { formatCurrency } from '@/shared/utils'
import { CustomerRepository } from '@/infrastructure/repositories'

// ❌ WRONG - Crossing layer boundaries
import CustomerService from '@/components/...services/customer' // Wrong path!
import { supabase } from '@/lib' // Bypass repository!
import { Component } from '@/app/...page.tsx' // Import page as component!

// ✅ CORRECT - Use path aliases
import type { Customer } from '@/shared/types' // Type import
import { validateEmail } from '@/shared/utils' // Utility
```

---

## 🚀 Common Tasks

### Add New Feature (Customer Management)

**Step 1**: Create domain directory
```bash
mkdir -p src/domain/use-cases/customer
```

**Step 2**: Add business logic (service)
```ts
// src/domain/services/customer.service.ts
export async function createCustomer(data: CreateCustomerDTO): Promise<Customer> {
  // Validation
  if (!data.email.includes('@')) throw new ValidationError('Invalid email')
  
  // Business rule check
  const exists = await customerRepository.findByEmail(data.email)
  if (exists) throw new DuplicateError('Email already used')
  
  // Save
  return await customerRepository.save(new Customer(data))
}
```

**Step 3**: Create API route
```ts
// src/app/api/customers/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const customer = await customerService.createCustomer(body)
  return NextResponse.json(customer, { status: 201 })
}
```

**Step 4**: Create React hook
```ts
// src/presentation/hooks/use-customers.ts
export function useCreateCustomer() {
  return async (data: CreateCustomerDTO) => {
    const response = await fetch('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  }
}
```

**Step 5**: Create component
```tsx
// src/presentation/components/forms/customer-form.tsx
export function CustomerForm() {
  const createCustomer = useCreateCustomer()
  const handleSubmit = async (data: FormData) => {
    await createCustomer(data)
  }
  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## 🧪 Testing Example

```ts
// ✅ EASY: Test domain service (pure logic)
import { CustomerService } from '@/domain/services'

test('should reject invalid email', () => {
  const service = new CustomerService()
  expect(() => {
    service.validateEmail('invalid')
  }).toThrow('Invalid email')
})

// Would need: Mock repository (only layer below)
// No mock: React, HTTP, Database - all handled by service interface
```

---

## ⚡ Performance Tips

### For Components
```tsx
// ❌ Slow: Fetch on every render
export function CustomerList() {
  const [customers, setCustomers] = useState([])
  useEffect(() => {
    fetch('/api/customers').then(setCustomers) // Every component load!
  }, [])
}

// ✅ Fast: Use hook with caching
export function CustomerList() {
  const { data: customers } = useCustomers() // SWR caches & dedupes
}
```

### For API Routes
```ts
// ❌ Slow: Fetch all columns
const customers = await supabase.from('customers').select('*')

// ✅ Fast: Fetch only needed
const customers = await supabase
  .from('customers')
  .select('id, name, email') // Only columns used
  .eq('is_active', true)
  .range(0, 49) // Pagination
```

### For Rendering
```tsx
// ❌ Slow: Load all features upfront
import { CustomerList } from '@/components/features/customers'
import { ServiceCalendar } from '@/components/features/services'

// ✅ Fast: Lazy load by route
const CustomerList = dynamic(() => 
  import('@/presentation/components/features/customers/list'),
  { ssr: false } // Don't render on server
)
```

---

## 🐛 Debugging

### "Cannot find module" Error
```
Problem: import { X } from '@/some/path'
Solution: Check if file exists in src/some/path/
Use: Ctrl+Click on import → should jump to file
```

### Type Error: "Property X on Y"
```
Problem: customer.full_name typescript error
Solution: Check domain/entities/customer.ts for type definition
Use: Hover over variable → see type
```

### Build Error: "Export not found"
```
Problem: export { X } from '@/domain/services'
Solution: Check if X exists in src/domain/services/index.ts
Use: npm run build → shows missing exports
```

---

## 🔄 Refactoring Existing Code

### Move From lib/ to Domain

**Before**:
```ts
// src/lib/customer-service.ts
export async function createCustomer(data) {
  // Business logic mixed with HTTP stuff
  const res = await fetch(...)
  return res.json()
}
```

**After**:
```ts
// src/domain/services/customer.service.ts
export class CustomerService {
  async create(data: CreateCustomerDTO): Promise<Customer> {
    // Pure business logic only
    return await this.repository.save(data)
  }
}

// src/app/api/customers/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const customer = await customerService.create(body)
  return NextResponse.json(customer)
}
```

---

## 📋 Checklist: Adding New Feature

- [ ] Business logic in `domain/services/`
- [ ] API route in `app/api/[feature]/`
- [ ] Hook in `presentation/hooks/use[Feature].ts`
- [ ] Component in `presentation/components/features/[feature]/`
- [ ] Types in `shared/types/[feature].ts`
- [ ] Utility functions in `shared/utils/`
- [ ] No framework imports in domain layer
- [ ] No direct database calls in components
- [ ] No business logic in API routes
- [ ] Tests for domain layer only
- [ ] Build passes: `npm run build`

---

## 🎯 Remember

1. **Domain = Pure Business Logic**
   - Zero dependencies on React, HTTP, Database
   - Should work in Node.js, browser, or CLI
   
2. **Infrastructure = Data Access**
   - Repositories abstract database queries
   - External APIs, caching, services go here
   
3. **Presentation = UI Only**
   - Display data, handle user input
   - Call hooks (which talk to API)
   
4. **Shared = Reusable Utilities**
   - No domain knowledge
   - Same across entire app

**Dependency Rule**: Only depend on layers INWARD (Presentation → Domain), never outward
