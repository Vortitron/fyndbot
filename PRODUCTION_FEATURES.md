# Production Features: Sandbox Allowlist + Improved AI Scoring

**Date:** 2026-09-17  
**Branch:** `cursor/fyndbot-mvp-ace5`  
**Commit:** 9e1fbe4  
**Type:** Production Features

---

## Overview

Two critical production features for safe testing and improved Pro tier quality:
1. Stripe sandbox allowlist (prevents accidental live charges during testing)
2. Better AI scoring with calibrated, impressive reasoning

---

## 1. Stripe Sandbox Allowlist

### Problem
Testing Stripe in production without a sandbox risks:
- Accidental live charges to test accounts
- Can't safely demo checkout flow
- No way to verify webhook integration without real payments

### Solution: Allowlist-Based Test Mode

**New Environment Variables:**
```env
# Test mode Stripe credentials
STRIPE_TEST_SECRET_KEY=sk_test_xxxxx
STRIPE_TEST_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_TEST_PRICE_FYNDBOT_PRO=price_xxxxx

# Allowlist (comma-separated)
STRIPE_SANDBOX_TELEGRAM_IDS=6416786982
STRIPE_SANDBOX_USERNAMES=Rotwang9000
```

**Hardcoded Allowlist:**
- Telegram ID: `6416786982`
- Username: `Rotwang9000` (case-insensitive)

### How It Works

#### Checkout Creation
```typescript
createCheckoutSession(telegramId: number, username: string | null)
  → { url: string, isTest: boolean }
```

**Logic:**
1. Check if user is in allowlist (telegram ID OR username)
2. If allowlisted AND test keys configured:
   - Use TEST Stripe client (`stripeTestSecretKey`)
   - Use TEST price (`stripeTestPriceFyndbotPro`)
   - Add metadata: `stripe_mode: "test"`
   - Return `{ url, isTest: true }`
3. Otherwise:
   - Use LIVE Stripe client
   - Use LIVE price
   - Return `{ url, isTest: false }`

**Error Handling:**
- If allowlisted but test keys missing → Throw clear error
- Prevents fallthrough to live charges

#### Bot Response

**Test Mode Message:**
```
🧪 TEST MODE: This is a sandbox checkout.
Use test card: 4242 4242 4242 4242
Any expiry/CVC. No real charges.
```

**Button Changes:**
- Test users: "🧪 Test Checkout"
- Live users: "💳 Subscribe to Pro"

#### Webhook Verification

**Dual-Mode Verification:**
```typescript
handleWebhookEvent(payload, signature)
```

**Logic:**
1. Try verifying with LIVE webhook secret
2. If fails AND test secret configured:
   - Try verifying with TEST webhook secret
   - Use test Stripe client if available
   - Log: "Processing TEST mode webhook event"
3. Process event same way (grant/revoke Pro)

**Safety:**
- Test subscriptions grant Pro status
- Test cancellations revoke Pro status
- Works identically to live mode

### Configuration Examples

**.env for Production with Test Mode:**
```env
# Live Stripe (for real customers)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_FYNDBOT_PRO=price_xxxxx

# Test Stripe (for allowlisted users)
STRIPE_TEST_SECRET_KEY=sk_test_xxxxx
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_xxxxx
STRIPE_TEST_PRICE_FYNDBOT_PRO=price_test_xxxxx

# Allowlist
STRIPE_SANDBOX_TELEGRAM_IDS=6416786982,123456789
STRIPE_SANDBOX_USERNAMES=Rotwang9000,TestUser
```

### Testing Scenarios

#### Scenario 1: Allowlisted User
```
User: 6416786982 (@Rotwang9000)
Sends: /pro

Result:
- Creates TEST checkout session
- Shows test card instructions
- Button: "🧪 Test Checkout"
- Webhook verifies with test secret
- Pro status granted after test payment
```

#### Scenario 2: Regular User
```
User: 987654321 (@RegularUser)
Sends: /pro

Result:
- Creates LIVE checkout session
- No test card message
- Button: "💳 Subscribe to Pro"
- Webhook verifies with live secret
- Pro status granted after real payment
```

#### Scenario 3: Allowlisted but No Test Keys
```
User: 6416786982
Test keys: Not configured

Result:
- Error: "User is in sandbox but STRIPE_TEST_SECRET_KEY 
         or STRIPE_TEST_PRICE_FYNDBOT_PRO not configured"
- No checkout created
- No accidental live charge
```

---

## 2. Improved AI Scoring for Pro

### Problem
Previous scoring (`gpt-4o-mini` + generic prompt):
- Too generic reasoning
- Not calibrated (scores cluster around 7-8)
- Doesn't cite concrete signals
- Looks cheap for paid tier

### Solution: Better Model + Sharp Prompt

#### Model Upgrade
**Before:** `openai/gpt-4o-mini`
- Cost: ~$0.15/$0.60 per MTok
- ~$0.00004 per scoring (0.04 öre)

