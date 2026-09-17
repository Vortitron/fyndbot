# OpenRouter Setup Guide for Fyndbot

This guide explains how to configure OpenRouter for AI bargain scoring in Fyndbot Pro.

---

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) is a unified API for accessing multiple LLM providers (OpenAI, Anthropic, Google, etc.) with a single API key.

**Benefits:**
- Single API key for multiple models
- Pay-as-you-go pricing (no subscriptions)
- Automatic fallbacks if a model is unavailable
- Cheaper than direct OpenAI API for many models

---

## 1. Create OpenRouter Account

1. Visit [openrouter.ai](https://openrouter.ai)
2. Click **Sign Up** (can use GitHub, Google, or email)
3. Verify your email

---

## 2. Add Credits

OpenRouter uses prepaid credits:

1. Go to [openrouter.ai/credits](https://openrouter.ai/credits)
2. Click **Add Credits**
3. Choose amount:
   - $5 — Good for testing (thousands of requests)
   - $10 — Recommended starting amount
   - $20+ — For heavy usage
4. Complete payment (card or crypto)

---

## 3. Get API Key

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Click **Create Key**
3. Give it a name: `Fyndbot`
4. Copy the key (starts with `sk-or-v1-`)
5. **Important:** Save it now — you can't view it again!

---

## 4. Choose a Model

OpenRouter supports many models. For Fyndbot, we recommend:

### Recommended Models

| Model | Cost per 1M tokens | Speed | Quality |
|-------|-------------------|-------|---------|
| `openai/gpt-4o-mini` | $0.15 input / $0.60 output | ⚡ Fast | ⭐⭐⭐⭐ |
| `google/gemini-2.0-flash-001` | $0.10 input / $0.40 output | ⚡⚡ Very Fast | ⭐⭐⭐⭐ |
| `anthropic/claude-3-haiku` | $0.25 input / $1.25 output | ⚡ Fast | ⭐⭐⭐⭐⭐ |
| `meta-llama/llama-3.1-8b-instruct` | $0.06 input / $0.06 output | ⚡ Fast | ⭐⭐⭐ |

**Default:** `openai/gpt-4o-mini` (good balance of cost/quality)

### Cost Estimate

Typical bargain scoring prompt:
- Input: ~100 tokens (listing details)
- Output: ~50 tokens (score + reason)
- Cost per scoring: **~$0.00004** (0.004 cents) with gpt-4o-mini

**Example monthly cost (Pro user with 100 alerts/day):**
- 100 alerts × 30 days = 3,000 scorings
- 3,000 × $0.00004 = **$0.12/month**

Very affordable! 💰

---

## 5. Configure Fyndbot

Edit `.env` file:

```env
# OpenRouter Configuration
LLM_API_KEY=sk-or-v1-abc123...xyz (replace with your actual key)
LLM_API_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4o-mini
```

**Model options:**
- `openai/gpt-4o-mini` — Recommended (cheap + good)
- `google/gemini-2.0-flash-001` — Fastest
- `anthropic/claude-3-haiku` — Best quality
- `meta-llama/llama-3.1-8b-instruct` — Cheapest

---

## 6. Test LLM Scoring

### Restart Bot
```bash
sudo systemctl restart fyndbot
```

### Check Logs
```bash
journalctl -u fyndbot -f
```

Should NOT see:
```
LLM scoring failed, falling back to heuristic
```

### Test with /inspect

1. Open Telegram
2. Send `/inspect <blocket_url>`
3. Should receive AI-powered bargain score

**If it works:** Reasoning will be contextual and smart  
**If it fails:** Reasoning will be generic heuristics

---

## 7. Monitor Usage

### Check Credits

Visit [openrouter.ai/activity](https://openrouter.ai/activity) to see:
- API requests made
- Tokens used
- Cost per request
- Remaining credits

### Set Budget Alert

1. Go to [openrouter.ai/settings](https://openrouter.ai/settings)
2. Set **Budget Alert** to notify at 80% usage
3. You'll get email when approaching limit

---

## Alternative: Direct OpenAI

If you prefer OpenAI directly:

```env
LLM_API_KEY=sk-proj-abc123...xyz (replace with your actual key)
LLM_API_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

**Note:** OpenAI requires a credit card and has minimum billing.

---

## Alternative: Local Models (Free)

For self-hosting (advanced):

### Option 1: Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Run server
ollama serve
```

Configure Fyndbot:
```env
LLM_API_KEY=not-needed
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1:8b
```

### Option 2: LM Studio

1. Download [LM Studio](https://lmstudio.ai)
2. Install a model (e.g., Llama 3.1 8B)
3. Start local server (port 1234)

Configure Fyndbot:
```env
LLM_API_KEY=lm-studio
LLM_API_URL=http://localhost:1234/v1
LLM_MODEL=local-model
```

---

## Troubleshooting

### Error: "LLM scoring failed"

**Check API key:**
```bash
echo $LLM_API_KEY
# Should start with sk-or-v1-
```

**Test API manually:**
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Should return JSON with `choices` array.

### Error: "Insufficient credits"

1. Go to [openrouter.ai/credits](https://openrouter.ai/credits)
2. Add more credits
3. Restart bot

### Scoring Still Generic

Bot falls back to heuristic scoring if LLM fails. Check:

1. `LLM_API_KEY` is set correctly
2. `LLM_API_URL` is correct (note the `/v1` at end)
3. Credits available on OpenRouter
4. Model name is correct (check [openrouter.ai/models](https://openrouter.ai/models))

---

## Cost Optimization

### 1. Choose Cheaper Models

Switch to ultra-cheap models for testing:
```env
LLM_MODEL=meta-llama/llama-3.1-8b-instruct  # ~$0.00001 per scoring
```

### 2. Cache Responses (Future)

Consider caching scores for identical listings (not implemented yet).

### 3. Conditional Scoring

Only score high-value items (not implemented yet).

### 4. Monitor Usage

Check OpenRouter dashboard weekly to avoid surprises.

---

## Model Comparison

### Quality Test

Send same listing to different models:

**Listing:** "Volvo V70 2012 i bra skick 45000 SEK"

| Model | Score | Reason | Cost |
|-------|-------|--------|------|
| gpt-4o-mini | 7/10 | Good price for year, reliable model | $0.00004 |
| gemini-flash | 8/10 | Fair price, popular model, good condition | $0.00003 |
| claude-haiku | 7/10 | Reasonable price for 2012 Volvo | $0.00007 |
| llama-3.1-8b | 6/10 | Average price for this year | $0.00001 |

**Recommendation:** gpt-4o-mini (best balance)

---

## Support

### OpenRouter Help
- Docs: [openrouter.ai/docs](https://openrouter.ai/docs)
- Discord: [discord.gg/openrouter](https://discord.gg/openrouter)

### Fyndbot Issues
- Check logs: `journalctl -u fyndbot -f`
- Look for: "LLM scoring failed" messages
- Verify API key is set in `.env`

---

**Last Updated:** 2026-09-17
