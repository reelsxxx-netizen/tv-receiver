# TV Receiver — Battery Formation Detector

TradingView webhook receiver. Receives live candles from Pine Script and serves them to the HTML detector.

## Files

```
tv-receiver/
  server.js       ← main server
  package.json    ← node config
  README.md       ← this file
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /webhook | TradingView sends candle data here |
| GET | /candles?symbol=ETHUSDC&tf=15min | HTML detector polls for candles |
| GET | /status | Health check |

## Webhook Payload (from Pine Script)

```json
{
  "symbol": "ETHUSDC",
  "tf":     "15min",
  "time":   "2026-05-09T14:00:00Z",
  "open":   2450.10,
  "high":   2461.30,
  "low":    2448.50,
  "close":  2455.80
}
```

## Security

Set the secret key via environment variable:
```
TV_SECRET=your_secret_here
```
Match this in your Pine Script alert message header.

## Deploy to Railway

1. Push this folder to GitHub
2. Connect repo to Railway
3. Set environment variable: TV_SECRET=battery2026
4. Railway auto-deploys on push
5. Your public URL: https://your-app.railway.app
