# UX Improvements: Pro Activation DM + Guided /watch

**Date:** 2026-09-17  
**Branch:** `cursor/fyndbot-mvp-ace5`  
**Commit:** f91a058  
**Type:** UX Enhancement

---

## Overview

Two critical UX improvements addressing user confusion and friction:
1. **Pro activation DM** — Users complete Stripe checkout but don't know Pro is active
2. **Guided /watch shortcuts** — Users hate pasting Blocket URLs; need quick shortcuts + wizard

---

## 1. Telegram Ping When Pro Activates (Bug Fix)

### Problem

**User journey before fix:**
1. User sends `/pro`
2. Clicks Stripe Checkout link
3. Completes payment
4. Sees web page: "Welcome to Fyndbot Pro!"
5. Database: `is_pro = 1` ✅
6. **NO Telegram message** ❌
7. User doesn't know Pro is active until they manually check `/pro` again

**Result:** Confusion, poor conversion confirmation, no engagement hook.

### Solution: Direct Telegram DM After Pro Grant

**New Module: `src/notify.ts`**

Why separate module?
- Avoids circular imports (bot instance not available in stripe handlers)
- Direct Telegram API POST via `node-fetch`
- Simple, focused interface

```typescript
export async function sendTelegramMessage(
  telegramId: number, 
  message: string
): Promise<void>
```

**Implementation:**
- POSTs to `https://api.telegram.org/bot<token>/sendMessage`
- Params: `chat_id`, `text`, `parse_mode: 'Markdown'`
- Logs success/failure, never throws
- Fire-and-forget with `.catch()` — webhook still returns 200 quickly

### Integration Points

#### 1. Checkout Completed (`handleCheckoutCompleted`)

**After:** `db.setUserPro(telegramId, true, customerId, subscriptionId)`

**Sends DM:**
```
✨ *You're Pro!*

AI bargain scores are now active for all your alerts. 
Try /inspect or wait for the next /watch hit to see it in action!
```

**Test Mode Variant:**
```
✨ *You're Pro!*

AI bargain scores are now active for all your alerts. 
Try /inspect or wait for the next /watch hit to see it in action!

🧪 _Sandbox mode: This is a test subscription._
```

**Logic:**
```typescript
const isTestMode = session.metadata?.stripe_mode === 'test';
let message = `✨ *You're Pro!*\n\n...`;

if (isTestMode) {
  message += `\n\n🧪 _Sandbox mode: This is a test subscription._`;
}

sendTelegramMessage(telegramId, message).catch(err => {
  console.error(`Failed to notify user ${telegramId}:`, err);
});
```

**Safety:**
- Failure to send DM doesn't block Pro grant
- Logs error for monitoring
- Webhook handler remains synchronous (fire-and-forget notification)

#### 2. Subscription Updated (`handleSubscriptionUpdated`)

**New logic:**
```typescript
const wasProBefore = user.isPro;
const isActive = subscription.status === 'active' || 
                 subscription.status === 'trialing';

db.setUserPro(user.telegramId, isActive, customerId, subscription.id);

if (isActive && !wasProBefore) {
  // Only send DM if newly becoming Pro
  sendTelegramMessage(user.telegramId, message).catch(...);
}
```

**Why check `!wasProBefore`?**
- Avoid spam on every subscription update event
- Only send DM when status changes from non-Pro → Pro
- Covers edge case: subscription created but not immediately active

#### 3. Already Pro Message

**Before:**
```
✨ You're a Pro subscriber!

• AI bargain scores on alerts
• Unlimited inspections
• Vehicle data enrichment

Thank you for your support!
```

**After (with markdown):**
```
✨ *You're already Pro!*

• AI bargain scores on alerts
• Unlimited inspections
• Vehicle data enrichment

