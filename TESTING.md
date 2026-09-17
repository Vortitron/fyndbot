# Fyndbot Testing Guide

## Automated Tests

### Run All Tests
```bash
npm test
```

Expected output: **14 tests passing**

### Test Suites

#### 1. Blocket Parser Tests (`src/blocket/fetcher.test.ts`)
Tests registration number extraction from Swedish vehicle listings.

**Coverage:**
- Valid Swedish format (ABC123)
- Lowercase input normalisation
- Space handling (ABC 123 → ABC123)
- Mixed alphanumeric endings (ABC12A, XYZ991)
- Invalid pattern rejection
- Multiple pattern handling

**Run:**
```bash
npm test src/blocket/fetcher.test.ts
```

#### 2. Bargain Scorer Tests (`src/scorer/index.test.ts`)
Tests heuristic scoring algorithm (1-10 scale).

**Coverage:**
- Freshness bonus (< 1 hour = +2, < 6 hours = +1)
- Keyword detection:
  - "ny", "oöppnad", "oanvänd" = +1.5
  - "bra skick", "fint skick" = +0.5
  - "billig", "prutbar", "säljes snabbt" = +1
- Price thresholds:
  - < 500 SEK = +1
  - < 2000 SEK = +0.5
- Image availability = +0.5
- Score capping (1-10 range)
- Confidence ranges (0.0-1.0)
- No-price handling

**Run:**
```bash
npm test src/scorer/index.test.ts
```

### Coverage Report
```bash
npm test -- --coverage
```

Target coverage:
- Parser: 100%
- Scorer: 90%+
- Overall: 70%+

## Manual Testing

### Prerequisites
1. Valid `TELEGRAM_BOT_TOKEN` in `.env`
2. Bot running: `npm run dev`
3. Telegram app open

### Test Plan

#### Test 1: User Registration
**Steps:**
1. Open Telegram
2. Search for your bot
3. Send `/start`

**Expected:**
- Welcome message with command list
- User created in database
- No errors in console

**Verify:**
```bash
sqlite3 data/fyndbot.db "SELECT * FROM users;"
```

#### Test 2: Add Watch
**Steps:**
1. Send: `/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020`
2. Wait for confirmation

**Expected:**
- Success message with watch ID
- Watch created in database

**Verify:**
```bash
sqlite3 data/fyndbot.db "SELECT * FROM watches;"
```

#### Test 3: List Watches
**Steps:**
1. Send: `/list`

**Expected:**
- Shows all active watches with IDs
- URLs displayed (truncated if > 50 chars)
- Instructions to use `/unwatch`

#### Test 4: Wait for Alert
**Wait:** Up to 2 minutes (poll interval)

**Expected:**
- New listings appear as messages
- Title, price (SEK), location shown
- Image thumbnail (if available)
- Link to Blocket ad

**Verify polling in console:**
```
Polling 1 active watches...
Watch 1: Found 3 new listings
```

#### Test 5: Inspect Listing
**Steps:**
1. Copy a Blocket ad URL
2. Send: `/inspect <url>`

**Expected:**
- "🔍 Inspecting listing..." message
- Inspection report with:
  - Title, price, location
  - Bargain score (1-10) + reasoning
  - Vehicle info (if registration number found)
  - Inspections remaining count

**Free tier check:**
- 3 inspections per week
- 4th attempt shows upgrade message

#### Test 6: Vehicle Enrichment
**Steps:**
1. Find a car listing with registration number (e.g., ABC123)
2. Send: `/inspect <url>`

**Expected:**
- Vehicle Info section appears
- Make/model/year (if available)
- Months until besiktning
- Months until tax
- Mock data returned (real API not implemented)

#### Test 7: Pro Status Check
**Steps:**
1. Send: `/pro`

**Expected:**
- Free users: Pro features list + pricing
- Pro users: Confirmation message
- Payment integration note (coming soon)

#### Test 8: Remove Watch
**Steps:**
1. Get watch ID from `/list`
2. Send: `/unwatch 1`

**Expected:**
- Confirmation message
- Watch marked inactive in database
- No more alerts from that watch

**Verify:**
```bash
sqlite3 data/fyndbot.db "SELECT * FROM watches WHERE active = 1;"
```

#### Test 9: Max Watches Limit
**Steps:**
1. Add 10 watches via `/watch`
2. Try adding 11th watch

**Expected:**
- Error message: "Maximum of 10 watches"
- Instruction to use `/unwatch`

#### Test 10: Invalid Commands
**Test cases:**
```
/watch                     # No URL
/watch https://google.com  # Non-Blocket URL
/unwatch                   # No ID
/unwatch 999               # Invalid ID
/inspect                   # No URL
/inspect https://google.com # Non-Blocket ad URL
```

**Expected:**
- Helpful error messages
- Usage examples
- No crashes

## Integration Testing

### Test Blocket Fetcher (Real Data)

#### Search Results
```bash
node -e "
import('./dist/blocket/fetcher.js').then(async m => {
  const listings = await m.fetchBlocketSearch('https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020');
  console.log('Found listings:', listings.length);
  console.log('First listing:', JSON.stringify(listings[0], null, 2));
});
"
```

**Expected:**
- Array of listings (10-50 typical)
- Each listing has: id, title, price, url, imageUrl
- No parse errors

#### Single Ad
```bash
node -e "
import('./dist/blocket/fetcher.js').then(async m => {
  const ad = await m.fetchBlocketAd('https://www.blocket.se/annons/1531896073');
  console.log('Ad:', JSON.stringify(ad, null, 2));
});
"
```

**Expected:**
- Single listing object
- Full details (title, price, description, location)
- Published date

### Test Scorer (Heuristic Mode)

