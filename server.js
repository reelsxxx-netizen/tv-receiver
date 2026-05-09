const http = require('http');
const url  = require('url');

/* ── CONFIG ── */
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.TV_SECRET || 'battery2026'; // match this in Pine Script

/* ── CANDLE STORE ── */
// Keeps the last 20 candles per symbol+timeframe key
const candleStore = new Map();
const MAX_CANDLES = 50;

function storeKey(symbol, tf) { return `${symbol}_${tf}`; }

function storeCandle(symbol, tf, candle) {
  const key = storeKey(symbol, tf);
  if (!candleStore.has(key)) candleStore.set(key, []);
  const arr = candleStore.get(key);
  // avoid duplicate timestamps
  if (arr.length && arr[arr.length - 1].time === candle.time) {
    arr[arr.length - 1] = candle; // update last
  } else {
    arr.push(candle);
    if (arr.length > MAX_CANDLES) arr.shift();
  }
}

/* ── CORS HEADERS ── */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Secret');
}

/* ── SERVER ── */
const server = http.createServer((req, res) => {
  setCORS(res);

  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  /* preflight */
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* ── POST /webhook  — TradingView sends candle data here ── */
  if (req.method === 'POST' && pathname === '/webhook') {
    const secret = req.headers['x-secret'] || parsed.query.secret;
    if (secret !== SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Expected payload from Pine Script:
        // { symbol, tf, time, open, high, low, close }
        const { symbol, tf, time, open, high, low, close } = data;

        if (!symbol || !tf || !time || open == null || high == null || low == null || close == null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fields', required: ['symbol','tf','time','open','high','low','close'] }));
          return;
        }

        const candle = {
          time:  String(time),
          open:  parseFloat(open),
          high:  parseFloat(high),
          low:   parseFloat(low),
          close: parseFloat(close)
        };

        storeCandle(symbol.toUpperCase(), tf, candle);

        console.log(`[${new Date().toISOString()}] CANDLE  ${symbol} ${tf}  O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}  @ ${candle.time}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stored: candle }));

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  /* ── GET /candles?symbol=ETHUSDC&tf=15min ── */
  /* HTML detector polls this to get latest candles */
  if (req.method === 'GET' && pathname === '/candles') {
    const symbol = (parsed.query.symbol || '').toUpperCase();
    const tf     = parsed.query.tf || '';
    const key    = storeKey(symbol, tf);
    const candles = candleStore.get(key) || [];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ symbol, tf, count: candles.length, candles }));
    return;
  }

  /* ── GET /status — health check ── */
  if (req.method === 'GET' && pathname === '/status') {
    const keys = [...candleStore.keys()].map(k => ({
      key: k,
      count: candleStore.get(k).length,
      latest: candleStore.get(k).slice(-1)[0] || null
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), feeds: keys }));
    return;
  }

  /* ── 404 ── */
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Battery Formation — Webhook Receiver   ║
║   Listening on port ${String(PORT).padEnd(21)}║
╚══════════════════════════════════════════╝

  POST /webhook      ← TradingView sends candles here
  GET  /candles      ← HTML detector reads candles here
  GET  /status       ← Health check

  Secret key: ${SECRET}
`);
});
