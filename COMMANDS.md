# Fyndbot Command Reference

Complete guide to all bot commands and features.

---

## Basic Commands

### `/start`
**Description:** Register with the bot and see welcome message.

**Usage:**
```
/start
```

**Response:** Welcome message with command overview.

---

### `/help`
**Description:** Show command reference and Pro tier information.

**Usage:**
```
/help
```

**Response:** Command list with descriptions and Pro tier benefits.

---

## Watch Commands

### `/watch <url>`
**Description:** Watch a Blocket search or category URL for new listings.

**Usage:**
```
/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar?cg=1020
/watch https://www.blocket.se/annonser/stockholm/bostad/lagenheter
```

**Limits:**
- Max 10 watches per user
- Validates URL is from blocket.se

**Response:** Confirmation with watch ID (e.g., W1, W2)

**Alerts:**
- 🔔 New listing appears
- Includes: title, price, location, link, image
- Pro users: AI bargain score (1-10) + reasoning

---

### `/unwatch <id>`
**Description:** Stop watching a search.

**Usage:**
```
/unwatch W1
/unwatch 1     (W prefix optional)
```

**Response:** Confirmation or error if ID not found.

---

## Follow Commands

### `/follow <url>`
**Description:** Follow a Blocket seller to track their listings.

**Usage:**
```
/follow https://www.blocket.se/annonsorer/seller-name
/follow https://www.blocket.se/annonser/hela_sverige?st=s&st_s=seller123
```

**Accepts:**
- Seller profile URLs (`/annonsorer/name`)
- Search URLs with seller filter (`st=s&st_s=id`)

**Limits:**
- Max 10 follows per user
- Prevents duplicate follows

**Response:** Confirmation with follow ID (e.g., F1, F2)

**Alerts:**
- 👤 New ad from seller (includes image + details)
- 📤 Ad disappeared (potentially sold/removed/expired)
- Pro users: AI bargain score on new ads

---

### `/unfollow <id>`
**Description:** Stop following a seller.

**Usage:**
```
/unfollow F1
/unfollow 1    (F prefix optional)
```

**Response:** Confirmation or error if ID not found.

---

## List Commands

### `/list`
**Description:** Show all active watches and follows.

**Usage:**
```
/list
```

**Response:**
```
Watches:
W1. https://www.blocket.se/annonser/fordon/bilar
W2. https://www.blocket.se/annonser/stockholm/...

Follows:
F1. my shop
F2. seller name

Use /unwatch W<id> or /unfollow F<id> to stop.
```

---

## Inspection Commands

### `/inspect <url>`
**Description:** Deep analysis of a single Blocket ad.

**Usage:**
```
/inspect https://www.blocket.se/annons/stockholm/volvo-v70/12345678
```

**Limits:**
- Free tier: 3 inspections per week
- Pro tier: Unlimited

**Response:**
- Title, price, location
- Bargain score (1-10) + reasoning
- Vehicle info (if registration number found):
  - Make, model, year
  - Months until besiktning
  - Months until tax
- Inspections remaining count

**Rate Limit Message:**
```
You've used all 3 free inspections this week.

Upgrade to Pro for unlimited inspections!

Use /pro for details.
```

---

## Pro Commands

### `/pro`
**Description:** View Pro subscription status and pricing.

**Usage:**
```
/pro
```

**Response (Free Users):**
```
Fyndbot Pro ✨

Benefits:
• AI bargain score (1-10) on every alert
• Unlimited /inspect commands
• Vehicle besiktning/tax data
• Priority support

Price: 79 SEK/month

Payment integration coming soon. Contact @vome_io for early access.
```

**Response (Pro Users):**
```
✨ You're a Pro subscriber!

• AI bargain scores on alerts
• Unlimited inspections
• Vehicle data enrichment

Thank you for your support!
```

---

## Alert Types

