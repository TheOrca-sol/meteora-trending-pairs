# Telegram Monitoring Setup Guide

This guide will walk you through setting up the Telegram-based monitoring system with Supabase PostgreSQL database.

## 📋 Prerequisites

- Supabase account (free tier works)
- Telegram account
- Python 3.8+ with venv
- Node.js 14+ for frontend

---

## 1️⃣ Create Telegram Bot

### Step 1: Create the bot with BotFather

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the prompts:
   - Choose a name for your bot (e.g., "Meteora Capital Rotation")
   - Choose a username (must end in 'bot', e.g., "meteora_rotation_bot")
4. **Save the bot token** - you'll need this later
5. **Save the bot username** - you'll need this too

### Step 2: Configure bot settings (optional)

Send these commands to @BotFather:
```
/setdescription - "Get notified about capital rotation opportunities on Meteora DLMM"
/setabouttext - "Automated monitoring for Meteora DLMM capital rotation opportunities"
```

---

## 2️⃣ Set Up Supabase Database

### Step 1: Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - Project name: `meteora-monitoring` (or your choice)
   - Database password: Create a strong password (SAVE THIS!)
   - Region: Choose closest to your users
5. Click "Create new project" and wait for setup to complete

### Step 2: Run the database schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `backend/supabase_schema.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this is correct!

### Step 3: Get your database connection URL

1. In Supabase dashboard, go to **Project Settings** (gear icon)
2. Click **Database** in the left sidebar
3. Scroll to **Connection string** section
4. Select **URI** tab
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
6. **Replace `[YOUR-PASSWORD]` with your actual database password**

---

## 3️⃣ Configure Backend Environment

### Step 1: Create .env file

1. Navigate to `backend/` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` file with your values:
   ```env
   # Supabase Database Configuration
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres

   # Telegram Bot Configuration (from BotFather)
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_BOT_USERNAME=your_bot_username

   # Application Configuration
   FLASK_ENV=development
   SECRET_KEY=your_random_secret_key_here
   ```

### Step 2: Verify environment variables

Replace these placeholders:
- `YOUR_PASSWORD` - Your Supabase database password
- `YOUR_PROJECT_REF` - Your Supabase project reference (from connection string)
- `TELEGRAM_BOT_TOKEN` - Token from BotFather
- `TELEGRAM_BOT_USERNAME` - Your bot's username (without @)
- `SECRET_KEY` - Generate a random string (you can use: `python -c "import secrets; print(secrets.token_hex(32))"`)

---

## 4️⃣ Install Dependencies

### Backend (Python)

All dependencies are already installed! But if you need to reinstall:

```bash
cd backend
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Frontend (React)

```bash
cd frontend
npm install
```

---

## 5️⃣ Start the Application

### Option A: Development Mode (Recommended for testing)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Option B: Production Mode

**Backend:**
```bash
cd backend
source venv/bin/activate
gunicorn app:app --bind 0.0.0.0:5000
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve the build folder with your preferred web server
```

---

## 6️⃣ Test the Integration

### Step 1: Test Telegram Bot

1. Open Telegram and search for your bot (using the username you created)
2. Send `/start` - you should get a welcome message
3. Send `/help` - you should get a list of commands

If the bot doesn't respond, check:
- Backend is running
- `TELEGRAM_BOT_TOKEN` is correct in `.env`
- No errors in backend console

### Step 2: Test Web App Integration