Thank you for your support!
```

**Why:** Consistent formatting, clearer "already" indicator.

### Testing Scenarios

#### Scenario 1: First Checkout (Live)
```
1. User: /pro
2. Click checkout
3. Complete payment
4. Stripe webhook: checkout.session.completed
5. DB: is_pro = 1
6. Telegram DM sent: "✨ You're Pro!"
7. User sees DM immediately
```

#### Scenario 2: First Checkout (Test/Sandbox)
```
Same as above, but DM includes:
"🧪 Sandbox mode: This is a test subscription."
```

#### Scenario 3: Subscription Becomes Active (Edge Case)
```
1. Subscription created but pending
2. DB: is_pro = 0
3. Stripe webhook: customer.subscription.updated (status: active)
4. wasProBefore = false, isActive = true
5. DB: is_pro = 1
6. Telegram DM sent: "✨ You're Pro!"
```

#### Scenario 4: Subscription Renewed (No Spam)
```
1. Existing Pro user
2. Stripe webhook: customer.subscription.updated (renewal)
3. wasProBefore = true, isActive = true
4. DB: is_pro = 1 (no change)
5. NO DM sent ✅ (prevents spam)
```

#### Scenario 5: Telegram API Failure
```
1. Checkout completes
2. DB: is_pro = 1 ✅
3. sendTelegramMessage fails (network, user blocked bot)
4. Catch block logs error
5. Webhook returns 200 ✅
6. Pro grant NOT rolled back ✅
7. User can still verify with /pro
```

---

## 2. Guided /watch: Shortcuts + Interactive Wizard

### Problem

**Current UX:**
```
User: /watch
Bot: Usage: /watch <blocket_url>

     Example:
     /watch https://www.blocket.se/annonser/stockholm/bostad
```

**User friction:**
1. Must open Blocket in browser
2. Navigate to search
3. Copy URL from address bar
4. Paste in Telegram
5. Many users drop off

**Result:** Low watch creation rate, high friction.

### Solution A: Shortcuts

**Natural language shortcuts → Blocket URLs:**

```
/watch fordon skåne
→ https://www.blocket.se/annonser/skane/fordon

/watch bilar stockholm
→ https://www.blocket.se/annonser/stockholm/fordon/bilar

