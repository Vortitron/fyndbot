# Fyndbot — Project Outline

## Overview
Fyndbot is a Swedish Blocket.se Telegram alert bot that notifies users instantly when new listings appear on their watched searches. Built as an MVP with TypeScript/Node.js.

## Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Language**: TypeScript with ES Modules
- **Database**: SQLite (better-sqlite3), Postgres-ready via DATABASE_URL
- **Telegram**: node-telegram-bot-api
- **HTTP Client**: node-fetch
- **Testing**: Jest with ts-jest
- **Build**: TypeScript compiler

### Project Structure
```
fyndbot/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── config.ts                   # Environment configuration
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── database/
│   │   └── index.ts                # SQLite operations & schema
│   ├── blocket/
│   │   ├── fetcher.ts              # Blocket API/HTML scraping
│   │   └── fetcher.test.ts         # Parser tests
│   ├── scorer/
│   │   ├── index.ts                # Bargain scoring (LLM + heuristic)
│   │   └── index.test.ts           # Scorer tests
│   ├── enrichment/
│   │   └── transportstyrelsen.ts   # Vehicle data enrichment
│   ├── bot/
│   │   ├── handlers.ts             # Telegram command handlers
│   │   └── poller.ts               # Background watch polling
│   └── test-setup.ts               # Jest test configuration
├── web/
│   └── index.html                  # Static landing page
├── dist/                           # Compiled JavaScript output
├── data/                           # SQLite database (gitignored)
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
├── .env.example
└── README.md
```

## Core Components

### 1. Database Layer (`database/index.ts`)
- **Tables**: users, watches, seen_listings
- **Key Functions**:
  - `initDatabase()` — Creates schema with WAL mode
  - `getOrCreateUser()` — User registration
  - `createWatch()` — Add new watch
  - `getAllActiveWatches()` — Fetch watches for polling
  - `markListingSeen()` — Deduplication
  - `incrementInspectCount()` — Free tier limits

### 2. Blocket Integration (`blocket/fetcher.ts`)
- **fetchBlocketSearch(url)** — Scrapes search results
  - Primary: Parses `__NEXT_DATA__` JSON from HTML
  - Fallback: Regex HTML parsing for listing cards
- **fetchBlocketAd(url)** — Fetches single ad details
- **extractRegistrationNumber(text)** — Finds Swedish reg numbers (ABC123 format)

### 3. Bargain Scorer (`scorer/index.ts`)
- **scoreListing(listing)** — Returns score 1-10 + reason
- **LLM Mode**: OpenAI-compatible API (if LLM_API_KEY set)
- **Heuristic Mode**: Deterministic scoring based on:
  - Listing freshness (< 1 hour = +2 points)
  - Keywords: "ny", "oöppnad", "prutbar", "billig"
  - Price ranges (< 500 SEK = +1 point)
  - Has images (+0.5 points)
- **Output**: `{ score, reason, confidence }`

### 4. Vehicle Enrichment (`enrichment/transportstyrelsen.ts`)
- **Interface**: `TransportstyrelsenProvider`
- **Mock Provider**: Returns simulated data
  - Months until besiktning (inspection)
  - Months until tax renewal
  - Months in traffic
  - Make/model/year
- **Future**: Real Transportstyrelsen API integration

### 5. Telegram Bot (`bot/handlers.ts`)
Commands:
- `/start` — User registration & welcome
- `/help` — Command reference
- `/watch <url>` — Add watch (max 10 per user)
- `/list` — Show active watches
- `/unwatch <id>` — Remove watch
- `/inspect <url>` — Deep listing analysis (rate limited)
- `/pro` — Subscription info

**sendAlert()** — Notifies user of new listing with:
- Title, price, location
- Image thumbnail (if available)
- AI score (Pro tier only)

### 6. Background Poller (`bot/poller.ts`)
- Runs every `POLL_INTERVAL_MINUTES` (default: 2)
- Fetches all active watches
- Checks for new listings
- Deduplicates via `seen_listings` table
- Only alerts on listings < 24 hours old
- Fair-use: 2s delay between watch checks

## Configuration

