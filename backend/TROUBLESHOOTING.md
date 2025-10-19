# Troubleshooting Guide

## Database Connection Issues

### Error: "could not translate host name"

This means your DATABASE_URL has special characters in the password that aren't URL-encoded.

**Solution:**

If your Supabase password contains special characters like `@`, `#`, `$`, `%`, `&`, etc., you need to URL-encode them.

**Quick Fix:**
```bash
python encode_password.py
```

Then enter your password and it will give you the encoded version to use in `.env`.

**Manual encoding:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- ` ` (space) → `%20`

**Example:**
```
Original password: N@bster96aym@n
Encoded password: N%40bster96aym%40n

DATABASE_URL=postgresql://postgres:N%40bster96aym%40n@db.xxx.supabase.co:5432/postgres
```

## Telegram Bot Issues

### Error: "set_wakeup_fd only works in main thread"

This is a threading issue with Flask's auto-reloader.

**Solution:**

The app is now configured with `use_reloader=False` by default in `app.py`. This disables Flask's auto-reload but allows the Telegram bot to work properly.

If you need auto-reload during development:
1. Comment out the Telegram bot initialization in `initialize_app()`
2. Change `use_reloader=False` to `use_reloader=True`
3. Run the bot separately (see below)

### Running Bot Separately (Advanced)

Create `run_bot.py`:
```python
from telegram_bot import telegram_bot_handler
from dotenv import load_dotenv

load_dotenv()

if __name__ == '__main__':
    telegram_bot_handler.start_polling()
```

Then run in separate terminal:
```bash
python run_bot.py
```

## Other Common Issues

### Port already in use
```bash
# Find process using port 5000
lsof -i :5000
# Kill it
kill -9 <PID>
```

### Database tables don't exist

Run the schema:
```bash
# In Supabase SQL Editor, run the entire supabase_schema.sql file
```

### Bot not responding

1. Check bot token is correct in `.env`
2. Restart the backend server
3. Check backend console for errors
4. Test bot directly in Telegram with `/start`

### "Database password" error in logs

Your `.env` file likely has the wrong password. Check:
1. Supabase Project Settings → Database → Password
2. If you reset the password, update DATABASE_URL
3. Remember to URL-encode special characters!

### Import errors

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

## Development Tips

### Viewing logs
All logs go to console. For production, redirect to file:
```bash
python app.py >> app.log 2>&1
```

### Testing database connection
```python
from models import get_db
db = get_db()
print("Connected!")
db.close()
```

### Testing Telegram bot
```python
from telegram_bot import telegram_bot_handler
import asyncio

async def test():
    await telegram_bot_handler.send_notification(YOUR_CHAT_ID, "Test message")

asyncio.run(test())
```

## Getting Help

1. Check backend console logs
2. Check Supabase logs (Logs & Analytics)
3. Check browser console (F12)
4. Verify all environment variables are set
5. Test each component separately