### Watch Alert (New Listing)
```
🔔 New Listing!

📋 Volvo V70 2012 i bra skick
💰 45 000 SEK
📍 Stockholm

[Pro only]
⭐ Bargain Score: 7/10
💡 Fresh listing, good condition

🔗 https://www.blocket.se/annons/...
```

### Follow Alert (New Ad)
```
👤 my shop posted new ad!

📋 iPhone 15 Pro ny oöppnad
💰 8 000 SEK
📍 Göteborg

[Pro only]
⭐ Bargain Score: 9/10
💡 Brand new listing, new/unused condition

🔗 https://www.blocket.se/annons/...
```

### Follow Alert (Disappeared Ad)
```
📤 my shop's ad no longer listed

📋 iPhone 15 Pro ny oöppnad
💰 8 000 SEK
📍 Göteborg

This ad has been removed, sold, or expired.
```

---

## Tips & Best Practices

### Watching Searches
- Use specific searches (category + location) for fewer false positives
- Example: Stockholm apartments instead of all housing

### Following Sellers
- Perfect for tracking trusted sellers, local shops, or specific dealers
- Get notified immediately when inventory changes

### Inspection Usage
- Save free inspections for high-value items
- Upgrade to Pro if inspecting frequently

### Managing Alerts
- Keep watches/follows under 10 for manageable notifications
- Unwatch/unfollow when no longer interested

---

## Limits & Fair Use

### Per User Limits
- **Watches:** 10 maximum
- **Follows:** 10 maximum
- **Inspections:** 3/week (free), unlimited (Pro)

### System Limits
- **Poll interval:** 2 minutes (checks all watches/follows)
- **Alert window:** Only listings < 24 hours old
- **Delays:** 2 seconds between checks (prevents rate limiting)

### Fair Use Policy
- Designed to be Blocket-friendly
- No aggressive scraping
- Respects Blocket's public data access

---

## Error Messages

### Invalid URL
```
Please provide a valid Blocket.se URL.
```
**Fix:** Ensure URL starts with `https://www.blocket.se`

### Max Watches/Follows
```
You have reached the maximum of 10 watches.
Use /unwatch to remove one first.
```
**Fix:** Remove unused watches with `/unwatch` or `/unfollow`

### Inspection Limit
```
You've used all 3 free inspections this week.

Upgrade to Pro for unlimited inspections!
```
**Fix:** Wait for weekly reset or upgrade to Pro

### Not Found
```
Watch W5 not found or doesn't belong to you.
```
**Fix:** Check IDs with `/list` command

### Seller Not Detected
```
Could not identify seller from URL.

Valid formats:
• https://www.blocket.se/annonsorer/seller-name
• Search URL with seller filter (st=s&st_s=...)
```
**Fix:** Use correct seller URL format

---

## Pricing

### Free Tier (0 SEK/mo)
- ✅ 10 watches
- ✅ 10 follows
- ✅ Instant alerts
- ✅ 3 inspections/week
- ✅ Image thumbnails

### Pro Tier (79 SEK/mo)
- ✅ Everything in Free
- ✅ AI bargain scores on all alerts
- ✅ Unlimited inspections
- ✅ Vehicle data enrichment
- ✅ Priority support

**Payment:** Coming soon. Contact @vome_io for early access.

---

## Support

### Common Questions

**Q: How often does the bot check for new listings?**  
A: Every 2 minutes for all active watches and follows.

**Q: Can I watch/follow the same thing twice?**  
A: No, duplicates are prevented. You'll see a message if already watching/following.

**Q: What happens to disappeared ads?**  
A: You get a notification. The ad may be sold, expired, or removed by the seller.

**Q: Do I need a Blocket account?**  
A: No, Fyndbot uses public data only. No login required.

**Q: How do I upgrade to Pro?**  
A: Payment integration is coming soon. Use `/pro` for status updates.

---

**Bot Version:** 1.0.0  
**Last Updated:** 2026-09-17