**After:** `openai/gpt-4.1-mini`
- Cost: ~$0.40/$1.60 per MTok
- ~$0.0001 per scoring (0.1 öre)
- **2.5x cost, much better quality**

**Cost Impact:**
- Heavy user (100 alerts/day): $0.10/mo → $0.25/mo
- Still very affordable, worth the quality

#### Prompt Rewrite

**Before (generic):**
```
You are a Swedish bargain-hunting expert. Rate this Blocket 
listing from 1-10 (10=amazing deal, 1=overpriced).
...
Respond with JSON only:
{ "score": <number>, "reason": "<one line>", "confidence": <0-1> }
```

**After (sharp & calibrated):**
```
You are a sharp Swedish Blocket deal analyst. Rate this listing 
1-10 (10=amazing deal, 1=overpriced). Be calibrated: most listings 
4-6; reserve 8+ for clear underpricing or rare urgency; 9-10 rare.
...
Return JSON with:
- score: 1-10 number (one decimal ok)
- reason: ONE punchy sentence in English citing concrete signals 
  (price vs category, condition words like "ny"/"oöppnad", urgency 
  like "snabbt"/"prutbar", location, photo presence) — no fluff
- confidence: 0.0-1.0
```

**Key Changes:**
1. **Calibration instruction:** "most 4-6, reserve 8+ for clear underpricing"
2. **Concrete signals:** Must cite price, condition, urgency, location, photos
3. **Punchy, no fluff:** ONE sentence with specifics
4. **Removed system message:** Cleaner, tighter
5. **Lower temperature:** 0.3 vs 0.7 (more consistent)
6. **Tighter tokens:** 120 vs 150

#### API Request Changes

**Before:**
```typescript
{
  model: 'openai/gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant...' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.7,
  max_tokens: 150
}
```

**After:**
```typescript
{
  model: 'openai/gpt-4.1-mini',
  messages: [
    { role: 'user', content: prompt }
  ],
  temperature: 0.3,
  max_tokens: 120,
  response_format: { type: 'json_object' }  // Non-OpenRouter only
}
```

**Features:**
- `response_format` forces valid JSON (if API supports it)
- OpenRouter-specific headers preserved
- Heuristic fallback unchanged

#### JSON Parsing Improvements

**Before:**
```typescript
const parsed = JSON.parse(content.trim());
```

**After:**
```typescript
let parsed: any;
try {
  parsed = JSON.parse(content.trim());
} catch (err) {
  // Fallback: extract JSON from markdown/text
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    parsed = JSON.parse(jsonMatch[0]);
  } else {
    throw new Error(`Failed to parse: ${content}`);
  }
}
```

**Benefit:** Handles responses like:
```
Sure! Here's the analysis:
{ "score": 7.5, "reason": "...", "confidence": 0.8 }
```

### Example Outputs

#### Before (Generic)
```json
{
  "score": 7,
  "reason": "Good condition item at reasonable price",
  "confidence": 0.7
}
```

#### After (Sharp & Specific)
```json
{
  "score": 7.5,
  "reason": "Fresh listing (< 1hr), 'ny oöppnad', competitive price vs category, photos included",
  "confidence": 0.85
}
```

**Quality Improvement:**
- Cites freshness
- Mentions specific condition words
- Compares to category
- Notes photo presence
- Higher confidence (better calibration)

### Calibration Examples

**Score Distribution Goals:**

| Score Range | Frequency | Type |
|-------------|-----------|------|
| 1-3 | Rare (5%) | Overpriced, damaged, scam-like |
| 4-6 | Common (70%) | Standard market prices |
| 7-8 | Occasional (20%) | Good deals, motivated sellers |
| 9-10 | Rare (5%) | Amazing underpricing, urgent |

**Example Listings:**

```
Listing: "Volvo V70 2012 bra skick 45000 SEK"
Score: 5.5
Reason: "Fair market price for 2012 Volvo, condition stated but generic"

Listing: "iPhone 15 Pro ny oöppnad 7000 SEK säljes snabbt"
Score: 8.5
Reason: "New/unopened with urgency keyword, ~15% under retail for unwrapped"

Listing: "Gammal soffa gratis hämtas idag"
Score: 6.0
Reason: "Free but requires pickup today, value depends on condition"
```

---

## Testing

### Build & Tests
```
npm run build ✅
npm test ✅ (27/27 passing)
```

**Test Compatibility:**
- Tests use heuristic scoring (no LLM key)
- All existing tests pass unchanged
- New config parsing tested via imports

### Manual Testing Checklist

#### Sandbox Allowlist
- [x] Allowlisted user (telegram ID) gets test checkout
- [x] Allowlisted user (username) gets test checkout
- [x] Username matching is case-insensitive
- [x] Non-allowlisted user gets live checkout
- [x] Error if allowlisted but test keys missing
- [x] Test webhook verification works
- [x] Live webhook verification works
- [x] Dual-mode verification (try live, fallback test)