/watch elektronik
→ https://www.blocket.se/annonser/hela_sverige/elektronik
```

**Implementation: `src/bot/watchShortcuts.ts`**

#### Category Map
```typescript
const CATEGORY_MAP: Record<string, { 
  slug: string; 
  label: string; 
  subcategory?: string 
}> = {
  fordon: { slug: 'fordon', label: 'Fordon' },
  bilar: { slug: 'fordon', label: 'Fordon', subcategory: 'bilar' },
  cars: { slug: 'fordon', label: 'Fordon', subcategory: 'bilar' },
  elektronik: { slug: 'elektronik', label: 'Elektronik' },
  datorer_tillbehor: { slug: 'datorer_tillbehor', label: 'Datorer & Tillbehör' },
  // ... (10 categories total)
};
```

**Categories Supported:**
- `fordon` — Vehicles
- `bilar`, `cars` — Cars (subcategory of fordon)
- `elektronik` — Electronics
- `datorer_tillbehor`, `datorer` — Computers & Accessories
- `mobiler_tillbehor`, `mobiler` — Phones & Accessories
- `bostad` — Housing
- `fritid_hobby`, `fritid` — Leisure & Hobby
- `personligt` — Personal
- `home_garden`, `hem`, `mobler` — Home & Garden
- `barn_barnartiklar`, `barn` — Children & Baby
- `tools`, `verktyg` — Tools

#### Region Map
```typescript
const REGION_MAP: Record<string, { 
  slug: string; 
  label: string 
}> = {
  hela_sverige: { slug: 'hela_sverige', label: 'Hela Sverige' },
  skane: { slug: 'skane', label: 'Skåne' },
  skåne: { slug: 'skane', label: 'Skåne' }, // Swedish char alias
  stockholm: { slug: 'stockholm', label: 'Stockholm' },
  goteborg: { slug: 'vastra_gotalands_lan', label: 'Göteborg' },
  göteborg: { slug: 'vastra_gotalands_lan', label: 'Göteborg' },
  // ... (21 regions total)
};
```

**Regions Supported:**
- `hela_sverige` — Nationwide
- `skane`, `skåne` — Skåne
- `stockholm` — Stockholm
- `goteborg`, `göteborg` — Göteborg (maps to `vastra_gotalands_lan`)
- `malmo`, `malmö` — Malmö (maps to `skane`)
- `uppsala` — Uppsala
- `halland`, `blekinge`, `kronoberg`, `kalmar`, `jonkoping`, `ostergotland`, `sodermanland`, `vastmanland`, `orebro`, `varmland`, `dalarna`, `gavleborg`, `vasternorrland`, `jamtland`, `vasterbotten`, `norrbotten`

**All slugs verified against Blocket.se URL structure.**

#### Parser Logic

**Function:** `parseWatchShortcut(text: string): ResolvedWatch | null`

**Steps:**
1. Check if input contains `blocket.se` → return `null` (bypass)
2. Split input into words
3. For each word:
   - Check CATEGORY_MAP (exact + normalized)
   - Check REGION_MAP (exact + normalized)
4. Extract category, subcategory, region
5. Apply rules

**Rules:**
- **Category + Region:** Build URL
- **Category only:** Default region `hela_sverige`
- **Region only:** Return `null` (ambiguous — wizard will ask)
- **Neither:** Return `null` (invalid)

**Swedish Character Normalization:**
```typescript
function normalizeSwedish(text: string): string {
  return text.toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o');
}
```

**Examples:**

| Input | Category | Region | URL |
|-------|----------|--------|-----|
| `fordon skåne` | fordon | skane | `.../skane/fordon` |
| `bilar stockholm` | fordon | stockholm | `.../stockholm/fordon/bilar` |
| `stockholm elektronik` | elektronik | stockholm | `.../stockholm/elektronik` |
| `elektronik` | elektronik | hela_sverige | `.../hela_sverige/elektronik` |
| `stockholm` | — | — | `null` (ambiguous) |
| `random text` | — | — | `null` (invalid) |

#### Bot Handler Integration

**Updated `/watch` handler:**

```typescript
bot.onText(/\/watch(?:\s+(.+))?/, async (msg, match) => {
  const input = match?.[1]?.trim();

  if (!input) {
    // Start wizard (see Solution B)
    return;
  }

  // Check watch limit...

  let watchUrl = input;
  let resolvedInfo = '';

  if (!input.includes('blocket.se')) {
    const resolved = parseWatchShortcut(input);
    if (resolved) {
      watchUrl = resolved.url;
      resolvedInfo = ` (resolved from shortcut)`;
    } else {
      // Error message with suggestions
      return;
    }
  }

  const watch = db.createWatch(user.id, watchUrl, null);

  await bot.sendMessage(chatId, 
    `✅ Now watching${resolvedInfo}:\n${watchUrl}\n\n` +
    `Watch ID: W${watch.id}\n\n` +
    `You'll get alerts when new listings appear!`
  );
});
```

**Error Message:**
```
❌ Could not parse shortcut. Try:
• /watch fordon skåne
• /watch bilar stockholm
• /watch for interactive wizard
• Full Blocket URL
```

### Solution B: Interactive Wizard

**Trigger:** Bare `/watch` (no arguments)

**Flow:**

#### Step 1: Category Selection
```
User: /watch

Bot: 🔍 *Choose a category:*
     [🚗 Fordon] [🚙 Bilar]
     [💻 Elektronik] [🖥️ Datorer]
     [📱 Mobiler] [🏠 Bostad]
     [⚽ Fritid] [🪑 Hem & Trädgård]
     [👶 Barn] [🔧 Verktyg]
