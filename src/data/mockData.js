const TICKERS = ['SPY', 'QQQ', 'AAPL'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTimestamp() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - Math.floor(Math.random() * 120));
  return now;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const BASE_PRICES = { SPY: 582.45, QQQ: 498.30, AAPL: 237.15 };

export function generateOptionsFlow(count = 50) {
  const expirations = ['Mar 14', 'Mar 21', 'Mar 28', 'Apr 4', 'Apr 18', 'May 16', 'Jun 20'];
  const types = ['Call', 'Put'];
  const sentiments = ['Bullish', 'Bearish', 'Neutral'];
  const orderTypes = ['Sweep', 'Block', 'Split', 'Single'];

  return Array.from({ length: count }, (_, i) => {
    const ticker = randomChoice(TICKERS);
    const base = BASE_PRICES[ticker];
    const type = randomChoice(types);
    const strike = Math.round(base * randomBetween(0.92, 1.08));
    const premium = randomBetween(0.5, 45).toFixed(2);
    const size = Math.floor(randomBetween(10, 5000));
    const openInterest = Math.floor(randomBetween(100, 50000));
    const volume = Math.floor(randomBetween(size, size * 10));
    const timestamp = generateTimestamp();

    const isSweep = Math.random() > 0.6;
    const orderType = isSweep ? 'Sweep' : randomChoice(orderTypes);
    const isUnusual = isSweep || size > 1000 || (volume / openInterest > 2);

    return {
      id: i + 1,
      time: formatTime(timestamp),
      timestamp,
      ticker,
      expiration: randomChoice(expirations),
      strike,
      type,
      sentiment: type === 'Call'
        ? (Math.random() > 0.3 ? 'Bullish' : 'Neutral')
        : (Math.random() > 0.3 ? 'Bearish' : 'Neutral'),
      premium: parseFloat(premium),
      size,
      totalValue: Math.round(size * parseFloat(premium) * 100),
      volume,
      openInterest,
      volOiRatio: (volume / openInterest).toFixed(2),
      orderType,
      isUnusual,
      exchange: randomChoice(['CBOE', 'ISE', 'PHLX', 'AMEX', 'BOX', 'MIAX']),
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

export function generateDarkPoolData(count = 30) {
  return Array.from({ length: count }, (_, i) => {
    const ticker = randomChoice(TICKERS);
    const base = BASE_PRICES[ticker];
    const price = (base * randomBetween(0.998, 1.002)).toFixed(2);
    const shares = Math.floor(randomBetween(5000, 500000));
    const timestamp = generateTimestamp();

    return {
      id: i + 1,
      time: formatTime(timestamp),
      timestamp,
      ticker,
      price: parseFloat(price),
      shares,
      notionalValue: Math.round(shares * parseFloat(price)),
      venue: randomChoice(['FADF', 'UBSS', 'CDED', 'JPMX', 'MSPL', 'GSCO']),
      type: shares > 100000 ? 'Block' : 'Print',
      aboveBelow: Math.random() > 0.5 ? 'Above Ask' : Math.random() > 0.5 ? 'Below Bid' : 'At Mid',
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

export function generatePutCallRatio() {
  return TICKERS.map(ticker => {
    const ratio = randomBetween(0.4, 1.8).toFixed(2);
    const totalCalls = Math.floor(randomBetween(50000, 500000));
    const totalPuts = Math.round(totalCalls * parseFloat(ratio));
    const callVolume = Math.floor(randomBetween(1000000, 10000000));
    const putVolume = Math.round(callVolume * parseFloat(ratio));

    return {
      ticker,
      ratio: parseFloat(ratio),
      totalCalls,
      totalPuts,
      callVolume,
      putVolume,
      callOI: Math.floor(randomBetween(500000, 5000000)),
      putOI: Math.floor(randomBetween(500000, 5000000)),
      sentiment: parseFloat(ratio) > 1.0 ? 'Bearish' : parseFloat(ratio) < 0.7 ? 'Bullish' : 'Neutral',
      history: Array.from({ length: 20 }, () => randomBetween(0.4, 1.8).toFixed(2)).map(Number),
    };
  });
}

export function generateSweepAlerts() {
  return generateOptionsFlow(100)
    .filter(f => f.orderType === 'Sweep' && f.totalValue > 50000)
    .slice(0, 20);
}

export function generateMarketSummary() {
  return TICKERS.map(ticker => {
    const base = BASE_PRICES[ticker];
    const change = randomBetween(-3, 3);
    return {
      ticker,
      price: (base * (1 + change / 100)).toFixed(2),
      change: change.toFixed(2),
      volume: (Math.floor(randomBetween(10, 200)) + 'M'),
      ivRank: Math.floor(randomBetween(10, 90)),
      ivPercentile: Math.floor(randomBetween(15, 95)),
    };
  });
}
