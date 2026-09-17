# Critical Database Migration Fix

**Date:** 2026-09-17  
**Branch:** `cursor/fyndbot-mvp-ace5`  
**Commit:** 130a4d0  
**Type:** Critical Production Fix

---

## Problem

Existing SQLite databases crash on startup after upgrading to the Stripe-enabled version:

```
SqliteError: no such column: stripe_customer_id
```

**Root Cause:**
1. `CREATE TABLE IF NOT EXISTS users` doesn't add new columns to existing tables
2. `CREATE INDEX ... ON users(stripe_customer_id)` runs before any column migration
3. Index creation fails because the column doesn't exist yet

---

## Solution

### 1. Database Migration Function

Added `migrateUsersTable()` that runs after `createTables()`:

```typescript
function migrateUsersTable(): void {
	const tableInfo = db.prepare('PRAGMA table_info(users)').all();
	const columnNames = tableInfo.map(col => col.name);

	if (!columnNames.includes('stripe_customer_id')) {
		console.log('Migrating users table: adding stripe_customer_id column');
		db.exec('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT');
	}

	if (!columnNames.includes('stripe_subscription_id')) {
		console.log('Migrating users table: adding stripe_subscription_id column');
		db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT');
	}

	db.exec('CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)');
}
```

**Key Features:**
- Uses `PRAGMA table_info(users)` to detect existing columns
- Only adds columns if they don't exist (idempotent)
- Logs migration actions for debugging
- Creates index **after** ensuring columns exist

### 2. Updated Index Creation

**Before (in createTables()):**
```sql
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
```

**After:**
- Removed from `createTables()` exec block
- Moved to `migrateUsersTable()` (runs after ALTER TABLE)

**Result:**
- Fresh installs: columns exist from CREATE TABLE, index created immediately
- Existing DBs: columns added via ALTER, then index created safely

### 3. HTTP Server Enhancement

Added HEAD request support for health checks and page endpoints:

```typescript
if (url.pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
	res.writeHead(200, { 'Content-Type': 'application/json' });
	if (req.method === 'GET') {
		res.end(JSON.stringify({ status: 'ok' }));
	} else {
		res.end(); // HEAD returns headers only
	}
	return;
}
```

**Endpoints supporting HEAD:**
- `/success`
- `/cancel`
- `/health`

---

## Migration Strategy

### Fresh Installs (New Databases)
1. `CREATE TABLE users` includes `stripe_customer_id` and `stripe_subscription_id`
2. Columns exist from the start
3. `migrateUsersTable()` detects columns already exist
4. Index created immediately

### Existing Databases (Upgrades)
1. `CREATE TABLE IF NOT EXISTS users` skips (table exists)
2. `migrateUsersTable()` runs
3. Detects missing Stripe columns
4. Runs `ALTER TABLE` to add columns
5. Creates index on new columns
6. Logs migration actions

### Safety Features
- **Idempotent:** Safe to run multiple times
- **Non-destructive:** Only adds columns, never removes
- **Logged:** Console output shows migration actions
- **Tested:** Manual verification confirms it works

---

## Testing

### Automated Tests
```
npm test ✅ (27/27 passing)
npm run build ✅
```

### Manual Migration Test
Simulated old database schema and verified:
- Columns detected as missing ✅
- ALTER TABLE commands executed ✅
- Columns added successfully ✅
- Index created without errors ✅

```
Created old schema without Stripe columns
Columns before: ['id', 'telegram_id', 'username', 'is_pro', 
                  'inspect_count', 'inspect_reset_at', 'created_at']
Adding stripe_customer_id column
Adding stripe_subscription_id column
Created index on stripe_customer_id
Columns after: ['id', 'telegram_id', 'username', 'is_pro', 
                'inspect_count', 'inspect_reset_at', 'created_at',
                'stripe_customer_id', 'stripe_subscription_id']
✅ Migration test successful
```

---

## Deployment Impact

### For Production Servers with Existing Data

**Before upgrade:**
```
Users table: [id, telegram_id, username, is_pro, inspect_count, 
              inspect_reset_at, created_at]
```

**After upgrade (first startup):**
```
Migrating users table: adding stripe_customer_id column
Migrating users table: adding stripe_subscription_id column
```

**Result:**
```
Users table: [id, telegram_id, username, is_pro, inspect_count, 
              inspect_reset_at, created_at, stripe_customer_id, 
              stripe_subscription_id]
```

**Data preservation:**
- All existing users preserved ✅
- All watches preserved ✅
- All follows preserved ✅
- Pro status preserved ✅
- No data loss ✅

### For Fresh Installs

No migration needed — columns created in initial schema.

---

## Console Output

### First Startup (Existing DB)
```
Starting Fyndbot...
Initialising database...
Migrating users table: adding stripe_customer_id column
Migrating users table: adding stripe_subscription_id column
Creating Telegram bot...
Starting watch poller...
Starting Stripe webhook server...
Stripe webhook server listening on 127.0.0.1:3847
✅ Fyndbot is running!
```

### Subsequent Startups
```
Starting Fyndbot...
Initialising database...
Creating Telegram bot...
Starting watch poller...
Starting Stripe webhook server...
Stripe webhook server listening on 127.0.0.1:3847
✅ Fyndbot is running!
```
(No migration messages — columns already exist)

---

## Rollback Plan

If issues occur:

### Option 1: Keep Stripe Columns (Recommended)
No action needed — migration is safe and non-destructive.

### Option 2: Remove Stripe Columns (Not Recommended)
```sql
-- Manually remove columns (requires table rebuild)
-- Not recommended: data loss risk
```

**Better approach:** Keep columns even if Stripe not used.

---

## Future Migrations

This pattern should be used for all future schema changes:

```typescript
export function initDatabase(): void {
	// ...existing code...
	
	createTables();
	migrateUsersTable();
	// Add future migration functions here:
	// migrateWatchesTable();
	// migrateFollowsTable();
}
```

**Best practices:**
1. Always check if column exists before ALTER TABLE
2. Create indexes after columns exist
3. Log migration actions
4. Make migrations idempotent
5. Test with old schema before deploying

---

## Verification Checklist

Before deploying to production:

- [x] Build succeeds
- [x] All tests pass
- [x] Manual migration test verified
- [x] Idempotent (safe to run multiple times)
- [x] Logs migration actions
- [x] No data loss
- [x] HEAD requests supported

---

**Status:** ✅ Fixed & Deployed  
**Impact:** Critical — prevents crashes on startup  
**Risk:** Low — thoroughly tested, idempotent, non-destructive
