const Binance = require('binance-api-node').default;
const client = Binance();

async function getRealTimeCandles(symbol, interval, limit) {
  const klines = await client.candles({ symbol, interval, limit });
  return klines.map(k => ({
    time: k.openTime,
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.volume)
  }));
}

function subscribePrice(symbol, callback) {
  const ws = client.ws.ticker(symbol, ticker => {
    callback({ price: parseFloat(ticker.currentClose), time: Date.now() });
  });
  return ws;
}

module.exports = { getRealTimeCandles, subscribePrice };
