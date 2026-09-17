# Follow Feature Update — Quick Summary

## What's New

Added **`/follow`** command to track Blocket sellers and get alerts when they post new ads or remove existing ones.

### New Commands
- `/follow <seller_url>` — Track a Blocket seller's listings
- `/unfollow F<id>` — Stop following a seller
- `/list` — Now shows both Watches (W prefix) and Follows (F prefix)

### Alert Types
1. **New Ad Alert** — "👤 [Seller] posted new ad!" with full details + image
2. **Disappeared Alert** — "📤 [Seller]'s ad no longer listed" (removed/sold/expired)

### Technical Changes
- New database tables: `follows`, `follow_listings`
- Seller extraction from URLs (annonsorer + search filters)
- Background poller tracks listing states
- Disappeared detection via set comparison
- Fair-use limits: max 10 follows per user

## Testing
✅ **27 tests passing** (up from 14)
- 5 new tests for seller URL parsing
- 8 new tests for disappeared ad detection + age filtering

## Documentation
- Updated README.md with follow examples
- Updated QUICKSTART.md with new commands
- Added FOLLOW_FEATURE.md with full implementation details

## Constraints Met
✅ Public data only (no Blocket login)  
✅ Reused existing poller/fetcher patterns  
✅ Modular architecture maintained  
✅ Tests for parser + disappeared logic  
✅ Brief README updates  
✅ Scope tight (Blocket only, no Tradera/payments/HACS)

## Build Status
```
npm run build ✅
npm test ✅ (27/27 passing)
```

## Example Usage
```
/follow https://www.blocket.se/annonsorer/my-shop
/list
  Watches:
  W1. https://www.blocket.se/annonser/fordon/bilar
  
  Follows:
  F1. my shop

/unfollow F1
```

---

**Branch:** `cursor/fyndbot-mvp-ace5`  
**Ready for:** Review & Merge  
**PR:** https://github.com/Vortitron/fyndbot/compare/main...cursor/fyndbot-mvp-ace5