```

**Button Layout:** 2 per row (5 rows)

**Callback Data Format:** `wcat:<category_slug>`

Examples:
- `wcat:fordon`
- `wcat:fordon/bilar`
- `wcat:elektronik`

#### Step 2: Region Selection
```
User: [Clicks 🚗 Fordon]

Bot: 📍 *Choose a region:*
     [🇸🇪 Hela Sverige] [Stockholm] [Skåne]
     [Göteborg] [Uppsala] [Halland]
     [Blekinge] [Kronoberg] [Kalmar]
     ... (21 regions total)
```

**Button Layout:** 3 per row (7 rows)

**Callback Data Format:** `wreg:<region_slug>`

Examples:
- `wreg:hela_sverige`
- `wreg:stockholm`
- `wreg:skane`

#### Step 3: Watch Created
```
User: [Clicks Skåne]

Bot: ✅ *Now watching:*
     https://www.blocket.se/annonser/skane/fordon

     Watch ID: W42

     You'll get alerts when new listings appear!
```

**Note:** Original message is edited (not new message).

### Wizard State Management

**Data Structure:**
```typescript
interface WizardState {
  category?: string;
  timestamp: number;
}

const wizardState = new Map<number, WizardState>();
const WIZARD_TTL_MS = 10 * 60 * 1000; // 10 minutes
```

**Why in-memory Map?**
- Ephemeral state (not worth SQLite table for MVP)
- TTL cleanup prevents memory leak
- Fast access

**Lifecycle:**

1. **Start:** `/watch` → `wizardState.set(telegramId, { timestamp: now })`
2. **Category picked:** `wcat:fordon` → `wizardState.set(telegramId, { category: 'fordon', timestamp: now })`
3. **Region picked:** `wreg:skane` → Read state, build URL, create watch, `wizardState.delete(telegramId)`

**Cleanup:**
```typescript
function cleanupExpiredWizards(): void {
  const now = Date.now();
  for (const [telegramId, state] of wizardState.entries()) {
    if (now - state.timestamp > WIZARD_TTL_MS) {
      wizardState.delete(telegramId);
    }
  }
}
```

Called on every new wizard start.

**Session Expired:**
```
User: [Clicks region after >10 min]

Bot: ❌ Session expired. Please start again with /watch
```

**Watch Limit Check:**
```
User: [Completes wizard with 10 watches already]

Bot: ❌ You have reached the maximum of 10 watches. 
     Use /unwatch to remove one first.
```

Checked before creating watch in region callback.

### Callback Query Handler

**New bot event:**
```typescript
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  if (data.startsWith('wcat:')) {
    // Step 1→2: Show region buttons
  } else if (data.startsWith('wreg:')) {
    // Step 2→3: Create watch, edit message
  }
});
```

**Implementation:**

#### Category Callback (`wcat:`)
```typescript
const category = data.substring(5); // Remove 'wcat:'
wizardState.set(telegramId, { category, timestamp: Date.now() });

const regionButtons = getRegionButtons();
const keyboard = []; // 3 per row layout

await bot.editMessageText('📍 *Choose a region:*', {
  chat_id: chatId,
  message_id: query.message?.message_id,
  parse_mode: 'Markdown',
  reply_markup: { inline_keyboard: keyboard }
});
```

#### Region Callback (`wreg:`)
```typescript
const region = data.substring(5); // Remove 'wreg:'
const state = wizardState.get(telegramId);

if (!state || !state.category) {
  // Session expired
  return;
}

// Check watch limit...

const watchUrl = buildWatchUrl(state.category, region);
const watch = db.createWatch(user.id, watchUrl, null);

await bot.editMessageText(
  `✅ *Now watching:*\n${watchUrl}\n\n` +
  `Watch ID: W${watch.id}\n\n` +
  `You'll get alerts when new listings appear!`,
  {
    chat_id: chatId,
    message_id: query.message?.message_id,
    parse_mode: 'Markdown'
  }
);

