# How to Get Supabase Connection String (IPv4 Compatible)

## Problem
Your system doesn't support IPv6, but Supabase's direct connection uses IPv6.

## Solution: Use Connection Pooling

### Step 1: Go to Supabase Dashboard

1. Open your Supabase project
2. Go to **Project Settings** (gear icon in sidebar)
3. Click **Database** in the left menu

### Step 2: Get the Connection Pooling URI

1. Scroll down to **Connection string** section
2. Click on the **Connection pooling** tab (NOT "URI")
3. Select **Session mode** from the dropdown
4. You'll see a connection string that looks like:

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Step 3: Update .env

Copy that connection string and:

1. Replace `[YOUR-PASSWORD]` with your actual password
2. **URL-encode special characters** in the password:
   - `@` → `%40`
   - `#` → `%23`
   - etc.

3. Add SSL and timeout parameters:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:YOUR_ENCODED_PASSWORD@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=10
```

### Example:

If your connection pooling string is:
```
postgresql://postgres.jjlmfnpvcbaqzcdehbpw:N@bster96aym@n@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

It becomes:
```env
DATABASE_URL=postgresql://postgres.jjlmfnpvcbaqzcdehbpw:N%40bster96aym%40n@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=10
```

### Important Notes:

- **Port 6543** = Connection pooling (recommended, uses IPv4)
- **Port 5432** = Direct connection (uses IPv6, won't work if IPv6 is unavailable)
- Always use **Session mode** for connection pooling
- The hostname will be `aws-0-[REGION].pooler.supabase.com` NOT `db.[PROJECT].supabase.co`

### Alternative: Enable IPv6 on Your System

If you want to use the direct connection (port 5432), you need to enable IPv6:

**On Linux:**
```bash
# Check if IPv6 is enabled
ip -6 addr show

# If disabled, enable it (varies by distribution)
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=0
```

But using the connection pooler (port 6543) is recommended anyway as it's more efficient.

### Test the Connection

After updating `.env`, restart the backend and test:

```bash
python app.py
```

You should see:
```
INFO:__main__:Loading active monitors from database...
INFO:__main__:Telegram bot thread started
INFO:__main__:Cleaned up 0 expired auth codes
INFO:__main__:Application initialized successfully
```

If you still get errors, verify:
1. ✅ Correct pooler hostname from Supabase
2. ✅ Password is URL-encoded
3. ✅ Using port 6543 (not 5432)
4. ✅ Added `?sslmode=require&connect_timeout=10`