1. Open the web app (http://localhost:3000)
2. Connect your Solana wallet (or use Monitor mode)
3. Go to Capital Rotation page
4. Expand the "Auto-Monitoring" section
5. Click "Connect Telegram"
6. You should see a 6-digit code
7. Click "Open Telegram Bot" - it should open Telegram with the code
8. Bot should confirm connection
9. Web app should show "Connected as @your_username"

### Step 3: Test Monitoring

1. Set your whitelist and preferences
2. Configure monitoring settings (interval, threshold)
3. Toggle monitoring ON
4. Check backend console for confirmation
5. Wait for the check interval (or check database to verify it's running)

---

## 7️⃣ Verify Database

You can verify everything is working in Supabase:

1. Go to **Table Editor** in Supabase dashboard
2. Check these tables:
   - `users` - Should have your wallet address and Telegram chat ID
   - `monitoring_configs` - Should have your monitoring configuration
   - `telegram_auth_codes` - Should be empty (codes are cleaned up after use)
   - `opportunity_snapshots` - Will be populated after first check

---

## 🔧 Troubleshooting

### Bot not responding
- Check `TELEGRAM_BOT_TOKEN` in `.env`
- Restart backend server
- Check backend console for errors

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check Supabase project is running
- Verify database password is correct
- Check if your IP is allowed (Supabase allows all by default)

### Frontend can't connect
- Verify backend is running on port 5000
- Check CORS settings in `app.py`
- Check browser console for errors

### Monitoring not working
- Verify Telegram is connected
- Check backend console for scheduler logs
- Verify whitelist is not empty
- Check database `monitoring_configs` table

---

## 📊 Monitoring Architecture

### How it works:

1. **User connects Telegram**: Web app generates a 6-digit code → User sends code to bot → Bot stores wallet ↔ chat_id mapping in database

2. **User enables monitoring**: Web app sends config to backend → Backend creates monitoring job in database → APScheduler schedules periodic checks

3. **Monitoring runs**: Every X minutes, backend:
   - Fetches current opportunities
   - Compares with previous snapshot (from database)
   - Identifies new/improved opportunities
   - Sends Telegram notifications
   - Saves new snapshot to database

4. **Server restart**: On startup, backend loads all active monitors from database and reschedules them

### Why database?
- **Persistence**: Monitoring continues even if user closes browser
- **Multi-user**: Each user has their own configuration
- **Reliability**: State is preserved across server restarts
- **History**: Opportunity snapshots enable intelligent comparison

---

## 🚀 Next Steps

1. **Test thoroughly**: Try all features before deploying
2. **Set up monitoring**: Use PM2 or systemd to keep backend running
3. **Configure firewall**: Ensure port 5000 is accessible if needed
4. **Set up logging**: Configure proper log rotation
5. **Backup database**: Enable Supabase automatic backups

---

## 📝 Files Created/Modified

### Backend:
- `supabase_schema.sql` - Database schema
- `models.py` - SQLAlchemy models
- `telegram_bot.py` - Telegram bot handler
- `monitoring_service.py` - Updated to use database
- `app.py` - New endpoints for Telegram auth
- `.env.example` - Environment template
- `requirements.txt` - Updated dependencies
- `monitoring_service_old.py` - Backup of old version

### Frontend:
- `services/monitoringService.js` - Updated API calls
- `components/CapitalRotation/MonitoringPanel.js` - Complete redesign

---

## ⚠️ Important Notes

1. **Keep `.env` secret**: Never commit it to git
2. **Database password**: Store securely
3. **Bot token**: Never share publicly
4. **Production deployment**: Use environment variables, not .env file
5. **Rate limits**: Telegram has rate limits on bot messages (30 msgs/second)
6. **Supabase limits**: Free tier has limits on database size and API requests

---

## 🆘 Support

If you encounter issues:

1. Check backend console logs
2. Check browser console
3. Check Supabase logs (Logs & Analytics section)
4. Verify all environment variables are set correctly
5. Test each component separately (database, bot, frontend)

---

## ✅ Completion Checklist

- [ ] Telegram bot created and token saved
- [ ] Supabase project created
- [ ] Database schema executed successfully
- [ ] `.env` file created and configured
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Telegram bot responds to `/start`
- [ ] Web app can connect to Telegram
- [ ] Monitoring can be enabled
- [ ] Notifications are received
- [ ] Database tables populated correctly

**Congratulations! Your Telegram monitoring system is ready! 🎉**