```bash
node -e "
import('./dist/scorer/index.js').then(async m => {
  const listing = {
    id: '123',
    title: 'Ny iPhone 15 Pro oöppnad billig',
    price: 8000,
    currency: 'SEK',
    url: 'https://test.com',
    imageUrl: 'https://test.com/img.jpg',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    location: 'Stockholm',
    category: 'Mobiler',
    description: 'Brand new'
  };
  const score = await m.scoreListing(listing);
  console.log('Score:', score);
});
"
```

**Expected:**
- Score: 8-10 (fresh + keywords + has image)
- Reason: Combination of positive factors
- Confidence: 0.6

### Test Database Operations

```bash
sqlite3 data/fyndbot.db << 'EOF'
.headers on
.mode column
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as watch_count FROM watches WHERE active = 1;
SELECT COUNT(*) as seen_count FROM seen_listings;
SELECT telegram_id, is_pro, inspect_count FROM users;
EOF
```

**Expected:**
- Tables exist
- Data persists across restarts
- Foreign keys enforced

## Performance Testing

### Polling Speed
Monitor console output during polling:
```
Polling 5 active watches...
Watch 1: Found 2 new listings
Watch 2: Found 0 new listings
Watch 3: Found 1 new listings
Watch 4: Found 0 new listings
Watch 5: Found 0 new listings
```

**Expected timing:**
- Initial check: < 5s per watch
- With seen cache: < 2s per watch
- Total cycle (5 watches): < 15s

### Memory Usage
```bash
ps aux | grep "node.*fyndbot"
```

**Expected:**
- RSS < 100 MB (typical)
- No memory leaks over 24 hours

### Database Size
```bash
ls -lh data/fyndbot.db
```

**Expected growth:**
- Empty: ~20 KB
- 1000 seen listings: ~100 KB
- 10,000 seen listings: ~1 MB

## Error Scenarios

### Test 1: Blocket Unavailable
Simulate by adding invalid URL:
```
/watch https://www.blocket.se/nonexistent
```

**Expected:**
- Watch created
- Polling logs errors but continues
- No crash

### Test 2: Database Corruption
```bash
echo "corrupted" > data/fyndbot.db
npm start
```

**Expected:**
- Error logged
- App exits gracefully
- Fix by deleting database (recreates)

### Test 3: Invalid Bot Token
Set `TELEGRAM_BOT_TOKEN=invalid` and start.

**Expected:**
- "404 Not Found" error
- App logs error
- Instructions to check token

### Test 4: No Database Permissions
```bash
chmod 000 data/
npm start
```

**Expected:**
- Permission error
- App exits with clear message
- Fix: `chmod 755 data/`

## Regression Testing

### Before Each Release

1. ✅ All automated tests pass
2. ✅ `/start` registers new user
3. ✅ `/watch` adds watch successfully
4. ✅ Alerts arrive within poll interval
5. ✅ `/inspect` returns score
6. ✅ Vehicle enrichment works (mock)
7. ✅ Free tier limits enforced
8. ✅ `/unwatch` removes watch
9. ✅ App runs for 1+ hour without crashes
10. ✅ Database persists across restarts

### Checklist

```
[ ] npm test → 14 passing
[ ] npm run build → No errors
[ ] npm start → App starts
[ ] Real Blocket fetch works
[ ] Scorer returns valid scores (1-10)
[ ] Registration number extraction accurate
[ ] Telegram commands respond
[ ] Polling logs activity
[ ] Database queries succeed
[ ] No memory leaks (check after 1 hour)
```

## Test Data

### Sample Blocket URLs

**Cars:**
```
https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020
```

**Apartments (Stockholm):**
```
https://www.blocket.se/annonser/stockholm/bostad/lagenheter?cg=1030
```

**Electronics:**
```
https://www.blocket.se/annonser/hela_sverige/elektronik?cg=4000
```

### Sample Registration Numbers
- ABC123
- XYZ456
- ABC12A
- DEF991

### Sample Scores (Expected Ranges)

| Listing Type | Expected Score |
|--------------|----------------|
| New, cheap, fresh | 8-10 |
| Good condition, moderate price | 6-7 |
| Old listing, high price | 3-5 |
| No details, no price | 4-5 |

## Debugging Tips

### Enable Verbose Logging
```env
LOG_LEVEL=debug
```

### Watch Database Changes
```bash
watch -n 1 'sqlite3 data/fyndbot.db "SELECT COUNT(*) FROM seen_listings;"'
```

### Monitor Telegram Polling
```bash
npm run dev 2>&1 | grep -E '(Polling|Found|Error)'
```

### Test Single Function
```bash
node --loader tsx src/blocket/fetcher.ts
# Add test code at bottom of file temporarily
```

## CI/CD Integration (Future)

### GitHub Actions Workflow
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
      - run: npm run build
```

### Required Secrets
- None for automated tests
- `TELEGRAM_BOT_TOKEN` for integration tests (optional)

## Known Issues

1. **Blocket HTML Changes**: Fetcher may break if Blocket updates structure
   - Solution: Update parser regex/JSON paths
   
2. **Rate Limiting**: Too many watches may trigger Blocket blocks
   - Mitigation: 2-minute intervals, 2s delays
   
3. **Telegram Flood Control**: Sending too many messages quickly
   - Mitigation: 1s delays between alerts

## Support

If tests fail:
1. Check Node.js version (18+)
2. Clear `node_modules`: `rm -rf node_modules && npm install`
3. Delete database: `rm data/fyndbot.db` (recreates on start)
4. Check Blocket availability: `curl https://www.blocket.se`
5. Verify Telegram token: Test with @BotFather

---

**Last updated:** 2026-09-17
