# Fyndbot — Swedish Blocket.se Telegram Alert Bot

Unofficial Blocket helper bot for Telegram (not affiliated with Blocket/Schibsted).

## Features

### Free Tier
- Watch Blocket searches or category URLs for new listings
- Instant alerts with title, price (SEK), link, and thumbnail
- Commands: `/start`, `/help`, `/watch`, `/unwatch`, `/list`
- Fair-use rate limits

### Pro Tier
- AI bargain score (1–10) + reasoning on each alert
- `/inspect <blocket URL>` — analyse any Blocket ad (Free: 3/week, Pro: unlimited)
- Vehicle enrichment: Months until besiktning/tax/in-traffic (for cars with registration numbers)

## Setup

### Prerequisites
- Node.js 18+
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
4. Receive alerts when new listings appear!

### Example Commands
```
/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020
/watch https://www.blocket.se/annonser/stockholm/bostad/lagenheter
/list
/unwatch 1
/inspect https://www.blocket.se/annons/123456
```

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
- Vehicle enrichment interface ready (Transportstyrelsen mock provider included)

## Contributing

PRs welcome! Please add tests for new features.

## License

MIT — See LICENSE file.

---

*Built with care in Sweden. Powered by [Vome.io](https://vome.io)*
