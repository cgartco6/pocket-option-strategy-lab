const indicators = require('technicalindicators');

// ---------- common indicators ----------
function ema(closes, period) {
  return indicators.EMA.calculate({ period, values: closes });
}
function rsi(closes, period = 14) {
  return indicators.RSI.calculate({ values: closes, period });
}
function stochastic(closes, highs, lows) {
  return indicators.Stochastic.calculate({ high: highs, low: lows, close: closes, periodK: 14, periodD: 3 });
}
function macd(closes) {
  return indicators.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
}

// 1. Katie's Best (RSI + EMA)
function katieBest(candles, idx) {
  if (idx < 30) return 'none';
  const closes = candles.map(c => c.close);
  const rsiVals = rsi(closes);
  const ema20 = ema(closes, 20);
  if (rsiVals[idx] < 35 && candles[idx].close > ema20[idx]) return 'call';
  if (rsiVals[idx] > 70 && candles[idx].close < ema20[idx]) return 'put';
  return 'none';
}

// 2. $42,185 in Minutes (Bollinger breakout)
function fortyTwoK(candles, idx) {
  if (idx < 20) return 'none';
  const closes = candles.map(c => c.close);
  const bb = indicators.BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const price = candles[idx].close;
  if (price <= bb[idx].lower && candles[idx].close - candles[idx-1].close > 0) return 'call';
  if (price >= bb[idx].upper && candles[idx].close - candles[idx-1].close < 0) return 'put';
  return 'none';
}

// 3. 3 Minutes = $20,455 (ROC)
function threeMinTwentyK(candles, idx) {
  if (idx < 3) return 'none';
  const roc = (candles[idx].close - candles[idx-3].close) / candles[idx-3].close * 100;
  if (roc > 0.35) return 'call';
  if (roc < -0.35) return 'put';
  return 'none';
}

// 4. 100% Win Method (CCI + Williams %R)
function hundredPercentWin(candles, idx) {
  if (idx < 20) return 'none';
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const cci = indicators.CCI.calculate({ high: highs, low: lows, close: closes, period: 20 });
  const wr = indicators.WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  if (cci[idx] < -120 && wr[idx] < -85) return 'call';
  if (cci[idx] > 120 && wr[idx] > -15) return 'put';
  return 'none';
}

// 5. Old But Gold (Stochastic + SMA)
function oldButGold(candles, idx) {
  if (idx < 20) return 'none';
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const stoch = stochastic(closes, highs, lows);
  const sma5 = indicators.SMA.calculate({ period: 5, values: closes });
  if (stoch[idx].k > stoch[idx].d && stoch[idx].k < 35 && candles[idx].close > sma5[idx]) return 'call';
  if (stoch[idx].k < stoch[idx].d && stoch[idx].k > 75 && candles[idx].close < sma5[idx]) return 'put';
  return 'none';
}

// 6. $1 → $33,884 (trend following + dynamic risk)
function oneToThirtyEight(candles, idx) {
  if (idx < 18) return 'none';
  const closes = candles.map(c => c.close);
  const emaFast = ema(closes, 5);
  const emaSlow = ema(closes, 13);
  const prevFast = emaFast[idx-1], prevSlow = emaSlow[idx-1];
  if (emaFast[idx] > emaSlow[idx] && prevFast <= prevSlow) return 'call';
  if (emaFast[idx] < emaSlow[idx] && prevFast >= prevSlow) return 'put';
  return 'none';
}

// Helper: run backtest for a single strategy (fixed risk $200 or dynamic 6%)
function runStrategyBacktest(candles, strategyFn, initialCapital = 10000, dynamicRisk = false) {
  let equity = initialCapital;
  const equityCurve = [equity];
  let wins = 0, trades = 0;
  for (let i = 0; i < candles.length - 3; i++) {
    const action = strategyFn(candles, i);
    if (action === 'none') continue;
    const risk = dynamicRisk ? equity * 0.06 : 200;
    const won = (action === 'call' && candles[i+3].close > candles[i].close) ||
                (action === 'put' && candles[i+3].close < candles[i].close);
    trades++;
    if (won) { equity += risk * 0.8; wins++; }
    else { equity -= risk; }
    equityCurve.push(equity);
  }
  return { finalEquity: equity, winRate: trades ? (wins/trades)*100 : 0, trades, equityCurve };
}

function runBacktestOnHistorical(candles) {
  const strategies = [
    { name: "Katie's Best Winning Strategy", fn: katieBest, dynamic: false },
    { name: "🔥 MY Custom AI Strategy", fn: null, dynamic: false, isAI: true },
    { name: "$42,185 in Minutes", fn: fortyTwoK, dynamic: false },
    { name: "3 Minutes = $20,455", fn: threeMinTwentyK, dynamic: false },
    { name: "My 100% Win Method", fn: hundredPercentWin, dynamic: false },
    { name: "Old But Gold", fn: oldButGold, dynamic: false },
    { name: "$1 to $33,884", fn: oneToThirtyEight, dynamic: true }
  ];
  const results = [];
  for (const s of strategies) {
    if (s.isAI) {
      // use AI strategy from separate module
      const { runAIBacktest } = require('./aiStrategy');
      results.push(runAIBacktest(candles));
    } else {
      results.push({ name: s.name, ...runStrategyBacktest(candles, s.fn, 10000, s.dynamic) });
    }
  }
  return results;
}

module.exports = { runBacktestOnHistorical };
