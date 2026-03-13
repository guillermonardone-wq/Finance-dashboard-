// ============================================================
// SEED SCRIPT — Populate the database with sample data
// Run: node server/seed.js
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

import { initDb, getDb, closeDb } from './db/connection.js';

function seed() {
  console.log('Initializing database...');
  initDb();
  const db = getDb();

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

  // === THESES ===
  const thesis1Id = uuidv4();
  const thesis2Id = uuidv4();

  db.prepare(`INSERT INTO theses (
    id, created_at, updated_at, title, thesis_statement, causal_chain,
    affected_assets, expected_timeline, probability_low, probability_high, probability_best,
    market_pricing_assessment, key_assumptions, alternative_explanations,
    leading_indicators, confirming_indicators, invalidating_indicators,
    disconfirming_evidence, strongest_bear_case, what_would_make_opposite_stronger,
    early_vs_right, status, classification, composite_score, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    thesis1Id, twoDaysAgo, now,
    'Strait of Hormuz Disruption Risk — Oil Spike Scenario',
    'Escalating Iran-Israel tensions combined with Houthi attacks on shipping create a plausible scenario where Strait of Hormuz traffic is materially disrupted, causing oil to spike 20-40% within days. Market is underpricing this tail risk given current implied vol on crude options.',
    JSON.stringify([
      'Iran-Israel escalation leads to direct confrontation or proxy attacks on Gulf shipping',
      'Insurance costs for tankers transiting Hormuz rise sharply, causing routing changes',
      'Effective throughput drops 15-30%, creating real supply deficit',
      'Oil spikes as physical market tightens and speculative demand surges',
      'Energy-importing nations (Japan, Korea, India, Europe) face currency pressure and inflation spike'
    ]),
    JSON.stringify([
      { asset: 'CL (WTI Crude)', direction: 'long', mechanism: 'Supply disruption → price spike' },
      { asset: 'XLE (Energy ETF)', direction: 'long', mechanism: 'Energy equities benefit from higher oil' },
      { asset: 'EWJ (Japan ETF)', direction: 'short', mechanism: 'Energy import dependence → currency/equity pressure' },
      { asset: 'USO (Oil ETF)', direction: 'long', mechanism: 'Direct oil exposure' }
    ]),
    JSON.stringify({ start: '2026-03-15', end: '2026-06-30', basis: 'Escalation cycle typically resolves or escalates within 90 days' }),
    0.15, 0.45, 0.25,
    JSON.stringify({ description: 'Crude vol curve is relatively flat. OTM calls on CL are cheap relative to the tail risk. Market is pricing ~10% disruption probability, I estimate 15-25%.', implied_prob: '0.10', gap_size: 'moderate' }),
    JSON.stringify([
      'Iran is willing to escalate beyond rhetoric',
      'US does not intervene to de-escalate before disruption',
      'Disruption lasts more than 72 hours',
      'SPR releases are insufficient to offset physical shortage'
    ]),
    JSON.stringify([
      'Tensions de-escalate through diplomatic channel',
      'Disruption is brief and market absorbs it quickly',
      'Saudi spare capacity offsets the loss'
    ]),
    JSON.stringify([
      { indicator: 'Tanker insurance rates for Hormuz transit', current_state: 'Elevated but not extreme', target_state: 'Spike >3x baseline' },
      { indicator: 'Iranian naval activity in the Gulf', current_state: 'Increased patrols', target_state: 'Live interdiction attempts' },
      { indicator: 'Crude options implied volatility', current_state: 'Moderate', target_state: 'Sharp spike in OTM calls' }
    ]),
    JSON.stringify([
      { indicator: 'Actual tanker rerouting away from Hormuz', current_state: 'Minimal', target_state: 'Significant rerouting' },
      { indicator: 'Physical crude spot premium over futures', current_state: 'Slight backwardation', target_state: 'Sharp backwardation' }
    ]),
    JSON.stringify([
      { indicator: 'Iran-Israel diplomatic breakthrough', current_state: 'No talks', target_state: 'Formal ceasefire/talks' },
      { indicator: 'US naval presence drawdown in Gulf', current_state: 'Reinforced', target_state: 'Reduced' }
    ]),
    JSON.stringify([
      'Iran has historically avoided direct disruption of Hormuz due to self-harm (they export through it too)',
      'Saudi spare capacity is reportedly 2-3mbpd, which could offset a partial disruption',
      'US SPR releases could dampen price impact in the short term'
    ]),
    'Iran has strong self-interest in keeping Hormuz open for its own exports. A full closure would hurt Iran as much as its adversaries. Historical precedent shows Iran threatens but rarely follows through on full strait closure.',
    'If Saudi Arabia credibly commits to offsetting any supply loss with spare capacity, AND the US signals willingness to release SPR at scale, the market may correctly price this as a contained event.',
    'If insurance rates spike but tankers continue transiting, that suggests market is pricing the risk but physical disruption has not materialized. Early signal: watch for actual rerouting, not just price increases.',
    'active', 'DEVELOP', 52.0,
    JSON.stringify(['energy', 'geopolitics', 'oil', 'iran', 'hormuz'])
  );

  db.prepare(`INSERT INTO theses (
    id, created_at, updated_at, title, thesis_statement, causal_chain,
    affected_assets, expected_timeline, probability_low, probability_high, probability_best,
    market_pricing_assessment, key_assumptions, alternative_explanations,
    leading_indicators, confirming_indicators, invalidating_indicators,
    disconfirming_evidence, strongest_bear_case, what_would_make_opposite_stronger,
    early_vs_right, status, classification, composite_score, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    thesis2Id, yesterday, now,
    'BoJ Policy Surprise — JPY Strengthening',
    'Bank of Japan is running out of room to maintain yield curve control. Rising domestic inflation and political pressure will force a policy shift sooner than consensus expects, leading to rapid JPY appreciation and unwinding of carry trades.',
    JSON.stringify([
      'Japanese CPI continues to run above BoJ target',
      'Political pressure mounts as weak yen hurts households',
      'BoJ signals or implements YCC band widening or abandonment',
      'JPY carry trades unwind rapidly as yield differential narrows',
      'Global risk assets face selling pressure as yen funding costs rise'
    ]),
    JSON.stringify([
      { asset: 'USD/JPY', direction: 'short', mechanism: 'JPY strengthens on policy normalization' },
      { asset: 'EWJ (Japan ETF)', direction: 'short', mechanism: 'Strong yen hurts exporters initially' },
      { asset: 'TLT (US Treasuries)', direction: 'long', mechanism: 'Carry trade unwind flows into safe havens' }
    ]),
    JSON.stringify({ start: '2026-04-01', end: '2026-07-31', basis: 'BoJ meetings in April and June are key decision points' }),
    0.20, 0.50, 0.35,
    JSON.stringify({ description: 'Market is pricing gradual normalization over 12+ months. I think the timeline could compress to 3-6 months.', implied_prob: '0.15', gap_size: 'significant' }),
    JSON.stringify([
      'BoJ leadership is willing to move faster than communicated',
      'Domestic inflation stays elevated',
      'Political pressure is sufficient to override BoJ institutional inertia'
    ]),
    JSON.stringify([
      'BoJ maintains current pace — slow and predictable',
      'Global risk-off event causes yen strengthening independent of BoJ action',
      'US rate cuts narrow the differential without BoJ action needed'
    ]),
    JSON.stringify([{ indicator: 'Japanese CPI trajectory', current_state: 'Above target', target_state: 'Above target and accelerating' }]),
    JSON.stringify([{ indicator: 'BoJ forward guidance language shift', current_state: 'Cautiously hawkish', target_state: 'Explicitly hawkish' }]),
    JSON.stringify([{ indicator: 'Japanese CPI falls below target', current_state: 'Above target', target_state: 'Below 2%' }]),
    JSON.stringify([
      'BoJ has a long history of being more dovish than expected',
      'Governor Ueda has communicated a very gradual approach',
      'Carry trade positioning may already be lighter than peak'
    ]),
    'BoJ institutional culture is extremely conservative. Ueda has repeatedly signaled patience. Forcing a rapid shift would go against decades of institutional behavior.',
    'If Japanese CPI drops below target and wage growth stalls, the entire premise collapses. Also, if the Fed cuts rates aggressively, the carry trade unwind happens via the US side, not the Japan side.',
    'Early signals: watch for BoJ meeting minutes showing dissent, or unofficial briefings suggesting accelerated timeline. If these do not appear by mid-April, I may be early.',
    'active', 'WATCH', 41.0,
    JSON.stringify(['fx', 'japan', 'boj', 'carry_trade', 'macro'])
  );

  // === SIGNALS ===
  const signalData = [
    { category: 'military_mobilization', title: 'Iranian IRGC naval exercises in Strait of Hormuz', description: 'IRGC announced 3-day naval exercise including fast-boat drills near Hormuz shipping lanes. Larger scale than typical quarterly exercises.', source_type: 'news_feed', novelty: 'developing', reliability: 'likely', signal_strength: 0.7, thesis_id: thesis1Id, status: 'linked', source_attribution: 'Reuters' },
    { category: 'shipping_disruption', title: 'Tanker insurance rates up 40% for Gulf routes', description: 'War risk premiums for tankers transiting the Strait of Hormuz have increased 40% in the past 2 weeks according to Lloyd\'s market data.', source_type: 'market_data', novelty: 'new', reliability: 'verified', signal_strength: 0.8, thesis_id: thesis1Id, status: 'linked', source_attribution: 'Lloyd\'s List' },
    { category: 'geopolitical_escalation', title: 'US repositions carrier strike group to Persian Gulf', description: 'USS Eisenhower CSG ordered to Persian Gulf from Mediterranean. Second carrier group in AOR in 6 months.', source_type: 'government', novelty: 'new', reliability: 'verified', signal_strength: 0.6, thesis_id: thesis1Id, status: 'linked', source_attribution: 'US CENTCOM press release' },
    { category: 'energy_bottleneck', title: 'Houthi anti-ship missile hits tanker near Bab el-Mandeb', description: 'Greek-flagged tanker hit by anti-ship missile in Bab el-Mandeb strait. Minor damage, crew safe. Third incident this month.', source_type: 'news_feed', novelty: 'developing', reliability: 'verified', signal_strength: 0.7, thesis_id: thesis1Id, status: 'linked', source_attribution: 'UKMTO / AP' },
    { category: 'market_complacency', title: 'Crude oil implied vol at 3-month low despite escalation', description: 'WTI 30-day implied volatility has dropped to 3-month lows even as Middle East tensions escalate. Disconnect between geopolitical risk and market pricing.', source_type: 'market_data', novelty: 'new', reliability: 'verified', signal_strength: 0.9, thesis_id: thesis1Id, status: 'linked', source_attribution: 'Bloomberg Terminal' },
    { category: 'central_bank_action', title: 'BoJ Governor Ueda signals openness to faster normalization', description: 'In Diet testimony, Ueda stated that if inflation expectations become "firmly anchored," the pace of normalization "could be adjusted." Subtly more hawkish than previous statements.', source_type: 'government', novelty: 'new', reliability: 'verified', signal_strength: 0.6, thesis_id: thesis2Id, status: 'linked', source_attribution: 'BoJ official transcript' },
    { category: 'currency_instability', title: 'Japan CPI prints 3.2% YoY vs 2.9% expected', description: 'Core CPI excluding fresh food came in above consensus. Fifth consecutive month above 3%. Political pressure on BoJ mounting.', source_type: 'market_data', novelty: 'new', reliability: 'verified', signal_strength: 0.7, thesis_id: thesis2Id, status: 'linked', source_attribution: 'Japan Statistics Bureau' },
    { category: 'policy_shock', title: 'Japan ruling party signals concern over yen weakness', description: 'Senior LDP members publicly called on BoJ to "consider the burden on households from imported inflation." Unusual direct political pressure.', source_type: 'news_feed', novelty: 'new', reliability: 'likely', signal_strength: 0.5, thesis_id: thesis2Id, status: 'linked', source_attribution: 'Nikkei' },
    { category: 'commodity_chokepoint', title: 'Yemen conflict intensifies — new drone swarm attacks on Red Sea shipping', description: 'Houthi forces deploy coordinated drone swarm attack against commercial shipping in Red Sea. More sophisticated than previous attacks.', source_type: 'news_feed', novelty: 'new', reliability: 'likely', signal_strength: 0.6, status: 'inbox', source_attribution: 'OSINT / Maritime tracking' },
    { category: 'sanctions_risk', title: 'EU discussing new sanctions package targeting Russian LNG', description: 'Draft EU sanctions package reportedly includes restrictions on Russian LNG transshipment through European ports. Could affect 15% of European LNG supply.', source_type: 'news_feed', novelty: 'new', reliability: 'unverified', signal_strength: 0.5, status: 'inbox', source_attribution: 'FT sources' },
  ];

  for (const s of signalData) {
    db.prepare(`INSERT INTO signals (
      id, created_at, updated_at, category, title, description, source_type,
      novelty, reliability, signal_strength, thesis_id, status, source_attribution, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), now, now, s.category, s.title, s.description, s.source_type,
      s.novelty, s.reliability, s.signal_strength, s.thesis_id || null,
      s.status, s.source_attribution || 'Manual entry', JSON.stringify([])
    );
  }

  // === MARKET OBSERVATIONS ===
  const obsData = [
    { type: 'price', symbol: 'CL', name: 'WTI Crude Oil', provider: 'manual', data: { price: 78.50, change: 1.20, changePercent: 1.55, volume: 450000, timestamp: now, source_attribution: 'Manual entry' } },
    { type: 'price', symbol: 'USD/JPY', name: 'Dollar-Yen', provider: 'manual', data: { price: 152.30, change: -0.45, changePercent: -0.30, volume: 0, timestamp: now, source_attribution: 'Manual entry' } },
    { type: 'macro_series', symbol: 'US_CPI', name: 'US CPI YoY', provider: 'manual', data: { value: 3.1, previousValue: 3.2, date: '2026-03-10', unit: 'percent', source_attribution: 'BLS' } },
    { type: 'macro_series', symbol: 'JP_CPI', name: 'Japan CPI YoY', provider: 'manual', data: { value: 3.2, previousValue: 2.9, date: '2026-03-08', unit: 'percent', source_attribution: 'Japan Statistics Bureau' } },
    { type: 'macro_series', symbol: 'FEDERAL_FUNDS_RATE', name: 'Fed Funds Rate', provider: 'manual', data: { value: 4.50, previousValue: 4.75, date: '2026-03-01', unit: 'percent', source_attribution: 'Federal Reserve' } },
    { type: 'news', symbol: null, name: 'Middle East Tensions', provider: 'manual', data: { title: 'Iran warns of retaliation if Israel strikes nuclear sites', url: '', source: 'Reuters', publishedAt: now, source_attribution: 'Reuters' } },
    { type: 'calendar_event', symbol: null, name: 'BoJ Meeting', provider: 'manual', data: { title: 'Bank of Japan Monetary Policy Meeting', date: '2026-04-25', impact: 'high', country: 'JP', source_attribution: 'BoJ Calendar' } },
    { type: 'calendar_event', symbol: null, name: 'FOMC Meeting', provider: 'manual', data: { title: 'FOMC Rate Decision', date: '2026-05-07', impact: 'high', country: 'US', source_attribution: 'Federal Reserve Calendar' } },
    { type: 'sentiment', symbol: 'CL', name: 'Crude Oil Sentiment', provider: 'manual', data: { sentiment: 0.35, description: 'Moderately bullish positioning but low implied vol', source_attribution: 'CFTC COT Report' } },
    { type: 'volatility', symbol: 'CL', name: 'Crude Oil Implied Vol', provider: 'manual', data: { impliedVol30d: 28.5, historicalVol30d: 32.1, ratio: 0.89, description: 'IV below realized vol — potential underpricing of risk', source_attribution: 'Options analytics' } },
  ];

  for (const obs of obsData) {
    db.prepare(`INSERT INTO market_observations (
      id, provider, source_attribution, fetched_at, observation_type, symbol, name, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), obs.provider,
      obs.data.source_attribution || `${obs.provider} - ${obs.type}`,
      now, obs.type, obs.symbol, obs.name, JSON.stringify(obs.data)
    );
  }

  console.log('Seed complete:');
  console.log(`  Theses: 2`);
  console.log(`  Signals: ${signalData.length}`);
  console.log(`  Market observations: ${obsData.length}`);

  closeDb();
}

seed();
