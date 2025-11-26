# Meteora DLMM Microservice

Node.js microservice that wraps the official Meteora SDK for use by the Python automation backend.

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your DEGEN_WALLET_PRIVATE_KEY
```

3. **Start service:**
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Endpoints

### Health Check
```
GET /health
```

### Get Position Data
```
POST /position/data
Body: {
  "positionAddress": "...",
  "poolAddress": "..."
}
Returns: {
  "amountX": float,
  "amountY": float,
  "valueUSD": float,
  "feesX": float,
  "feesY": float,
  "feesUSD": float,
  "profitUSD": float,
  "inRange": boolean,
  "activeBinId": int,
  "lowerBinId": int,
  "upperBinId": int
}
```

### Close Position
```
POST /position/close
Body: {
  "positionAddress": "...",
  "poolAddress": "..."
}
Returns: {
  "signature": "..."
}
```

### Claim Fees
```
POST /position/claim-fees
Body: {
  "positionAddress": "...",
  "poolAddress": "..."
}
Returns: {
  "signature": "..."
}
```

### Add Liquidity
```
POST /position/add-liquidity
Body: {
  "positionAddress": "...",
  "poolAddress": "...",
  "amountX": float,
  "amountY": float
}
Returns: {
  "signature": "..."
}
```

### Compound Fees
```
POST /position/compound
Body: {
  "positionAddress": "...",
  "poolAddress": "..."
}
Returns: {
  "claimSignature": "...",
  "addSignature": "...",
  "feesCompounded": {
    "feesX": float,
    "feesY": float
  }
}
```

## Testing

```bash
# Health check
curl http://localhost:3002/health

# Get position data
curl -X POST http://localhost:3002/position/data \
  -H "Content-Type: application/json" \
  -d '{"positionAddress":"...","poolAddress":"..."}'
```

## Integration with Python

The Python backend calls this service via HTTP:

```python
import requests

response = requests.post('http://localhost:3002/position/data', json={
    'positionAddress': position.position_address,
    'poolAddress': position.pool_address
})
position_data = response.json()
```

## Environment Variables

- `SOLANA_RPC_URL` - Solana RPC endpoint (default: mainnet)
- `DEGEN_WALLET_PRIVATE_KEY` - Private key as JSON array
- `PORT` - Server port (default: 3002)
