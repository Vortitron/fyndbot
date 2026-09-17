# Stripe Setup Guide for Fyndbot Pro

This guide explains how to configure Stripe for Fyndbot Pro subscriptions (79 SEK/month).

---

## Prerequisites

- Stripe account ([stripe.com](https://stripe.com))
- Domain with HTTPS (e.g., fynd.vome.io)
- Fyndbot running on a server

---

## 1. Create Stripe Price

### Step 1: Log in to Stripe Dashboard
Visit [dashboard.stripe.com](https://dashboard.stripe.com)

### Step 2: Create Product
1. Go to **Products** in the sidebar
2. Click **+ Add product**
3. Fill in:
   - **Name:** Fyndbot Pro
   - **Description:** AI-powered bargain scoring + unlimited inspections
   - **Pricing model:** Recurring
   - **Price:** 79 SEK
   - **Billing period:** Monthly
4. Click **Save product**

### Step 3: Copy Price ID
- After saving, you'll see a Price ID like: `price_1234567890abcdef`
- Copy this ID — you'll need it for `.env`

---

## 2. Configure Webhook

### Step 1: Create Webhook Endpoint
1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Set **Endpoint URL:** `https://fynd.vome.io/api/stripe/webhook`
4. Click **Select events**
5. Add these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click **Add endpoint**

### Step 2: Copy Webhook Secret
- After creating the endpoint, click on it
- Find **Signing secret** (starts with `whsec_`)
- Click **Reveal** and copy the secret

---

## 3. Get Stripe API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
   - Use **test key** for development
   - Use **live key** for production
3. Keep these keys secure — never commit them to git

---

## 4. Configure Environment Variables

Edit `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_51abc...xyz (replace with your actual key)
STRIPE_WEBHOOK_SECRET=whsec_abc123...xyz (replace with your actual secret)
STRIPE_PRICE_FYNDBOT_PRO=price_1abc...xyz (replace with your actual price ID)

# Public base URL (for success/cancel redirects)
PUBLIC_BASE_URL=https://fynd.vome.io
```

**Important:** Replace the example values with your actual keys from steps above.

---

## 5. Configure Nginx Proxy

The bot runs a webhook server on `127.0.0.1:3847`. Proxy it through nginx:

### Nginx Configuration Snippet

Add to your nginx site config (e.g., `/etc/nginx/sites-available/fynd.vome.io`):

```nginx
server {
    listen 443 ssl http2;
    server_name fynd.vome.io;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/fynd.vome.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fynd.vome.io/privkey.pem;

    # Stripe webhook endpoint
    location /api/stripe/ {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: preserve original body for webhook signature verification
        proxy_pass_request_body on;
        proxy_pass_request_headers on;
    }

    # Success/cancel pages (also served by bot)
    location /success {
        proxy_pass http://127.0.0.1:3847;
        proxy_set_header Host $host;
    }

    location /cancel {
        proxy_pass http://127.0.0.1:3847;
        proxy_set_header Host $host;
    }

    # Serve static landing page (optional)
    location / {
        root /var/www/fynd.vome.io;
        try_files $uri $uri/ /index.html;
    }
}
```

### Apply Configuration

```bash
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload nginx
```

---

## 6. Test Webhook

### Step 1: Send Test Event from Stripe

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select `checkout.session.completed`
5. Click **Send test webhook**

### Step 2: Check Logs

```bash
# Check bot logs
journalctl -u fyndbot -f

# Should see:
# Stripe webhook server listening on 127.0.0.1:3847
# User 123456789 upgraded to Pro via checkout cs_test_xxxxx
```

---

## 7. Test End-to-End Flow

### Step 1: Use Test Mode

Keep `STRIPE_SECRET_KEY` as test key (`sk_test_`) for testing.

### Step 2: Test Checkout

1. Open Telegram and message your bot
2. Send `/pro`
3. Click the **Subscribe to Pro** button
4. You'll be redirected to Stripe Checkout
5. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Postal code: Any valid code
6. Complete payment

### Step 3: Verify

- Check Telegram: You should see Pro features enabled
- Send `/pro` again: Should show "You're a Pro subscriber!"
- Send `/inspect` unlimited times: No weekly limit

---

## 8. Go Live

### Switch to Live Mode

1. Get **live** API keys from Stripe Dashboard (toggle to "Live" mode)
2. Update `.env` with live keys:
   ```env
   STRIPE_SECRET_KEY=sk_live_51abc...xyz (your live key)
   STRIPE_WEBHOOK_SECRET=whsec_abc123...xyz (your live secret)
   ```
3. Update webhook endpoint in Stripe to use live mode
4. Restart bot: `sudo systemctl restart fyndbot`

### Test Live Payment

**Important:** Real money will be charged. Use your own card to test first.

---

## Troubleshooting

### Webhook Not Receiving Events

**Check nginx proxy:**
```bash
curl -I https://fynd.vome.io/api/stripe/webhook
# Should return: 405 Method Not Allowed (GET not allowed, POST expected)
```

**Check bot is listening:**
```bash
curl http://127.0.0.1:3847/health
# Should return: {"status":"ok"}
```

**Check nginx logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

### Webhook Signature Verification Failed

- Ensure `STRIPE_WEBHOOK_SECRET` matches the **Signing secret** in Stripe Dashboard
- Check that nginx is **not** modifying the request body
- Verify `proxy_pass_request_body on` is set in nginx config

### Checkout Session Not Creating

**Check Stripe configuration:**
```bash
# In bot logs, should see:
# Starting Stripe webhook server...

# If not:
# Stripe not configured, skipping webhook server
```

**Verify environment variables:**
```bash
echo $STRIPE_SECRET_KEY        # Should start with sk_test_ or sk_live_
echo $STRIPE_PRICE_FYNDBOT_PRO # Should start with price_
```

### User Not Marked as Pro

**Check webhook events in Stripe Dashboard:**
1. Go to **Developers** → **Webhooks**
2. Click on your endpoint
3. Check **Recent deliveries**
4. Look for `checkout.session.completed` event
5. Check response: Should be `200 OK`

**Check bot logs:**
```bash
# Should see:
# User 123456789 upgraded to Pro via checkout cs_xxxxx
```

---

## Security Best Practices

### 1. Never Commit Secrets
- Add `.env` to `.gitignore` (already done)
- Use environment variables for all keys

### 2. Use HTTPS
- Stripe requires HTTPS for webhooks
- Use Let's Encrypt for free SSL certificates

### 3. Restrict API Keys
- Use Stripe's **restricted keys** if possible
- Only grant permissions needed (subscriptions, customers)

### 4. Monitor Webhooks
- Set up alerts for failed webhook deliveries
- Check Stripe Dashboard regularly

### 5. Test in Test Mode
- Always test with `sk_test_` keys first
- Use test cards (4242 4242 4242 4242)
- Switch to live mode only when confident

---

## Subscription Management

### Check Subscription Status

Users can check their status with `/pro` command.

### Cancel Subscription

Users must cancel through Stripe's customer portal. To enable:

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable portal
3. Add portal link to your bot (future enhancement)

Or cancel manually in Stripe Dashboard:
1. Go to **Customers**
2. Find customer by email or ID
3. Click on subscription
4. Click **Cancel subscription**

### Webhook Events

Bot handles these automatically:
- `checkout.session.completed` — User subscribed (mark as Pro)
- `customer.subscription.updated` — Subscription status changed
- `customer.subscription.deleted` — User cancelled (remove Pro status)

---

## Support

### Stripe Documentation
- [Checkout Sessions](https://stripe.com/docs/payments/checkout)
- [Webhooks](https://stripe.com/docs/webhooks)
- [Testing](https://stripe.com/docs/testing)

### Fyndbot Issues
- Check bot logs: `journalctl -u fyndbot -f`
- Check database: `sqlite3 data/fyndbot.db "SELECT * FROM users WHERE is_pro = 1;"`

---

**Last Updated:** 2026-09-17
