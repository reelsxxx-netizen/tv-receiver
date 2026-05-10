const http = require('http');
const url  = require('url');

/* ── CONFIG ── */
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.TV_SECRET || 'battery2026';

/* ── CANDLE STORE ── */
const candleStore = new Map();
const MAX_CANDLES = 50;

function storeKey(symbol, tf) { return `${symbol}_${tf}`; }

function storeCandle(symbol, tf, candle) {
  const key = storeKey(symbol, tf);
  if (!candleStore.has(key)) candleStore.set(key, []);
  const arr = candleStore.get(key);
  if (arr.length && arr[arr.length - 1].time === candle.time) {
    arr[arr.length - 1] = candle;
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

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* ── POST /webhook ── */
  if (req.method === 'POST' && pathname === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Accept secret from body, header, or query param
        const secret = data.secret || req.headers['x-secret'] || parsed.query.secret;
        if (secret !== SECRET) {
          console.log(`[AUTH FAIL] received="${secret}" expected="${SECRET}"`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        const { symbol, tf, time, open, high, low, close } = data;

        if (!symbol || !tf || !time || open == null || high == null || low == null || close == null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fields' }));
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
        console.log(`[CANDLE] ${symbol} ${tf} O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} @ ${candle.time}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stored: candle }));

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  /* ── GET /candles ── */
  if (req.method === 'GET' && pathname === '/candles') {
    const symbol  = (parsed.query.symbol || '').toUpperCase();
    const tf      = parsed.query.tf || '';
    const candles = candleStore.get(storeKey(symbol, tf)) || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ symbol, tf, count: candles.length, candles }));
    return;
  }

  /* ── GET /status ── */
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} — secret: ${SECRET}`);
});
