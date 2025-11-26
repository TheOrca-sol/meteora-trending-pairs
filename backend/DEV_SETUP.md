# Development Setup Guide

This guide explains how to set up a separate test Telegram bot for development to avoid conflicts with the production bot running on Railway.

## Why Separate Bots?

- **Production bot** runs on Railway with production database
- **Test bot** runs locally with test database
- Prevents conflicts from multiple bot instances polling Telegram API
- Safe to test without affecting real users

---

## Quick Start

### 1. Create Test Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send command: `/newbot`
3. Follow prompts:
   - **Bot name**: `Meteora Test Bot` (or any name you want)
   - **Username**: `meteora_test_bot` (must end with `bot` and be unique)
4. **Save the token** BotFather gives you (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configure Local Environment

```bash
cd backend

# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your test bot credentials
nano .env.local  # or use any editor
```

Update these values in `.env.local`:
```bash
TELEGRAM_BOT_TOKEN=<your_test_bot_token_from_botfather>
TELEGRAM_BOT_USERNAME=meteora_test_bot
```

### 3. Run Development Server

```bash
# Make sure you're in the backend directory
cd backend

# Install dependencies (if not already done)
pip install -r requirements.txt

# Run the development server with test bot
python run_dev.py
```

You should see:
```
✅ Loading test environment from /path/to/.env.local
🤖 Using Telegram bot: @meteora_test_bot
   Token: 12345678...xyz12345
💾 Using local SQLite database: sqlite:///./test_meteora.db
============================================================
Starting development server...
============================================================
```

---

## Testing the Bot

### Test Bot Commands

1. Open Telegram and search for your bot: `@meteora_test_bot`
2. Click **START**
3. Try commands:
   - `/help` - Show available commands
   - `/status` - Check monitoring status (requires wallet linked)

### Link Test Wallet

1. Run the frontend locally (see frontend/README.md)
2. Connect your wallet
3. Go to Settings → Telegram Connection
4. Click "Connect Telegram"
5. It will generate a code and link to your **test bot**
6. Click the link → Press START in Telegram
7. Your wallet is now linked to the test bot!

---

## Database Management

### Local SQLite Database

The test environment uses SQLite stored in `test_meteora.db`:

```bash
# View database
sqlite3 test_meteora.db

# Show tables
.tables

# Check users
SELECT * FROM users;

# Exit
.quit
```

### Reset Test Database

```bash
# Delete the test database
rm test_meteora.db

# Restart the dev server (will recreate database)
python run_dev.py
```

---

## Environment Comparison

| Environment | Bot Token | Bot Username | Database | RPC |
|------------|-----------|--------------|----------|-----|
| **Production** (Railway) | Production token | @MeteoraBot | Railway Postgres | Helius (paid) |
| **Development** (Local) | Test token | @meteora_test_bot | Local SQLite | Public or Helius test |

---

## Troubleshooting

### Issue: "Conflict: terminated by other getUpdates request"

**Cause**: Both production and test bots are using the same token.

**Solution**:
- Make sure `.env.local` has your **test bot token**, not production
- Check the startup logs confirm using `@meteora_test_bot`

### Issue: Bot doesn't respond to commands

**Checklist**:
1. ✅ Created new bot with @BotFather?
2. ✅ Copied token to `.env.local`?
3. ✅ Pressed START in Telegram?
4. ✅ Dev server shows `✅ Acquired polling lock`?

### Issue: ".env.local not found"

```bash
# Create from example
cp .env.local.example .env.local

# Edit with your credentials
nano .env.local
```

---

## Best Practices

### ✅ DO:
- Use test bot for all local development
- Keep `.env.local` on your machine only (it's in .gitignore)
- Test breaking changes with test bot before deploying
- Use a test wallet (not your main wallet) for testing

### ❌ DON'T:
- Commit `.env.local` to git
- Use production bot token locally
- Test with production database
- Share your bot tokens publicly

---

## Deploying to Production

When you're ready to deploy changes:

1. **Test locally first** with test bot
2. **Commit changes** to git
3. **Push to GitHub**
4. **Railway auto-deploys** with production bot credentials
5. **Monitor Railway logs** to ensure production bot starts correctly

---

## Advanced: Multiple Developers

If multiple developers need test bots:

1. Each developer creates their **own test bot** with @BotFather
2. Each uses their own `.env.local` (not shared)
3. Each uses their own local database
4. No conflicts because each bot has unique token

Example team setup:
- Developer 1: `@meteora_test_alice_bot`
- Developer 2: `@meteora_test_bob_bot`
- Production: `@MeteoraBot`

---

## Files Reference

```
backend/
├── .env                    # Default (not used if .env.local exists)
├── .env.local              # Your local config (gitignored)
├── .env.local.example      # Template for .env.local
├── run_dev.py             # Development server script
├── app.py                 # Main Flask app
├── telegram_bot.py        # Telegram bot handler
└── test_meteora.db        # Local SQLite database (created automatically)
```

---

## Need Help?

- Check Railway logs for production issues
- Check terminal output for local issues
- Telegram bot not responding? Check logs for "Acquired polling lock"
- Database issues? Try resetting `test_meteora.db`

Happy testing! 🚀
