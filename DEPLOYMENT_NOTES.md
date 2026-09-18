# Blocket Parser Fix - Deployment Notes

## Problem Summary
Production Fyndbot on Fin1 stopped sending Telegram alerts on ~2026-09-17 afternoon Stockholm time.

**Root cause:** Blocket changed their frontend architecture:
- Removed `__NEXT_DATA__` script tag
- Now uses JSON-LD structured data (`application/ld+json` with `id="seoStructuredData"`)
- Old parser returned empty array `[]`, causing **silent failure**
- Poller only updated `last_checked`, no error logs, no alerts

## Solution
Branch: `cursor/fix-blocket-parser-79ad`

Updated `parseBlocketHTML()` in `src/blocket/fetcher.ts`:
1. Parse JSON-LD `ItemList` instead of `__NEXT_DATA__`
2. Extract listings from `mainEntity.itemListElement[]` 
3. Map Product schema to BlocketListing interface
4. **Added loud failure:** throw error if zero listings parsed from non-empty HTML

## Testing Results
✅ **All tests passing (18/18)**
- Added fixture test with real Blocket mobility search HTML (893 lines)
- Tests verify parser extracts correct id, title, price, url, imageUrl
- Tests verify empty HTML throws error (no more silent failures)
- **Live fetch verified:** 49 listings from `https://www.blocket.se/mobility/search/car?location=0.300012`

## Deployment Steps (Fin1)

### 1. Pull and build
```bash
cd /path/to/fyndbot
git fetch origin
git checkout cursor/fix-blocket-parser-79ad
git pull origin cursor/fix-blocket-parser-79ad
npm install  # only if package.json changed
npm run build
```

### 2. Restart pm2
```bash
pm2 restart fyndbot
pm2 logs fyndbot --lines 100
```

### 3. Verify success
Wait up to 2 minutes for next poll, look for:
```
Found N new listings
```

**Or run one-off test immediately:**
```bash
node -e "import('./dist/blocket/fetcher.js').then(m => m.fetchBlocketSearch('https://www.blocket.se/mobility/search/car?location=0.300012').then(l => console.log('✓ Found', l.length, 'listings')))"
```

Expected output:
```
✓ Found 49 listings
```

### 4. Monitor for errors
```bash
pm2 logs fyndbot --err
```

If you see:
```
CRITICAL: Blocket parser returned zero listings from non-empty HTML
```
This indicates a new parser failure. Check latest Blocket HTML structure.

## Impact Assessment
- ✅ **Mobility URLs working** (cars, boats, motorcycles, etc.)
- ✅ **No impact on HA webhook work** (`cursor/fyndbot-mvp-ace5`)
- ⚠️ **Recommerce URLs not tested** (different page structure, may need separate handling)
- 🔊 **Future parser failures will throw errors**, not silently return `[]`

## Rollback Plan
If the fix causes issues:
```bash
cd /path/to/fyndbot
git checkout main
npm run build
pm2 restart fyndbot
```

## Files Changed
- `src/blocket/fetcher.ts` - Updated parseBlocketHTML() to use JSON-LD
- `src/blocket/fetcher.test.ts` - Added comprehensive tests with fixture
- `src/blocket/__fixtures__/mobility-search.html` - Real Blocket HTML for testing

## Next Steps (Optional)
1. Test recommerce URLs (`/annonser/` paths) and add support if needed
2. Monitor logs for 24h to ensure stable operation
3. Merge PR once verified in production
