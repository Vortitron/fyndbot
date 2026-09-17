# Fyndbot Quick Start Guide

## Prerequisites
- Node.js 18+
- Telegram account
- (Optional) OpenAI-compatible API key for LLM scoring
- (Optional) Stripe keys for Pro tier

## Setup (5 minutes)

### 1. Create Telegram Bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts:
   - Bot name: `Fyndbot` (or your choice)
   - Bot username: `your_fyndbot` (must end in `bot`)
4. Copy the bot token (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Clone & Install
```bash
git clone https://github.com/Vortitron/fyndbot.git
cd fyndbot
npm install
```

### 3. Configure
```bash
cp .env.example .env
nano .env  # or use your favourite editor
```

**Minimal `.env` for testing:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_step_1
DATABASE_URL=./data/fyndbot.db
NODE_ENV=development
```

### 4. Build & Run
```bash
npm run build
npm start
```

**Or for development with auto-reload:**
```bash
npm run dev
```

## Testing the Bot

### 1. Start Conversation
1. Open Telegram
2. Search for your bot username (e.g., `@your_fyndbot`)
3. Click **Start** or send `/start`

### 2. Add a Watch
```
/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020
```

Or any Blocket search/category URL.

### 3. Wait for Alerts
- New listings will appear within 2 minutes (default poll interval)
- Alerts include title, price, location, and image

### 4. Inspect a Listing (Pro Feature Test)
```
/inspect https://www.blocket.se/annons/stockholm/volvo_v70_abc123/12345678
```

Free tier: 3 inspections per week  
Pro tier: Unlimited

### 5. Manage Watches
```
/list                # Show all watches
/unwatch 1          # Remove watch ID 1
/pro                # View Pro tier info
```

## Testing with Fixtures

### Parser Tests
```bash
npm test src/blocket/fetcher.test.ts
```

Tests registration number extraction (ABC123 format).

### Scorer Tests
```bash
npm test src/scorer/index.test.ts
```

Tests heuristic bargain scoring:
- Freshness bonus
- Keyword detection (ny, oöppnad, prutbar)
- Price thresholds
- Score capping (1-10)

### Run All Tests
```bash
npm test
```

Should show: **27 tests passing**

## Common Issues

### "Missing required environment variable: TELEGRAM_BOT_TOKEN"
- Ensure `.env` file exists in project root
- Check `TELEGRAM_BOT_TOKEN` is set
- No quotes needed around token value

### "Telegram polling error: 404 Not Found"
- Bot token is invalid
- Check for extra spaces or missing characters
- Get a fresh token from @BotFather

### Database errors
- Ensure `data/` directory exists: `mkdir -p data`
- Check write permissions
- SQLite database will be created automatically

### No alerts appearing
- Verify watch URL is a valid Blocket search
- Check poll interval (default 2 minutes)
- Look for errors in console output
- Blocket's HTML structure may have changed (unofficial API)

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | - | From @BotFather |
| `DATABASE_URL` | No | `./data/fyndbot.db` | SQLite path or Postgres URL |
| `LLM_API_KEY` | No | - | OpenAI-compatible API key |
| `LLM_API_URL` | No | `https://api.openai.com/v1` | LLM endpoint |
| `STRIPE_SECRET_KEY` | No | - | For Pro tier payments |
| `POLL_INTERVAL_MINUTES` | No | `2` | How often to check watches |
| `FREE_INSPECT_WEEKLY_LIMIT` | No | `3` | Free inspections per week |
| `PRICE_PRO_MONTHLY` | No | `79` | Pro tier price (SEK) |

### Rate Limiting
- **Poll Interval**: 2 minutes (configurable)
- **Watch Delays**: 2 seconds between watches
- **Alert Window**: Only listings < 24 hours old

Fair-use design prevents excessive Blocket requests.

## Development

### Project Structure
```
src/
  index.ts              # Entry point (bot + poller startup)
  config.ts             # Environment variable parsing
  types/                # TypeScript definitions
  database/             # SQLite schema & queries
  blocket/              # Blocket fetcher + tests
  scorer/               # Bargain scoring + tests
  enrichment/           # Vehicle data (Transportstyrelsen mock)
  bot/
    handlers.ts         # Telegram command handlers
    poller.ts           # Background watch polling
```

### Key Functions

**Database** (`database/index.ts`):
- `initDatabase()` — Create schema
- `getOrCreateUser()` — User registration
- `createWatch()` — Add watch
- `markListingSeen()` — Deduplication

**Blocket** (`blocket/fetcher.ts`):
- `fetchBlocketSearch(url)` — Get listings from search
- `fetchBlocketAd(url)` — Get single ad details
- `extractRegistrationNumber(text)` — Find Swedish reg numbers
- `extractSellerFromUrl(url)` — Extract seller info from URLs

**Scorer** (`scorer/index.ts`):
- `scoreListing(listing)` — Return 1-10 score + reason
- LLM mode (if `LLM_API_KEY` set)
- Heuristic fallback (deterministic)

**Bot** (`bot/handlers.ts`):
- Command handlers: `/start`, `/watch`, `/follow`, `/list`, `/unwatch`, `/unfollow`, `/inspect`, `/pro`
- `sendAlert()` — Notify user of new listing
- `sendFollowNewAlert()` — Notify user of seller's new ad
- `sendFollowDisappearedAlert()` — Notify user when ad disappears

**Poller** (`bot/poller.ts`):
- `startPoller()` — Background interval
- `pollAllWatches()` — Check all watches for new listings
- `pollAllFollows()` — Check all follows for new/disappeared ads

### Adding Features

1. **New Command**:
   - Add handler in `bot/handlers.ts`
   - Use `bot.onText(/\/command/, handler)`

2. **New Scoring Factor**:
   - Edit `scoreWithHeuristic()` in `scorer/index.ts`
   - Add test case in `scorer/index.test.ts`

3. **Real Transportstyrelsen API**:
   - Implement `TransportstyrelsenProvider` interface
   - Replace `MockTransportstyrelsenProvider` in `enrichment/transportstyrelsen.ts`

## Deployment

### Local Development
```bash
npm run dev
```
Uses `tsx` for TypeScript execution with auto-reload.

### Production Build
```bash
npm run build
npm start
```
Compiles to `dist/` and runs with Node.js.

### Process Manager (Recommended)
```bash
npm install -g pm2
pm2 start npm --name fyndbot -- start
pm2 save
pm2 startup
```

### Docker (Future)
*Dockerfile coming soon*

## Support

### Logs
- Console output shows all events
- Polling activity every 2 minutes
- Telegram errors logged (connection, invalid token)
- Blocket fetch errors (rate limits, HTML changes)

### Debug Mode
Set `LOG_LEVEL=debug` in `.env` for verbose output.

### Common Modifications

**Change poll interval:**
```env
POLL_INTERVAL_MINUTES=5
```

**Adjust free tier limits:**
```env
FREE_INSPECT_WEEKLY_LIMIT=5
```

**Use Postgres instead of SQLite:**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/fyndbot
```

## License
MIT — See LICENSE file

## Credits
- Built by Andrew Hancock (Sweden)
- Powered by [Vome.io](https://vome.io)
- Unofficial Blocket helper (not affiliated with Blocket/Schibsted)

---

**Need help?** Check `README.md` and `PROJECT_OUTLINE.md` for detailed docs.
