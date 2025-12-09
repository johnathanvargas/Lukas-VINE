# Add updated_at Trigger for public.items Table

## Overview
This PR adds automatic `updated_at` timestamp tracking to the `public.items` table using a PostgreSQL trigger. The migration is idempotent and safe to run multiple times.

## Changes Included

### 1. Database Migration
- **File**: `db/migrations/_add_items_updated_at_trigger.sql`
- Adds `updated_at` column to `public.items` (if not exists)
- Creates trigger function `set_updated_at()` that automatically updates the timestamp
- Creates trigger `items_set_updated_at` that fires before UPDATE operations
- Includes rollback instructions in comments

### 2. TypeScript Model Update
- **File**: `src/models/item.ts`
- Adds `updated_at` field to `Item` interface
- Includes field in `CreateItemDTO` interface
- Properly typed as optional `string | Date | null`

### 3. Prisma Schema Snippet
- **File**: `prisma/schema_items_updated_at_snippet.prisma`
- Example schema showing how to represent the updated_at field
- Uses `@updatedAt` directive for automatic management
- Ready to integrate into your main Prisma schema

### 4. Integration Tests
- **File**: `tests/items-timestamps.spec.ts`
- Validates that `updated_at` column exists via schema introspection
- Verifies trigger function is properly configured
- Tests automatic timestamp population on INSERT
- Tests automatic timestamp updates on UPDATE
- Ensures `created_at` remains unchanged during updates

### 5. Documentation
- **File**: `.github/PR_TEMPLATES/000_add_updated_at_trigger.md` (this file)

## Migration Safety

✅ **This migration is safe and idempotent:**
- Uses `ADD COLUMN IF NOT EXISTS` - won't fail if column already exists
- Uses `CREATE OR REPLACE FUNCTION` - updates function definition safely
- Uses `DROP TRIGGER IF EXISTS` before creating - prevents duplicate triggers
- Does not modify existing data
- Does not drop any columns (rollback instructions are commented)

## Testing Steps

### Before Running Migration
```sql
-- Verify current schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items';
```

### Apply Migration
```sql
-- Run the migration SQL file
\i db/migrations/_add_items_updated_at_trigger.sql
```

### After Running Migration
```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'items'
  AND trigger_name = 'items_set_updated_at';

-- Test the trigger manually
INSERT INTO public.items (name) VALUES ('test-item') RETURNING id, created_at, updated_at;
-- Wait a moment, then update
UPDATE public.items SET name = 'updated-test-item' WHERE name = 'test-item' RETURNING updated_at;
-- Verify updated_at changed
```

### Run Integration Tests
```bash
npm test -- tests/items-timestamps.spec.ts
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Remove trigger and function
DROP TRIGGER IF EXISTS items_set_updated_at ON public.items;
DROP FUNCTION IF EXISTS public.set_updated_at();

-- OPTIONAL: Drop the column (only if you want to fully rollback)
-- WARNING: This will permanently delete the updated_at data
-- ALTER TABLE public.items DROP COLUMN IF EXISTS updated_at;
```

## Database Compatibility
- PostgreSQL 11+
- Supabase (PostgreSQL 14+)
- Uses standard PostgreSQL syntax
- No vendor-specific extensions required (except pgcrypto for UUID, which is standard)

## Performance Impact
- **Minimal**: Trigger executes only on UPDATE operations
- **No index added**: `updated_at` is tracked but not indexed by default
- **If needed**, add index after migration: `CREATE INDEX idx_items_updated_at ON public.items(updated_at);`

## Code Review Checklist
- [ ] Migration SQL is idempotent (safe to run multiple times)
- [ ] TypeScript types match database schema
- [ ] Integration tests cover INSERT and UPDATE scenarios
- [ ] Rollback instructions are clear and safe
- [ ] No breaking changes to existing code
- [ ] Documentation is clear and complete

## Deployment Notes
- ✅ Can be deployed to production without downtime
- ✅ Does not require application restart
- ✅ Backward compatible with existing code
- ⚠️ After deployment, verify trigger is active using the test queries above

## Related Issues
- Implements automatic timestamp tracking for data audit trails
- Enables future sorting and filtering by last modification time
- Foundation for eventual consistency checks and cache invalidation

---

**Review:** Please verify that:
1. Migration is truly idempotent (tested with multiple runs)
2. TypeScript types align with your existing item model structure
3. Test suite integrates with your CI/CD pipeline
4. Prisma schema snippet matches your ORM configuration
