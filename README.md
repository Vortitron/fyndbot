# Fyndbot — Swedish Blocket.se Telegram Alert Bot

Unofficial Blocket helper bot for Telegram (not affiliated with Blocket/Schibsted).

## Features

### Free Tier
- Watch Blocket searches or category URLs for new listings
- Follow Blocket sellers to track their ads (new listings + removals)
- Instant alerts with title, price (SEK), link, and thumbnail
- Home Assistant integration via webhooks (automate your alerts!)
- Commands: `/start`, `/help`, `/watch`, `/follow`, `/unwatch`, `/unfollow`, `/list`, `/ha`
- Fair-use rate limits

### Pro Tier
- AI bargain score (1–10) + reasoning on each alert
- `/inspect <blocket URL>` — analyse any Blocket ad (Free: 3/week, Pro: unlimited)
- Vehicle enrichment: Free data scraped from Blocket (registration number, inspection date, make/model/year)

## Setup

### Prerequisites
- Node.js 22+ (AbortController for fetch timeout)
- Telegram account
- Blocket.se access (Sweden)

### 1. Create Telegram Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow prompts
3. Save your bot token

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=./data/fyndbot.db
LLM_API_KEY=optional_openai_compatible_key
LLM_API_URL=optional_openai_compatible_endpoint
STRIPE_SECRET_KEY=optional_for_pro_tier
```

### 4. Build & Run
```bash
npm run build
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Usage

1. Start your bot on Telegram
2. Send `/start` to begin
3. Send `/watch <blocket_url>` with a Blocket search or category URL
4. Send `/follow <seller_url>` to track a specific seller's ads
5. Receive alerts when new listings appear or sellers remove ads!

### Example Commands
```
/watch https://www.blocket.se/recommerce/forsale/search?category=0.93&location=0.300001
/watch bilar stockholm
/follow https://www.blocket.se/annonsorer/seller-name
/list
/unwatch W1
/unfollow F1
/inspect https://www.blocket.se/recommerce/forsale/item/123456
/ha set https://your-ha.com/api/webhook/fyndbot_alert
```

### Following Sellers
Track specific sellers' activity:
- Get notified when they post new ads
- Get notified when ads disappear (potentially sold/expired)
- Works with seller profile URLs or search URLs filtered by seller

### Home Assistant Integration

Send Blocket alerts directly to your Home Assistant installation for powerful automations!

**Quick Start:**
```
1. Create webhook in HA (Settings → Automations → Webhook trigger)
2. /ha set https://your-ha.com/api/webhook/YOUR_ID
3. /ha test
```

**Features:**
- 🔔 Real-time alerts to Home Assistant
- ⭐ AI bargain scores included (Pro users)
- 🆓 Free for all users (lead magnet)
- 🤖 Automate based on price, score, location, category

**See:** [HA_SETUP.md](HA_SETUP.md) for detailed setup guide and automation examples.

## Pro Tier

Pricing:
- **Free**: 0 SEK/mo, 3 inspections per week
- **Pro**: 79 SEK/mo, unlimited inspections + AI scoring

Commands:
- `/pro` — View subscription status (payment integration coming soon)

## Architecture

- **TypeScript/Node.js** — Modern async/await patterns
- **SQLite** — Local persistence (Postgres via DATABASE_URL optional)
- **node-telegram-bot-api** — Reliable Telegram integration
- **Modular design** — Pluggable fetchers, scorers, enrichers

### Project Structure
```
src/
  index.ts              Main entry point
  bot/                  Telegram bot handlers
  blocket/              Blocket API integration
  database/             SQLite schema & queries
  scorer/               Bargain scoring logic
  enrichment/           Vehicle data enrichment
  types/                TypeScript definitions
```

## Pro Tier Setup

### Stripe Configuration (Real Payments)

Fyndbot Pro uses Stripe for secure subscription payments. See detailed setup guide:

**📖 [STRIPE_SETUP.md](STRIPE_SETUP.md)**

Quick summary:
1. Create Stripe Price (79 SEK/month recurring)
2. Configure webhook endpoint at `https://fynd.vome.io/api/stripe/webhook`
3. Set environment variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FYNDBOT_PRO`
4. Configure nginx proxy to forward webhook requests to port 3847

**Stripe Test Mode:** For testing, configure `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`, and `STRIPE_TEST_PRICE_FYNDBOT_PRO`. Add test users to allowlist via `STRIPE_SANDBOX_TELEGRAM_IDS` and `STRIPE_SANDBOX_USERNAMES` (comma-separated). Allowlisted users get test checkout with test cards (4242 4242 4242 4242).

### OpenRouter / LLM Configuration (AI Scoring)

Fyndbot uses OpenRouter for AI-powered bargain scoring. See detailed setup guide:

**📖 [OPENROUTER_SETUP.md](OPENROUTER_SETUP.md)**

Quick summary:
1. Create account at [openrouter.ai](https://openrouter.ai)
2. Add credits ($5-10 for testing)
3. Get API key
4. Set environment variables: `LLM_API_KEY`, `LLM_API_URL`, `LLM_MODEL`
5. Default model: `openai/gpt-4.1-mini` (~$0.0001 per scoring, calibrated for quality)

**Without LLM:** Bot falls back to deterministic heuristic scoring (no API key needed).

## Testing

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
```

Minimum coverage: parser and scorer modules.

## Development Notes

- Fair-use polling: 2-minute intervals per watch
- Image thumbnails cached when available
- Graceful degradation if LLM key missing (uses deterministic scoring)
- Vehicle enrichment: Free data scraped from Blocket detail pages (dt/dd pairs + JSON attributes)
- Enrichment is fail-safe: alerts send even if detail fetch fails

## Contributing

PRs welcome! Please add tests for new features.

## License

MIT — See LICENSE file.

---

*Built with care in Sweden. Powered by [Vome.io](https://vome.io)*