wizardState.delete(telegramId);
```

### Helper Functions

**Button Generators:**
```typescript
export function getCategoryButtons(): Array<{ 
  text: string; 
  callbackData: string 
}> {
  return [
    { text: '🚗 Fordon', callbackData: 'wcat:fordon' },
    { text: '🚙 Bilar', callbackData: 'wcat:fordon/bilar' },
    // ... (10 total)
  ];
}

export function getRegionButtons(): Array<{ 
  text: string; 
  callbackData: string 
}> {
  return [
    { text: '🇸🇪 Hela Sverige', callbackData: 'wreg:hela_sverige' },
    { text: 'Stockholm', callbackData: 'wreg:stockholm' },
    // ... (21 total)
  ];
}
```

**URL Builder:**
```typescript
export function buildWatchUrl(category: string, region: string): string {
  const parts = category.split('/');
  let url = `https://www.blocket.se/annonser/${region}/${parts[0]}`;
  if (parts[1]) {
    url += `/${parts[1]}`; // Add subcategory
  }
  return url;
}
```

---

## Updated Help Text

### `/start` Command
```
Välkommen till Fyndbot! 🇸🇪

I help you find bargains on Blocket.se with instant alerts.

*Commands:*
/watch — Interactive wizard or /watch <url> or shortcuts like "/watch fordon skåne"
/follow <url> — Follow a Blocket seller
/list — Show your watches and follows
/unwatch <id> — Stop watching
/unfollow <id> — Stop following
/inspect <url> — Analyse a listing (Pro feature)
/pro — View subscription status
/help — Show this help

*Examples:*
`/watch fordon stockholm`
`/watch` (interactive buttons)
`/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar`
`/follow https://www.blocket.se/annonsorer/seller-name`

Start watching now!
```

### `/help` Command
```
*Fyndbot Commands*

/watch — Interactive wizard with buttons
/watch <shortcut> — Quick watch (e.g., "fordon skåne", "bilar stockholm")
/watch <url> — Watch a full Blocket URL
/follow <url> — Follow a Blocket seller
/list — List all your active watches and follows
/unwatch <id> — Stop watching (use ID from /list)
/unfollow <id> — Stop following (use ID from /list)
/inspect <url> — Deep analysis of a listing
/pro — View Pro subscription details
/help — Show this message

*Examples:*
`/watch fordon göteborg` — Cars in Göteborg
`/watch elektronik` — Electronics nationwide
`/watch` — Interactive category/region picker

*Pro Features:*
• AI bargain scoring on every alert
• Unlimited inspections
• Vehicle besiktning/tax data
• 79 SEK/month

