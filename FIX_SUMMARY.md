# Blocket Parser Fix - Complete Summary

## ✅ All Requirements Met

### 1. ✅ fetchBlocketSearch returns >0 listings with real data
- **Live test:** 49 listings from Skåne car search
- All fields populated: id, title, price, url, imageUrl
- Example: BMW 530d - 249000 SEK - https://www.blocket.se/mobility/item/26676063

### 2. ✅ Tests cover the new parse path
- 18/18 tests passing
- Added fixture with real Blocket HTML (893 lines)
- Tests verify: correct parsing, empty HTML throws error, multiple listings extraction

### 3. ✅ Empty successful-page parse is no longer silent
- Throws: `Blocket parser failed: zero listings extracted from search page`
- Logs: `CRITICAL: Blocket parser returned zero listings from non-empty HTML`
- No more silent failures where poller only updates `last_checked`

### 4. ✅ Branch pushed and ready
- Branch: `cursor/fix-blocket-parser-79ad`
- 3 commits:
  1. Fix Blocket parser to use JSON-LD structured data
  2. Add deployment notes for Fin1 production
  3. Add technical reference for parser changes

### 5. ✅ Deployment documentation complete
- `DEPLOYMENT_NOTES.md` - Step-by-step Fin1 deployment guide
- `PARSER_CHANGES.md` - Technical reference for future maintenance
- One-line verification test included

---

## 📋 For Repository Owner

Since I don't have collaborator access, please create the PR manually:

### PR Creation
1. Go to: https://github.com/Vortitron/fyndbot/pull/new/cursor/fix-blocket-parser-79ad
2. Title: **Fix Blocket parser - replace __NEXT_DATA__ with JSON-LD parsing**
3. Base branch: `main`
4. Use the PR body below

### Suggested PR Body

```markdown
## Problem
Production Fyndbot on Fin1 stopped sending Telegram alerts because Blocket changed their frontend architecture:
- Removed `__NEXT_DATA__` script tag
- Now uses JSON-LD structured data (`application/ld+json` with `id="seoStructuredData"`)
- Old parser returned empty array `[]`, causing silent failure (poller only updated `last_checked`)
- Last successful alerts: ~2026-09-17 afternoon Stockholm time

## Solution
Updated `parseBlocketHTML()` to parse JSON-LD `ItemList` instead of `__NEXT_DATA__`:
- Extracts listings from `mainEntity.itemListElement[]` 
- Maps Product schema to BlocketListing interface
- **Added loud failure**: throws error if zero listings parsed from non-empty HTML
- Exported `parseBlocketHTML()` for direct testing

## Testing
✅ All tests passing (18/18)
- Added fixture test with real Blocket mobility search HTML (893 lines)
- Tests verify parser extracts correct id, title, price, url, imageUrl
- Tests verify empty HTML throws error (no more silent failures)
- Live fetch verified: **49 listings** from Skåne car search

## Deployment (Fin1)
See `DEPLOYMENT_NOTES.md` for complete instructions.

Quick steps:
```bash
cd /path/to/fyndbot
git pull origin cursor/fix-blocket-parser-79ad
npm run build
pm2 restart fyndbot
```

Verify:
```bash
node -e "import('./dist/blocket/fetcher.js').then(m => m.fetchBlocketSearch('https://www.blocket.se/mobility/search/car?location=0.300012').then(l => console.log('✓ Found', l.length, 'listings')))"
```

## Impact
- ✅ Mobility URLs (cars, boats, etc.) working
- ✅ No impact on HA webhook work (`cursor/fyndbot-mvp-ace5`)
- ⚠️ Recommerce URLs not tested (different page structure, likely needs separate handling)
- 🔊 Future parser failures will throw errors, not silently return `[]`

## Files Changed
- `src/blocket/fetcher.ts` - Updated parseBlocketHTML() to use JSON-LD
- `src/blocket/fetcher.test.ts` - Added comprehensive tests with fixture
- `src/blocket/__fixtures__/mobility-search.html` - Real Blocket HTML for testing
- `DEPLOYMENT_NOTES.md` - Deployment guide
- `PARSER_CHANGES.md` - Technical reference
```

---

## 🚀 Immediate Next Steps for Fin1

1. **Pull and deploy:**
   ```bash
   cd /path/to/fyndbot
   git fetch origin
   git checkout cursor/fix-blocket-parser-79ad
   npm run build
   pm2 restart fyndbot
   ```

2. **Verify (wait 2 min or run immediately):**
   ```bash
   node -e "import('./dist/blocket/fetcher.js').then(m => m.fetchBlocketSearch('https://www.blocket.se/mobility/search/car?location=0.300012').then(l => console.log('✓ Found', l.length, 'listings')))"
   ```

3. **Monitor:**
   ```bash
   pm2 logs fyndbot --lines 100
   ```
   Look for: `Found N new listings`

4. **If successful, merge PR** (after 24h monitoring recommended)

---

## 📊 What Changed Technically

**Before:**
```javascript
// Looked for __NEXT_DATA__ (no longer exists)
const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
```

**After:**
```javascript
// Looks for JSON-LD structured data (current format)
const jsonLdMatch = html.match(/<script[^>]*id="seoStructuredData"[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
```

See `PARSER_CHANGES.md` for complete technical reference.

---

## 🔍 Future Maintenance

If Blocket changes format again:

1. Fetch live page: `curl -A "Mozilla/5.0" "URL" > blocket.html`
2. Inspect: `grep 'application/ld+json\|__NEXT_DATA__\|application/json' blocket.html`
3. Update parser in `src/blocket/fetcher.ts`
4. Add new fixture to `src/blocket/__fixtures__/`
5. Update tests in `src/blocket/fetcher.test.ts`

The new error handling will catch future failures loudly instead of silently.