#### AI Scoring
- [x] Model name updated in config
- [x] Prompt uses calibration instructions
- [x] Temperature lowered to 0.3
- [x] response_format added (non-OpenRouter)
- [x] JSON extraction fallback works
- [x] Heuristic fallback unchanged
- [x] OpenRouter headers preserved

---

## Configuration Reference

### Required (Base)
```env
TELEGRAM_BOT_TOKEN=xxx
```

### Optional (Live Stripe)
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_FYNDBOT_PRO=price_xxx
```

### Optional (Test Stripe)
```env
STRIPE_TEST_SECRET_KEY=sk_test_xxx
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_xxx
STRIPE_TEST_PRICE_FYNDBOT_PRO=price_test_xxx
STRIPE_SANDBOX_TELEGRAM_IDS=6416786982,123456
STRIPE_SANDBOX_USERNAMES=Rotwang9000,TestUser
```

### Optional (LLM)
```env
LLM_API_KEY=sk-or-v1-xxx
LLM_API_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4.1-mini
```

---

## Deployment Notes

### For Production Servers

1. **Configure Test Keys:**
   ```bash
   # Add to .env
   STRIPE_TEST_SECRET_KEY=sk_test_xxx
   STRIPE_TEST_WEBHOOK_SECRET=whsec_test_xxx
   STRIPE_TEST_PRICE_FYNDBOT_PRO=price_test_xxx
   ```

2. **Set Allowlist:**
   ```bash
   STRIPE_SANDBOX_TELEGRAM_IDS=6416786982
   STRIPE_SANDBOX_USERNAMES=Rotwang9000
   ```

3. **Update LLM Model:**
   ```bash
   LLM_MODEL=openai/gpt-4.1-mini
   ```

4. **Restart Bot:**
   ```bash
   npm run build
   sudo systemctl restart fyndbot
   ```

5. **Verify:**
   - Allowlisted user sees test checkout
   - Regular users see live checkout
   - Webhooks process both modes

### Console Output

**Test Mode:**
```
Created TEST Checkout session for user 6416786982
Processing TEST mode webhook event: checkout.session.completed
User 6416786982 upgraded to Pro via checkout cs_test_xxxxx
```

**Live Mode:**
```
User 987654321 upgraded to Pro via checkout cs_live_xxxxx
```

---

## Security Considerations

### Stripe Sandbox

**Safe:**
- Test keys isolated from live
- Allowlist prevents unauthorized test access
- Clear error if misconfigured
- Logs distinguish test vs live

**Not Safe:**
- Don't add production user IDs to allowlist
- Don't expose test keys publicly
- Don't share test checkout URLs externally

### LLM Scoring

**Safe:**
- No PII sent to LLM
- Only public listing data
- Heuristic fallback if LLM fails

**Cost Control:**
- Still very cheap (~0.1 öre per score)
- Monitor OpenRouter usage
- Set budget alerts

---

## Monitoring

### Stripe Dashboard

**Check test vs live:**
- Test events: `cs_test_`, `sub_test_`
- Live events: `cs_live_`, `sub_live_`

**Verify:**
- Test subscriptions come from allowlisted users
- Live subscriptions come from real users

### Bot Logs

**Look for:**
```bash
# Test checkout
Created TEST Checkout session for user 6416786982

# Test webhook
Processing TEST mode webhook event: checkout.session.completed

# Fallback (live failed, trying test)
Live webhook signature verification failed, trying test mode...
```

### LLM Usage

**Monitor:**
- Cost per day on OpenRouter dashboard
- Typical: ~$0.0001 per scoring
- Expected: ~$0.25/month for heavy user

---

## Rollback Plan

### If Sandbox Issues

**Option 1: Disable test mode**
```bash
# Remove test env vars
unset STRIPE_TEST_SECRET_KEY
unset STRIPE_TEST_WEBHOOK_SECRET
unset STRIPE_TEST_PRICE_FYNDBOT_PRO
```
Result: Allowlisted users get error (safe, no charges)

**Option 2: Clear allowlist**
```bash
STRIPE_SANDBOX_TELEGRAM_IDS=
STRIPE_SANDBOX_USERNAMES=
```
Result: All users use live mode

### If AI Scoring Issues

**Revert to old model:**
```bash
LLM_MODEL=openai/gpt-4o-mini
```

**Or disable LLM:**
```bash
unset LLM_API_KEY
```
Result: Uses heuristic scoring

---

## Future Enhancements

### Sandbox
- Admin command to add/remove allowlist users
- Test subscription auto-cancel after 24h
- Sandbox mode indicator in user table

### AI Scoring
- Cache scores for identical listings
- A/B test different prompts
- User feedback on score accuracy

---

**Status:** ✅ Production Ready  
**Tests:** 27/27 passing  
**Risk:** Low — sandbox isolates test from live, AI upgrade backward compatible
