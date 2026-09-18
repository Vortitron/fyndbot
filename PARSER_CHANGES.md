# Blocket Parser Changes - Technical Reference

## What Changed

### Before (Old Parser - Broken)
```javascript
// Looked for __NEXT_DATA__ script tag
const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
const data = JSON.parse(scriptMatch[1]);
const searchData = data?.props?.pageProps?.initialData?.data;
// This no longer exists in Blocket's HTML
```

### After (New Parser - Working)
```javascript
// Looks for JSON-LD structured data
const jsonLdMatch = html.match(/<script[^>]*id="seoStructuredData"[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
const data = JSON.parse(jsonLdMatch[1]);
const itemList = data?.mainEntity?.itemListElement;
// This is the new format Blocket uses
```

## JSON-LD Structure

Blocket now embeds search results as Schema.org JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "Product",
          "name": "Toyota RAV4",
          "description": "Adventure 2,5 Hybrid AWD-I...",
          "brand": { "@type": "Brand", "name": "Toyota" },
          "model": "RAV4",
          "offers": {
            "@type": "Offer",
            "price": "439900",
            "priceCurrency": "SEK"
          },
          "image": "https://images.blocketcdn.se/...",
          "url": "https://www.blocket.se/mobility/item/26676756"
        }
      }
    ]
  }
}
```

## Mapping

| BlocketListing Field | JSON-LD Source |
|---------------------|----------------|
| `id` | Extracted from `item.url` (e.g., `/item/26676756`) |
| `title` | `item.name` |
| `price` | `parseInt(item.offers.price, 10)` |
| `currency` | `item.offers.priceCurrency` |
| `url` | `item.url` (full URL) |
| `imageUrl` | `item.image` |
| `description` | `item.description` |
| `publishedAt` | `new Date()` (not in JSON-LD) |
| `location` | `null` (not in JSON-LD) |
| `category` | `null` (not in JSON-LD) |

## Error Handling

**Critical change:** Parser now throws on empty result:

```javascript
if (listings.length === 0) {
	console.error('CRITICAL: Blocket parser returned zero listings from non-empty HTML');
	throw new Error('Blocket parser failed: zero listings extracted from search page');
}
```

This prevents silent failures. If Blocket changes format again, the error will be logged and the poller will fail loudly.

## URL Compatibility

### ✅ Tested and Working
- Mobility URLs: `https://www.blocket.se/mobility/search/car?location=0.300012`
- All mobility categories (cars, boats, motorcycles, etc.)

### ⚠️ Not Yet Tested
- Recommerce URLs: `https://www.blocket.se/annonser/...`
- Legacy category URLs

If recommerce URLs fail, they may need a separate parser or the JSON-LD might be in a different location.

## Testing

Run live test:
```bash
node -e "import('./dist/blocket/fetcher.js').then(m => m.fetchBlocketSearch('https://www.blocket.se/mobility/search/car?location=0.300012').then(l => console.log('Found', l.length, 'listings')))"
```

Expected: `Found 40+ listings`

Run unit tests:
```bash
npm test
```

Expected: All 18 tests pass

## Future Maintenance

If Blocket changes their format again:

1. Fetch a live search page:
   ```bash
   curl -A "Mozilla/5.0" "https://www.blocket.se/mobility/search/car?location=0.300012" > blocket.html
   ```

2. Inspect for data sources:
   ```bash
   grep -o '<script[^>]*type="[^"]*"' blocket.html
   grep 'application/json' blocket.html
   grep 'application/ld+json' blocket.html
   ```

3. Look for:
   - JSON-LD (`<script type="application/ld+json">`)
   - RSC payload (React Server Components)
   - XHR/API endpoints (check Network tab)
   - Embedded data in script tags

4. Update `parseBlocketHTML()` accordingly

5. Add new fixture HTML to `src/blocket/__fixtures__/`

6. Update tests in `src/blocket/fetcher.test.ts`
