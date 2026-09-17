# Home Assistant Integration Setup

**Fyndbot** can send listing alerts directly to your Home Assistant installation, allowing you to create powerful automations based on Blocket listings.

---

## Features

- 🔔 **Real-time alerts** — Get notified in Home Assistant when new listings match your watches
- 🤖 **Automation-ready** — Use listing data (price, score, location) in HA automations
- ⭐ **AI scores included** — Pro users get bargain scores in the payload
- 🆓 **Free for all users** — HA integration is available on free tier (lead magnet)

---

## Quick Setup

### 1. Create Webhook in Home Assistant

**Option A: Use the Blueprint (Recommended)**

1. Download [`ha/fyndbot_notify.yaml`](ha/fyndbot_notify.yaml) from this repository
2. In Home Assistant:
   - Go to **Settings** → **Automations & Scenes**
   - Click **Blueprints** tab
   - Click **Import Blueprint**
   - Paste: `https://github.com/Vortitron/fyndbot/blob/main/ha/fyndbot_notify.yaml` (or upload file)
3. Create automation from blueprint:
   - Name: `Fyndbot Notifications`
   - Webhook ID: `fyndbot_alert` (must match exactly)
   - Notification Service: Select your notification service (e.g., `notify.mobile_app_your_phone`)
   - Minimum Score: Optional score threshold (0 = all alerts)
   - Save

**Option B: Manual Setup**

1. Go to **Settings** → **Automations & Scenes**
2. Click **+ Create Automation**
3. Click **Create new automation**
4. Click **Add Trigger** → **Webhook**
5. Set Webhook ID: `fyndbot_alert` (or any unique ID you choose)
6. Click **Add Action** → **Notifications: Send a notification**
7. Configure notification as desired
8. Save automation

### 2. Get Your Webhook URL

After creating the automation/webhook trigger, your webhook URL will be:

```
https://YOUR-HA-INSTANCE.com/api/webhook/fyndbot_alert
```

**Finding your URL:**
- If using Nabu Casa: `https://XXXXX.ui.nabu.casa/api/webhook/fyndbot_alert`
- If using DuckDNS: `https://YOUR-SUBDOMAIN.duckdns.org/api/webhook/fyndbot_alert`
- If local only: `https://YOUR-LOCAL-IP:8123/api/webhook/fyndbot_alert`

**Important:** The webhook must be accessible via **HTTPS**. Fyndbot requires secure connections.

### 3. Configure Fyndbot

Send the following command to Fyndbot in Telegram:

```
/ha set https://YOUR-HA-INSTANCE.com/api/webhook/fyndbot_alert
```

Replace with your actual webhook URL.

### 4. Test Connection

Send test notification to verify:

```
/ha test
```

You should receive a test notification in Home Assistant. Check:
- Home Assistant notification service
- Automation trace (Settings → Automations → Your Automation → ⋮ → Traces)

---

## Webhook Payload

When Fyndbot detects a new listing, it sends a JSON payload:

```json
{
  "source": "fyndbot",
  "event": "listing_alert",
  "watch_id": 1,
  "follow_id": null,
  "title": "Volvo V70 2015 - Låg mil",
  "price": 125000,
  "currency": "SEK",
  "url": "https://www.blocket.se/...",
  "score": 7.2,
  "score_reason": "Good price for year, low mileage mentioned",
  "is_pro": true,
  "location": "Stockholm",
  "image_url": "https://images.blocket.se/...",
  "category": "Bilar"
}
```

**Fields:**
- `source` — Always `"fyndbot"`
- `event` — Always `"listing_alert"` (or `"test"` for `/ha test`)
- `watch_id` — Watch ID if from a watch alert (null otherwise)
- `follow_id` — Follow ID if from a follow alert (null otherwise)
- `title` — Listing title
- `price` — Price in minor units (e.g., 125000 = 125,000 SEK), null if not specified
- `currency` — Currency code (always `"SEK"` for Blocket)
- `url` — Direct link to listing
- `score` — AI bargain score 1-10 (null if free user or LLM unavailable)
- `score_reason` — AI reasoning (null if score is null)
- `is_pro` — Whether user is Pro subscriber
- `location` — Listing location (null if not specified)
- `image_url` — Listing image URL (null if no image)
- `category` — Listing category (null if not specified)

