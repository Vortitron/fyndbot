# Fyndbot Deployment Guide

## Production Deployment (Fin1 Server)

### Prerequisites
- Node.js 22+ (required for AbortController in fetch)
- PM2 process manager
- Git access to repository
- Environment variables configured in `.env`

### Initial Setup

```bash
# Clone repository
git clone https://github.com/Vortitron/fyndbot.git
cd fyndbot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js --name fyndbot
pm2 save
```

### Updating to Latest Version

When new features are merged (like Blocket detail enrichment):

```bash
cd /path/to/fyndbot

# Pull latest changes
git pull

# Install any new dependencies
npm install

# Rebuild TypeScript
npm run build

# Restart the bot
pm2 restart fyndbot

# Check logs
pm2 logs fyndbot --lines 50
```

### Quick Update Commands

```bash
cd /path/to/fyndbot && git pull && npm install && npm run build && pm2 restart fyndbot
```

### Rollback

If issues occur:

```bash
# View recent commits
git log --oneline -10

# Rollback to previous commit
git reset --hard <commit-hash>

# Rebuild and restart
npm run build && pm2 restart fyndbot
```

### Health Checks

```bash
# Check process status
pm2 status

# View real-time logs
pm2 logs fyndbot

# Check for errors in last 100 lines
pm2 logs fyndbot --lines 100 --err

# Monitor resource usage
pm2 monit
```

### PM2 Configuration

Save this as `ecosystem.config.cjs` for advanced PM2 setup:

```javascript
module.exports = {
	apps: [{
		name: 'fyndbot',
		script: './dist/index.js',
		instances: 1,
		exec_mode: 'fork',
		watch: false,
		max_memory_restart: '500M',
		env: {
			NODE_ENV: 'production',
		},
		error_file: './logs/pm2-error.log',
		out_file: './logs/pm2-out.log',
		log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
		merge_logs: true,
		autorestart: true,
		max_restarts: 10,
		min_uptime: '10s',
	}]
};
```

Then use:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### Database Backups

SQLite database is stored at `./data/fyndbot.db`:

```bash
# Create backup
cp ./data/fyndbot.db ./data/fyndbot.db.backup-$(date +%Y%m%d-%H%M%S)

# Automated daily backups (add to crontab)
0 3 * * * cd /path/to/fyndbot && cp ./data/fyndbot.db ./data/backups/fyndbot.db.$(date +\%Y\%m\%d)
```

### Environment Variables

Required variables in `.env`:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
DATABASE_URL=./data/fyndbot.db

# Optional but recommended for Pro features
LLM_API_KEY=your_openrouter_key
LLM_API_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4.1-mini

# Optional for Stripe Pro subscriptions
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_FYNDBOT_PRO=price_...

# Optional settings
PUBLIC_BASE_URL=https://fynd.vome.io
POLL_INTERVAL_MINUTES=2
FREE_INSPECT_WEEKLY_LIMIT=3
NODE_ENV=production
LOG_LEVEL=info
```

### Nginx Configuration (if using webhooks/web endpoints)

```nginx
server {
	listen 443 ssl http2;
	server_name fynd.vome.io;

	ssl_certificate /path/to/cert.pem;
	ssl_certificate_key /path/to/key.pem;

	location /api/stripe/webhook {
		proxy_pass http://localhost:3847;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_cache_bypass $http_upgrade;
	}
}
```

### Monitoring

```bash
# Real-time log monitoring
tail -f ./logs/pm2-out.log

# Check for errors
grep -i error ./logs/pm2-error.log | tail -20

# Monitor polling activity
pm2 logs fyndbot | grep "Polling"

# Check alert sending
pm2 logs fyndbot | grep "Sent Telegram message"
```

### Troubleshooting

#### Bot not responding
```bash
# Check if process is running
pm2 status

# Check logs for errors
pm2 logs fyndbot --err

# Restart
pm2 restart fyndbot
```

#### High memory usage
```bash
# Check current usage
pm2 monit

# Restart with memory limit
pm2 restart fyndbot --max-memory-restart 500M
```

#### Database locked
```bash
# Check for zombie processes
ps aux | grep fyndbot

# Kill if needed
pm2 delete fyndbot
pm2 start dist/index.js --name fyndbot
```

#### Blocket enrichment failing
Check logs for:
- `Failed to fetch Blocket detail: 403` → User-Agent blocked
- `Failed to fetch Blocket detail: 429` → Rate limited (implement backoff)
- `Error fetching Blocket detail: timeout` → Network issues

Enrichment is fail-safe: alerts still send without vehicle data.

### Performance Tuning

#### Reduce polling load
```env
POLL_INTERVAL_MINUTES=5  # Increase from 2 to 5 minutes
```

#### Disable enrichment for non-mobility
Edit `src/bot/handlers.ts` to skip enrichment for non-vehicle categories.

#### Rate limiting
Bot already implements 1-2 second delays between alerts to avoid Telegram rate limits.

### Security Checklist

- [ ] `.env` file not committed to git
- [ ] Telegram bot token kept secret
- [ ] Stripe webhook secret verified
- [ ] Database file not publicly accessible
- [ ] PM2 logs rotated (use `pm2 install pm2-logrotate`)
- [ ] Server firewall configured (only necessary ports open)
- [ ] Regular security updates: `npm audit fix`

### Production Checklist

- [ ] Node.js 22+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] Built successfully (`npm run build`)
- [ ] Environment variables configured
- [ ] Database initialised (automatic on first run)
- [ ] PM2 running and saved
- [ ] Logs monitored
- [ ] Backup script configured
- [ ] Health checks passing

### Support

For issues:
1. Check logs: `pm2 logs fyndbot`
2. Review recent commits: `git log --oneline -10`
3. Check [GitHub Issues](https://github.com/Vortitron/fyndbot/issues)
4. Contact maintainer

---

*Last updated: 2026-09-18 (Blocket detail enrichment feature)*