Free tier: 3 inspections per week
```

---

## Testing

### Unit Tests: `src/bot/watchShortcuts.test.ts`

**17 new tests (44 total passing):**

#### `parseWatchShortcut` Tests
1. ✅ Category + region
2. ✅ Region + category (order flexible)
3. ✅ Subcategory (bilar)
4. ✅ Normalize Swedish characters
5. ✅ Default to `hela_sverige` when only category
6. ✅ Return `null` when only region (ambiguous)
7. ✅ Return `null` for full Blocket URLs
8. ✅ Return `null` for unrecognized input
9. ✅ Handle multiple spaces
10. ✅ Case insensitive
11. ✅ Handle region aliases (göteborg)
12. ✅ Handle category aliases (cars → bilar)
13. ✅ barn_barnartiklar
14. ✅ home_garden

#### `buildWatchUrl` Tests
15. ✅ Simple category/region URL
16. ✅ URL with subcategory
17. ✅ hela_sverige

**All tests pass:** `npm test` — 44/44 ✅

### Manual Testing Checklist

#### Pro Activation DM
- [x] Sandbox checkout → DM with test mode note
- [x] Live checkout → DM without test mode note
- [x] Subscription updated (newly active) → DM sent
- [x] Subscription renewed (already Pro) → NO DM
- [x] Telegram API failure → Pro grant NOT rolled back
- [x] `/pro` when already Pro → "You're already Pro!"

#### Watch Shortcuts
- [x] `/watch fordon skåne` → Correct URL
- [x] `/watch bilar stockholm` → Subcategory URL
- [x] `/watch elektronik` → hela_sverige default
- [x] `/watch stockholm` → Error (ambiguous)
- [x] `/watch random` → Error with suggestions
- [x] Swedish char normalization works
- [x] Order flexible (stockholm elektronik)
- [x] Case insensitive (FORDON SKÅNE)
- [x] Full URL still works (bypass)

#### Interactive Wizard
- [x] Bare `/watch` → Category buttons
- [x] Pick category → Region buttons
- [x] Pick region → Watch created, message edited
- [x] Session expired (>10 min) → Error
- [x] Watch limit (10) → Error before creating
- [x] Wizard state cleaned up on completion

---

## Performance & Memory

### Wizard State
- **Memory:** ~100 bytes per user
- **Worst case:** 1000 concurrent wizards = ~100 KB
- **Cleanup:** Every new wizard + 10-min TTL
- **Not a concern** for MVP scale

### Telegram API DM
- **Fire-and-forget:** No webhook blocking
- **Failure handling:** Logged, doesn't break Pro grant
- **Rate limits:** Rare (only on Pro activation)

---

## Monitoring

### Pro Activation DM
```bash
# Success
Sent Telegram message to 6416786982

# Failure (user blocked bot)
Failed to send Telegram message to 6416786982: 403 - Forbidden: bot was blocked by the user

# Failure (network)
Error sending Telegram message to 6416786982: FetchError: ...
```

**Action:** Monitor logs for failures. If consistent, investigate bot block rate.

### Watch Shortcuts
```bash
# Shortcut usage
✅ Now watching (resolved from shortcut):
https://www.blocket.se/annonser/skane/fordon

Watch ID: W42

# Wizard usage
✅ Now watching:
https://www.blocket.se/annonser/stockholm/elektronik

Watch ID: W43
```

**Metric:** Track "resolved from shortcut" vs wizard vs full URL.

---

## Rollback Plan

### Pro DM Issues
**Symptom:** Too many DM failures (bot blocks, spam reports)

**Rollback:**
```typescript
// Comment out notification in handleCheckoutCompleted:
// sendTelegramMessage(telegramId, message).catch(...);
```

**Impact:** Users still get Pro, just no DM. Can check `/pro`.

### Shortcut/Wizard Issues
**Symptom:** Incorrect URLs, category/region mismatches

**Quick fix:** Edit `CATEGORY_MAP` or `REGION_MAP` slugs

**Full rollback:**
```typescript
// Revert /watch handler to URL-only
if (!input) {
  await bot.sendMessage(chatId, 'Usage: /watch <blocket_url>');
  return;
}

if (!input.includes('blocket.se')) {
  await bot.sendMessage(chatId, 'Please provide a valid Blocket.se URL.');
  return;
}
```

---

## Future Enhancements

### Pro Activation
- [ ] Subscription renewal reminder DM (1 week before)
- [ ] Subscription cancelled DM ("Your Pro status will end on...")
- [ ] First Pro alert shows extra "🎉 Your first Pro alert!"

### Watch Shortcuts
- [ ] `/watch popular` → Curated popular searches
- [ ] `/watch near me` → Location-based (requires user location)
- [ ] Fuzzy matching ("fordn" → "fordon?")
- [ ] Auto-suggest on typos

### Wizard
- [ ] Add "Back" button in region step
- [ ] Remember last category for quick re-watch
- [ ] "Cancel" button to exit wizard

---

**Status:** ✅ Production Ready  
**Tests:** 44/44 passing  
**Risk:** Low — Additive features, backward compatible