---

## Example Automations

### 1. Notify Only High-Score Listings (Pro Users)

```yaml
alias: Fyndbot High Score Alerts
trigger:
  - platform: webhook
    webhook_id: fyndbot_alert
condition:
  - condition: template
    value_template: "{{ trigger.json.score is not none and trigger.json.score >= 8.0 }}"
action:
  - service: notify.mobile_app_your_phone
    data:
      title: "🔥 Great Deal Found!"
      message: "{{ trigger.json.title }} - {{ trigger.json.price }} {{ trigger.json.currency }}"
      data:
        url: "{{ trigger.json.url }}"
        tag: "fyndbot_high_score"
```

### 2. Flash Lights for Very High Scores

```yaml
alias: Fyndbot Flash Lights
trigger:
  - platform: webhook
    webhook_id: fyndbot_alert
condition:
  - condition: template
    value_template: "{{ trigger.json.score is not none and trigger.json.score >= 9.0 }}"
action:
  - service: light.turn_on
    target:
      entity_id: light.living_room
    data:
      flash: short
  - service: notify.mobile_app_your_phone
    data:
      title: "⭐⭐⭐ Amazing Deal!"
      message: "{{ trigger.json.title }} - Score: {{ trigger.json.score }}/10"
```

### 3. Create Persistent Notification

```yaml
alias: Fyndbot Persistent Notifications
trigger:
  - platform: webhook
    webhook_id: fyndbot_alert
action:
  - service: persistent_notification.create
    data:
      title: "{{ trigger.json.title }}"
      message: |
        Price: {{ trigger.json.price }} {{ trigger.json.currency }}
        {% if trigger.json.score %}
        Score: {{ trigger.json.score }}/10
        Reason: {{ trigger.json.score_reason }}
        {% endif %}
        Location: {{ trigger.json.location }}
        
        [View Listing]({{ trigger.json.url }})
      notification_id: "fyndbot_{{ now().timestamp() | int }}"
```

### 4. Log to Spreadsheet (Google Sheets Integration)

```yaml
alias: Fyndbot Log to Sheets
trigger:
  - platform: webhook
    webhook_id: fyndbot_alert
action:
  - service: google_sheets.append_sheet
    data:
      config_entry: your_google_sheets_config
      worksheet: Fyndbot Alerts
      data:
        - - "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}"
          - "{{ trigger.json.title }}"
          - "{{ trigger.json.price }}"
          - "{{ trigger.json.score | default('N/A') }}"
          - "{{ trigger.json.url }}"
```

### 5. Send to Specific Device Based on Category

```yaml
alias: Fyndbot Category Routing
trigger:
  - platform: webhook
    webhook_id: fyndbot_alert
action:
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ 'Bilar' in trigger.json.category }}"
        sequence:
          - service: notify.mobile_app_dads_phone
            data:
              message: "New car listing: {{ trigger.json.title }}"
      - conditions:
          - condition: template
            value_template: "{{ 'Elektronik' in trigger.json.category }}"
        sequence:
          - service: notify.mobile_app_your_phone
            data:
              message: "New electronics: {{ trigger.json.title }}"
    default:
      - service: notify.mobile_app_family_group
        data:
          message: "{{ trigger.json.title }}"
```

---

## Commands

### View Status
```
/ha
```

Shows current webhook configuration and status.

### Set Webhook
```
/ha set https://YOUR-HA-INSTANCE.com/api/webhook/fyndbot_alert
```

Saves your Home Assistant webhook URL.

### Remove Webhook
```
/ha clear
```

Removes webhook URL. Alerts will only go to Telegram.