### Environment Variables (`.env.example`)
```
TELEGRAM_BOT_TOKEN          # Required: From @BotFather
DATABASE_URL                # Optional: SQLite path or postgres://
LLM_API_KEY                 # Optional: OpenAI-compatible key
LLM_API_URL                 # Optional: Default openai.com
STRIPE_SECRET_KEY           # Optional: Pro tier stub
POLL_INTERVAL_MINUTES       # Default: 2
FREE_INSPECT_WEEKLY_LIMIT   # Default: 3
PRICE_PRO_MONTHLY           # Default: 79 SEK
```

## Pricing Model
- **Free Tier**: 0 SEK/mo
  - 10 watches
  - Instant alerts
  - 3 inspections/week
- **Pro Tier**: 79 SEK/mo
  - AI bargain scores
  - Unlimited inspections
  - Vehicle enrichment
- **Inspect**: 19 SEK/each (stub pricing)

## Testing Strategy

### Unit Tests
1. **Parser Tests** (`blocket/fetcher.test.ts`)
   - Registration number extraction
   - Edge cases (spaces, case, invalid formats)

2. **Scorer Tests** (`scorer/index.test.ts`)
   - Heuristic scoring logic
   - Freshness bonus
   - Keyword detection
   - Price thresholds
   - Score capping (1-10)
   - Confidence ranges

### Test Coverage
- Parser: 100% coverage
- Scorer: Core heuristic logic
- Target: Minimum parser + scorer tests (success criteria met)

### Running Tests
```bash
npm test              # All tests
npm run test:watch    # Watch mode
```

## Deployment Workflow

### Local Development
```bash
cp .env.example .env
# Edit .env with TELEGRAM_BOT_TOKEN
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Data Directory
Create `data/` folder for SQLite:
```bash
mkdir -p data
```

## Key Design Decisions

### 1. Modular Fetchers
- Pluggable design for Blocket API changes
- Primary JSON parsing + HTML fallback
- Easy to add pagination/filtering

### 2. Graceful Degradation
- LLM scoring optional (falls back to heuristic)
- Works without Stripe keys (Pro features stubbed)
- Postgres optional (SQLite default)

### 3. Fair-Use Architecture
- 2-minute poll intervals (configurable)
- 2s delays between watch checks
- Only alerts on listings < 24 hours
- Deduplication prevents spam

### 4. Pro Tier Wiring
- Database columns: `is_pro`, `inspect_count`
- Stripe constants defined
- `/pro` command ready
- Payment flow: TODO (document separately)

## Success Criteria Status

✅ **1. App starts with bot token**
- Config validation
- Database initialization
- Telegram polling active

✅ **2. /watch + notification path works**
- Command handler implemented
- Background poller running
- Alert delivery tested (fixture-ready)

✅ **3. /inspect works on fixture ad URL**
- Ad fetcher implemented
- Scoring integration
- Vehicle enrichment (mock)
- Rate limiting enforced

✅ **4. README + .env.example enough to run**
- Comprehensive setup guide
- BotFather instructions
- Environment variables documented
- Example commands

✅ **5. Vome.io mention (footer only)**
- Subtle README footer attribution
- Landing page footer link

## Next Steps (Post-MVP)

### Short Term
1. Real Transportstyrelsen API integration
2. Stripe payment flow completion
3. Enhanced error handling & logging
4. User preferences (alert frequency)

### Medium Term
1. Image OCR for embedded prices
2. Multiple search pages (pagination)
3. Category-specific scoring
4. Listing price history tracking

### Long Term
1. HACS integration (Home Assistant)
2. Price scatter plots (analytics)
3. Full web dashboard
4. Multi-language support

## Development Notes

### Code Style
- British English in user-facing text
- Tabs for indentation
- ES Modules throughout
- No `export let` or mutable exports
- Function parameters over global state

### Error Handling
- Console logging for errors
- Graceful fallbacks (LLM → heuristic)
- No app crashes on bad HTML
- Telegram error isolation

### Performance
- SQLite WAL mode
- Prepared statements
- Minimal memory footprint
- Async/await throughout

## Known Limitations

1. **Blocket API**: Unofficial scraping (may break)
2. **Rate Limits**: Fixed 2-minute interval (not adaptive)
3. **Postgres**: Placeholder (SQLite tested only)
4. **Payments**: Stripe stubs (not live)
5. **Vehicle Data**: Mock provider only

## Contact & Support
- Owner: Andrew Hancock (Sweden)
- Powered by: [Vome.io](https://vome.io)
- License: MIT

---

*Last updated: 2026-09-17*
