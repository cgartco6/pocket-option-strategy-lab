const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { getRealTimeCandles, subscribePrice } = require('./market/binanceClient');
const { runBacktestOnHistorical } = require('./strategies');
const { AIStrategy } = require('./strategies/aiStrategy');

const app = express();
app.use(cors());
app.use(express.json());

// REST endpoint: historical backtest for all strategies
app.post('/api/backtest', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1m', limit = 300 } = req.body;
  try {
    const candles = await getRealTimeCandles(symbol, interval, limit);
    const results = runBacktestOnHistorical(candles);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket server for live AI signals
const wss = new WebSocket.Server({ port: 8081 });
wss.on('connection', (ws) => {
  console.log('Client connected');
  const ai = new AIStrategy();
  // subscribe to real-time price ticks
  subscribePrice('BTCUSDT', async (ticker) => {
    const signal = await ai.predict(ticker);
    ws.send(JSON.stringify({ type: 'signal', ...signal }));
  });
});

app.listen(3000, () => console.log('Backend on port 3000'));
