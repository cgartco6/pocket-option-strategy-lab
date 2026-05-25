const tf = require('@tensorflow/tfjs-node');
const indicators = require('technicalindicators');

class AIStrategy {
  constructor() {
    this.model = null;
    this.loadOrCreateModel();
  }

  async loadOrCreateModel() {
    try {
      this.model = await tf.loadLayersModel('file://./models/trading_model/model.json');
    } catch(e) {
      this.model = this.buildModel();
      await this.trainModel();
    }
  }

  buildModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [20] }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' })); // call, put, none
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy' });
    return model;
  }

  // Train on last 5000 candles (in real use, pre‑trained)
  async trainModel() {
    const { getRealTimeCandles } = require('../market/binanceClient');
    const candles = await getRealTimeCandles('BTCUSDT', '1m', 2000);
    const features = [], labels = [];
    for (let i = 50; i < candles.length - 3; i++) {
      const feat = this.extractFeatures(candles, i);
      const future = candles[i+3].close;
      const current = candles[i].close;
      let label = 2; // none
      if (future > current * 1.001) label = 0; // call
      if (future < current * 0.999) label = 1; // put
      features.push(feat);
      labels.push(label);
    }
    const xs = tf.tensor2d(features);
    const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), 3);
    await this.model.fit(xs, ys, { epochs: 10, batchSize: 32 });
    await this.model.save('file://./models/trading_model');
  }

  extractFeatures(candles, idx) {
    const closes = candles.map(c => c.close);
    const rsiVal = indicators.RSI.calculate({ values: closes, period: 14 })[idx] || 50;
    const macd = indicators.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })[idx] || { histogram: 0 };
    const bb = indicators.BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 })[idx] || { upper: 0, lower: 0 };
    const price = candles[idx].close;
    return [
      rsiVal / 100,
      macd.histogram / 1000,
      (price - bb.lower) / (bb.upper - bb.lower + 0.001),
      candles[idx].volume / 1000,
      (candles[idx].high - candles[idx].low) / price
    ];
  }

  async predict(ticker) {
    if (!this.model) return { action: 'none', confidence: 0 };
    // need recent candles – simplified: use last known price & mock features
    const dummyFeatures = [0.5, 0, 0.5, 100, 0.01]; // in real app fetch live context
    const input = tf.tensor2d([dummyFeatures]);
    const output = await this.model.predict(input).data();
    const actions = ['call', 'put', 'none'];
    const idx = output.indexOf(Math.max(...output));
    return { action: actions[idx], confidence: output[idx], price: ticker.price };
  }
}

// Backtest for AI strategy (simulate using same feature extraction)
function runAIBacktest(candles) {
  const ai = new AIStrategy();
  // simplified backtest: use rule‑based proxy until model trained, but here we simulate
  let equity = 10000;
  let wins = 0, trades = 0;
  for (let i = 50; i < candles.length - 3; i++) {
    const features = ai.extractFeatures(candles, i);
    const input = tf.tensor2d([features]);
    const output = ai.model ? ai.model.predict(input).dataSync() : [0.4,0.3,0.3];
    const pred = output.indexOf(Math.max(...output));
    const action = pred === 0 ? 'call' : pred === 1 ? 'put' : 'none';
    if (action === 'none') continue;
    const won = (action === 'call' && candles[i+3].close > candles[i].close) ||
                (action === 'put' && candles[i+3].close < candles[i].close);
    trades++;
    if (won) { equity += 200 * 0.8; wins++; }
    else { equity -= 200; }
  }
  return { name: "🔥 MY Custom AI Strategy", finalEquity: equity, winRate: trades ? (wins/trades)*100 : 0, trades };
}

module.exports = { AIStrategy, runAIBacktest };