### Test Connection
```
/ha test
```

Sends a test payload to verify your webhook is working.

---

## Remote Access Considerations

**If your Home Assistant is not publicly accessible:**

Fyndbot needs to reach your webhook via HTTPS. Options:

1. **Nabu Casa Cloud** (recommended) — $6.50/month, includes remote access
   - Sign up: https://www.nabucasa.com/
   - Instant HTTPS webhook access
   - Pairs perfectly with **Vome** remote monitoring

2. **DuckDNS + Let's Encrypt** (free)
   - Setup guide: https://www.home-assistant.io/docs/ecosystem/certificates/lets_encrypt/
   - Requires port forwarding

3. **Cloudflare Tunnel** (free)
   - Zero-touch remote access
   - No port forwarding needed

**Pro Tip:** Combine Fyndbot's HA integration with [Vome.io](https://vome.io) for complete home automation monitoring. Vome provides secure remote access to your Home Assistant instance from anywhere.

---

## Troubleshooting

### Webhook Not Receiving Alerts

**Check:**
1. Webhook URL is correct (HTTPS, contains `/api/webhook/`)
2. Home Assistant automation is enabled
3. Webhook ID matches between HA and URL
4. Firewall allows incoming HTTPS (if self-hosted)
5. Check HA logs: **Settings** → **System** → **Logs**

**Test with curl:**
```bash
curl -X POST https://YOUR-HA-INSTANCE.com/api/webhook/fyndbot_alert \
  -H "Content-Type: application/json" \
  -d '{"source":"test","event":"test","title":"Test"}'
```

### `/ha set` Fails

**Error:** "Invalid webhook URL"

**Fix:** Ensure:
- URL starts with `https://` (not `http://`)
- URL contains `/api/webhook/`
- No typos in URL

### Test Works But Real Alerts Don't

**Possible causes:**
1. No watches or follows configured (`/list` to check)
2. Watches in seed mode (first poll marks all as seen)
3. No new listings yet (check again after 2-5 minutes)

**Debug:**
```
# Create a test watch
/watch elektronik stockholm

# Wait 2-5 minutes for first poll
# Check bot logs for "Seed mode" or "Found N new listings"
```

---

## Privacy & Security

- ✅ **No HA credentials needed** — Webhooks use anonymous HTTPS POST
- ✅ **Your data stays yours** — Fyndbot only sends alerts, never reads HA state
- ✅ **Free tier included** — No Pro subscription required for HA integration
- ✅ **Unsubscribe anytime** — `/ha clear` removes webhook instantly

**Webhook URL Security:**
- Use a unique webhook ID (not `fyndbot_alert` if shared)
- Rotate webhook ID periodically (regenerate in HA)
- Don't share webhook URL publicly

---

## FAQ

**Q: Do I need Fyndbot Pro for HA integration?**  
A: No! HA webhooks work on free tier. Pro users get AI scores in the payload.

**Q: Can I use MQTT instead of webhooks?**  
A: Not yet. Webhooks-only for MVP. MQTT may come later.

**Q: Does this work with Home Assistant Core (Docker)?**  
A: Yes! Works with any HA installation (Core, Supervised, OS, Container).

**Q: Can I have multiple automations on one webhook?**  
A: Yes! Create multiple automations using the same webhook ID.

**Q: What if my internet goes down?**  
A: Alerts are sent in real-time, not queued. Missed alerts won't be resent.

**Q: Can I filter by price in HA?**  
A: Yes! Use `{{ trigger.json.price <= 50000 }}` in conditions.

---

## Support & Community

- **GitHub Issues:** https://github.com/Vortitron/fyndbot/issues
- **Home Assistant Forum:** [Post your setup!] (Coming soon)
- **Built by:** [Vome.io](https://vome.io) — Powering Swedish home automation ❤️

---

**Ready to automate your bargain hunting?** 🚀  
Start with `/ha set` and let Home Assistant work for you!
