# Railway Deployment Guide

This guide explains how to deploy the complete application stack on Railway.

## Architecture

The application consists of 3 separate services:

```
┌─────────────────────────────────────────────────┐
│                   Railway                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │  Frontend (React)                   │        │
│  │  - Served via static hosting        │        │
│  │  - Calls Backend API                │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │  Backend (Python/Flask)             │        │
│  │  - Main API                         │        │
│  │  - APScheduler (Monitoring)         │        │
│  │  - Telegram Bot                     │        │
│  │  - PostgreSQL Database              │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │  DLMM Service (Node.js/TypeScript)  │        │
│  │  - DLMM liquidity data              │        │
│  │  - Meteora SDK integration          │        │
│  └─────────────────────────────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Service 1: Backend (Python)

### Root Directory
`/backend`

### Environment Variables
```bash
# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# DLMM Service URL (set after deploying Service 3)
DLMM_SERVICE_URL=https://your-dlmm-service.railway.app

# Optional: Cache mode
USE_GROUPED_CACHE=false
```

### Build Command
```bash
pip install -r requirements.txt
```

### Start Command
Uses `Procfile`:
```
web: gunicorn app:app --workers=1 --threads=4 --timeout=120 --preload
```

### Important Notes
- **Single worker only** (`--workers=1`) to prevent duplicate APScheduler jobs
- `--preload` flag ensures APScheduler initializes correctly
- APScheduler automatically starts when `DATABASE_URL` is set
- Degen Mode and Capital Rotation monitoring will resume automatically on startup

### PostgreSQL Database
Create a PostgreSQL database in Railway and link it to the backend service. The `DATABASE_URL` will be automatically set.

## Service 2: DLMM Service (Node.js)

### Root Directory
`/services/dlmm-service`

### Environment Variables
```bash
# Port (Railway sets this automatically)
PORT=3000

# Optional: Solana RPC endpoint (uses public by default)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Build Command
```bash
npm install
```

### Start Command
```bash
npm start
```

### Important Notes
- This service must be deployed **before** the backend
- Copy the deployed URL and set it as `DLMM_SERVICE_URL` in the backend
- No database required for this service

## Service 3: Frontend (React)

### Root Directory
`/frontend`

### Environment Variables
```bash
# Backend API URL (set after deploying Service 1)
REACT_APP_API_URL=https://your-backend.railway.app/api

# Optional: DLMM Service URL (for direct calls if needed)
REACT_APP_DLMM_SERVICE_URL=https://your-dlmm-service.railway.app
```

### Build Command
```bash
npm install && npm run build
```

### Start Command
```bash
serve -s build -l $PORT
```

**Note**: Install `serve` as a dependency:
```json
"dependencies": {
  "serve": "^14.2.0"
}
```

## Deployment Order

1. **Deploy DLMM Service first**
   - Create new service from `/services/dlmm-service`
   - Copy the deployed URL

2. **Deploy Backend second**
   - Create new service from `/backend`
   - Add PostgreSQL database
   - Set `DLMM_SERVICE_URL` with the URL from step 1
   - Set `TELEGRAM_BOT_TOKEN`
   - Backend will auto-start monitoring jobs

3. **Deploy Frontend last**
   - Create new service from `/frontend`
   - Set `REACT_APP_API_URL` with the backend URL from step 2
   - Set `REACT_APP_DLMM_SERVICE_URL` with the DLMM URL from step 1

## Testing the Deployment

### 1. Check Backend Health
```bash
curl https://your-backend.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 2. Check DLMM Service
```bash
curl https://your-dlmm-service.railway.app/health
```

### 3. Check Scheduler Status
```bash
curl https://your-backend.railway.app/api/monitoring/debug
```

This will show all active monitoring jobs.

### 4. Test Frontend
Visit your frontend URL and verify:
- ✅ Analytics table loads
- ✅ Settings modal works
- ✅ Wallet connection works
- ✅ Telegram connection works

## Monitoring in Production

### Check APScheduler Jobs
The backend logs will show:
```
✅ Degen monitoring service initialized
Loading active degen monitors from database...
Found X enabled degen monitors
```

### Check Telegram Notifications
If Degen Mode is enabled:
- Notifications will be sent every 1 minute (for pools meeting threshold)
- 30-minute cooldown prevents spam for the same pool

### View Logs
Use Railway's log viewer to monitor:
- API requests
- Scheduler job execution
- Telegram notifications
- Database queries

## Troubleshooting

### APScheduler Not Running
- Check that `DATABASE_URL` is set
- Verify `--workers=1` in Procfile (multiple workers cause issues)
- Check logs for scheduler initialization messages

### Degen Mode Not Sending Notifications
- Verify `TELEGRAM_BOT_TOKEN` is set
- Check that users have connected Telegram via Settings
- Check monitoring is enabled in Degen Mode UI
- Review logs for error messages

### DLMM Service Connection Issues
- Verify `DLMM_SERVICE_URL` is set in backend
- Check DLMM service is running
- Test DLMM service health endpoint

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL is running
- Review connection pool settings

## Environment Variable Summary

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `DLMM_SERVICE_URL` | Yes | DLMM service URL |
| `USE_GROUPED_CACHE` | No | Cache mode (default: false) |

### DLMM Service
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Auto | Set by Railway |
| `SOLANA_RPC_URL` | No | Solana RPC endpoint |

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Backend API URL |
| `REACT_APP_DLMM_SERVICE_URL` | No | DLMM service URL |

## Cost Optimization

- **Backend**: Runs continuously (APScheduler needs to stay running)
- **DLMM Service**: Can scale to zero when not in use
- **Frontend**: Static hosting (very cheap)
- **Database**: Use Railway's free tier or optimize query usage

## Scaling Considerations

### Backend
- Keep `--workers=1` to avoid duplicate scheduled jobs
- Use `--threads=4` for concurrent request handling
- APScheduler handles concurrent job execution internally

### DLMM Service
- Can scale horizontally (stateless)
- No data persistence needed
- CPU-intensive for large pools

### Database
- Monitor connection pool usage
- Add indexes for monitoring queries
- Consider read replicas for heavy loads
