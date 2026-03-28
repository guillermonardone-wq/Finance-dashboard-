// Importable seed function — used by both `node server/seed.js` and auto-seed on startup
import { v4 as uuidv4 } from "uuid";
import { getKnex } from "./db/connection.js";

/**
 * Safely serialize a value for PostgreSQL jsonb columns.
 * Knex sometimes passes JS objects/arrays without JSON.stringify,
 * causing "invalid input syntax for type json" errors.
 */
function jsonb(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value; // already serialized
  return JSON.stringify(value);
}

export async function seed() {
  const knex = getKnex();

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

  // === THESES ===
  const thesis1Id = uuidv4();
  const thesis2Id = uuidv4();

  await knex("theses").insert({
    id: thesis1Id,
    user_id: "default",
    created_at: twoDaysAgo,
    updated_at: now,
    title: "Strait of Hormuz Disruption Risk — Oil Spike Scenario",
    thesis_statement: "Escalating Iran-Israel tensions combined with Houthi attacks on shipping create a plausible scenario where Strait of Hormuz traffic is materially disrupted, causing oil to spike 20-40% within days. Market is underpricing this tail risk given current implied vol on crude options.",
    causal_chain: jsonb([
      "Iran-Israel escalation leads to direct confrontation or proxy attacks on Gulf shipping",
      "Insurance costs for tankers transiting Hormuz rise sharply, causing routing changes",
      "Effective throughput drops 15-30%, creating real supply deficit",
      "Oil spikes as physical market tightens and speculative demand surges",
      "Energy-importing nations (Japan, Korea, India, Europe) face currency pressure and inflation spike",
    ]),
    affected_assets: jsonb([
      { asset: "CL (WTI Crude)", direction: "long", mechanism: "Supply disruption → price spike" },
      { asset: "XLE (Energy ETF)", direction: "long", mechanism: "Energy equities benefit from higher oil" },
      { asset: "EWJ (Japan ETF)", direction: "short", mechanism: "Energy import dependence → currency/equity pressure" },
      { asset: "USO (Oil ETF)", direction: "long", mechanism: "Direct oil exposure" },
    ]),
    expected_timeline: jsonb({ start: "2026-03-15", end: "2026-06-30", basis: "Escalation cycle typically resolves or escalates within 90 days" }),
    probability_low: 0.15,
    probability_high: 0.45,
    probability_best: 0.25,
    market_pricing_assessment: jsonb({ description: "Crude vol curve is relatively flat. OTM calls on CL are cheap relative to the tail risk. Market is pricing ~10% disruption probability, I estimate 15-25%.", implied_prob: "0.10", gap_size: "moderate" }),
    key_assumptions: jsonb(["Iran is willing to escalate beyond rhetoric", "US does not intervene to de-escalate before disruption", "Disruption lasts more than 72 hours", "SPR releases are insufficient to offset physical shortage"]),
    alternative_explanations: jsonb(["Tensions de-escalate through diplomatic channel", "Disruption is brief and market absorbs it quickly", "Saudi spare capacity offsets the loss"]),
    leading_indicators: jsonb([
      { indicator: "Tanker insurance rates for Hormuz transit", current_state: "Elevated but not extreme", target_state: "Spike >3x baseline" },
      { indicator: "Iranian naval activity in the Gulf", current_state: "Increased patrols", target_state: "Live interdiction attempts" },
      { indicator: "Crude options implied volatility", current_state: "Moderate", target_state: "Sharp spike in OTM calls" },
    ]),
    confirming_indicators: jsonb([
      { indicator: "Actual tanker rerouting away from Hormuz", current_state: "Minimal", target_state: "Significant rerouting" },
      { indicator: "Physical crude spot premium over futures", current_state: "Slight backwardation", target_state: "Sharp backwardation" },
    ]),
    invalidating_indicators: jsonb([
      { indicator: "Iran-Israel diplomatic breakthrough", current_state: "No talks", target_state: "Formal ceasefire/talks" },
      { indicator: "US naval presence drawdown in Gulf", current_state: "Reinforced", target_state: "Reduced" },
    ]),
    disconfirming_evidence: jsonb([
      "Iran has historically avoided direct disruption of Hormuz due to self-harm (they export through it too)",
      "Saudi spare capacity is reportedly 2-3mbpd, which could offset a partial disruption",
      "US SPR releases could dampen price impact in the short term",
    ]),
    strongest_bear_case: "Iran has strong self-interest in keeping Hormuz open for its own exports. A full closure would hurt Iran as much as its adversaries. Historical precedent shows Iran threatens but rarely follows through on full strait closure.",
    what_would_make_opposite_stronger: "If Saudi Arabia credibly commits to offsetting any supply loss with spare capacity, AND the US signals willingness to release SPR at scale, the market may correctly price this as a contained event.",
    early_vs_right: "If insurance rates spike but tankers continue transiting, that suggests market is pricing the risk but physical disruption has not materialized. Early signal: watch for actual rerouting, not just price increases.",
    status: "active",
    classification: "DEVELOP",
    composite_score: 52.0,
    tags: jsonb(["energy", "geopolitics", "oil", "iran", "hormuz"]),
  });

  await knex("theses").insert({
    id: thesis2Id,
    user_id: "default",
    created_at: yesterday,
    updated_at: now,
    title: "BoJ Policy Surprise — JPY Strengthening",
    thesis_statement: "Bank of Japan is running out of room to maintain yield curve control. Rising domestic inflation and political pressure will force a policy shift sooner than consensus expects, leading to rapid JPY appreciation and unwinding of carry trades.",
    causal_chain: jsonb([
      "Japanese CPI continues to run above BoJ target",
      "Political pressure mounts as weak yen hurts households",
      "BoJ signals or implements YCC band widening or abandonment",
      "JPY carry trades unwind rapidly as yield differential narrows",
      "Global risk assets face selling pressure as yen funding costs rise",
    ]),
    affected_assets: jsonb([
      { asset: "USD/JPY", direction: "short", mechanism: "JPY strengthens on policy normalization" },
      { asset: "EWJ (Japan ETF)", direction: "short", mechanism: "Strong yen hurts exporters initially" },
      { asset: "TLT (US Treasuries)", direction: "long", mechanism: "Carry trade unwind flows into safe havens" },
    ]),
    expected_timeline: jsonb({ start: "2026-04-01", end: "2026-07-31", basis: "BoJ meetings in April and June are key decision points" }),
    probability_low: 0.2,
    probability_high: 0.5,
    probability_best: 0.35,
    market_pricing_assessment: jsonb({ description: "Market is pricing gradual normalization over 12+ months. I think the timeline could compress to 3-6 months.", implied_prob: "0.15", gap_size: "significant" }),
    key_assumptions: jsonb(["BoJ leadership is willing to move faster than communicated", "Domestic inflation stays elevated", "Political pressure is sufficient to override BoJ institutional inertia"]),
    alternative_explanations: jsonb(["BoJ maintains current pace — slow and predictable", "Global risk-off event causes yen strengthening independent of BoJ action", "US rate cuts narrow the differential without BoJ action needed"]),
    leading_indicators: jsonb([{ indicator: "Japanese CPI trajectory", current_state: "Above target", target_state: "Above target and accelerating" }]),
    confirming_indicators: jsonb([{ indicator: "BoJ forward guidance language shift", current_state: "Cautiously hawkish", target_state: "Explicitly hawkish" }]),
    invalidating_indicators: jsonb([{ indicator: "Japanese CPI falls below target", current_state: "Above target", target_state: "Below 2%" }]),
    disconfirming_evidence: jsonb(["BoJ has a long history of being more dovish than expected", "Governor Ueda has communicated a very gradual approach", "Carry trade positioning may already be lighter than peak"]),
    strongest_bear_case: "BoJ institutional culture is extremely conservative. Ueda has repeatedly signaled patience. Forcing a rapid shift would go against decades of institutional behavior.",
    what_would_make_opposite_stronger: "If Japanese CPI drops below target and wage growth stalls, the entire premise collapses. Also, if the Fed cuts rates aggressively, the carry trade unwind happens via the US side, not the Japan side.",
    early_vs_right: "Early signals: watch for BoJ meeting minutes showing dissent, or unofficial briefings suggesting accelerated timeline. If these do not appear by mid-April, I may be early.",
    status: "active",
    classification: "WATCH",
    composite_score: 41.0,
    tags: jsonb(["fx", "japan", "boj", "carry_trade", "macro"]),
  });

  // === SIGNALS ===
  const signalData = [
    { category: "military_mobilization", title: "Iranian IRGC naval exercises in Strait of Hormuz", description: "IRGC announced 3-day naval exercise including fast-boat drills near Hormuz shipping lanes. Larger scale than typical quarterly exercises.", source_type: "news_feed", novelty: "developing", reliability: "likely", signal_strength: 0.7, thesis_id: thesis1Id, status: "linked", source_attribution: "Reuters" },
    { category: "shipping_disruption", title: "Tanker insurance rates up 40% for Gulf routes", description: "War risk premiums for tankers transiting the Strait of Hormuz have increased 40% in the past 2 weeks according to Lloyd's market data.", source_type: "market_data", novelty: "new", reliability: "verified", signal_strength: 0.8, thesis_id: thesis1Id, status: "linked", source_attribution: "Lloyd's List" },
    { category: "geopolitical_escalation", title: "US repositions carrier strike group to Persian Gulf", description: "USS Eisenhower CSG ordered to Persian Gulf from Mediterranean. Second carrier group in AOR in 6 months.", source_type: "government", novelty: "new", reliability: "verified", signal_strength: 0.6, thesis_id: thesis1Id, status: "linked", source_attribution: "US CENTCOM press release" },
    { category: "energy_bottleneck", title: "Houthi anti-ship missile hits tanker near Bab el-Mandeb", description: "Greek-flagged tanker hit by anti-ship missile in Bab el-Mandeb strait. Minor damage, crew safe. Third incident this month.", source_type: "news_feed", novelty: "developing", reliability: "verified", signal_strength: 0.7, thesis_id: thesis1Id, status: "linked", source_attribution: "UKMTO / AP" },
    { category: "market_complacency", title: "Crude oil implied vol at 3-month low despite escalation", description: "WTI 30-day implied volatility has dropped to 3-month lows even as Middle East tensions escalate. Disconnect between geopolitical risk and market pricing.", source_type: "market_data", novelty: "new", reliability: "verified", signal_strength: 0.9, thesis_id: thesis1Id, status: "linked", source_attribution: "Bloomberg Terminal" },
    { category: "central_bank_action", title: "BoJ Governor Ueda signals openness to faster normalization", description: 'In Diet testimony, Ueda stated that if inflation expectations become "firmly anchored," the pace of normalization "could be adjusted." Subtly more hawkish than previous statements.', source_type: "government", novelty: "new", reliability: "verified", signal_strength: 0.6, thesis_id: thesis2Id, status: "linked", source_attribution: "BoJ official transcript" },
    { category: "currency_instability", title: "Japan CPI prints 3.2% YoY vs 2.9% expected", description: "Core CPI excluding fresh food came in above consensus. Fifth consecutive month above 3%. Political pressure on BoJ mounting.", source_type: "market_data", novelty: "new", reliability: "verified", signal_strength: 0.7, thesis_id: thesis2Id, status: "linked", source_attribution: "Japan Statistics Bureau" },
    { category: "policy_shock", title: "Japan ruling party signals concern over yen weakness", description: 'Senior LDP members publicly called on BoJ to "consider the burden on households from imported inflation." Unusual direct political pressure.', source_type: "news_feed", novelty: "new", reliability: "likely", signal_strength: 0.5, thesis_id: thesis2Id, status: "linked", source_attribution: "Nikkei" },
    { category: "commodity_chokepoint", title: "Yemen conflict intensifies — new drone swarm attacks on Red Sea shipping", description: "Houthi forces deploy coordinated drone swarm attack against commercial shipping in Red Sea. More sophisticated than previous attacks.", source_type: "news_feed", novelty: "new", reliability: "likely", signal_strength: 0.6, status: "inbox", source_attribution: "OSINT / Maritime tracking" },
    { category: "sanctions_risk", title: "EU discussing new sanctions package targeting Russian LNG", description: "Draft EU sanctions package reportedly includes restrictions on Russian LNG transshipment through European ports. Could affect 15% of European LNG supply.", source_type: "news_feed", novelty: "new", reliability: "unverified", signal_strength: 0.5, status: "inbox", source_attribution: "FT sources" },
  ];

  for (const s of signalData) {
    await knex("signals").insert({
      id: uuidv4(),
      user_id: "default",
      created_at: now,
      updated_at: now,
      category: s.category,
      title: s.title,
      description: s.description,
      source_type: s.source_type,
      novelty: s.novelty,
      reliability: s.reliability,
      signal_strength: s.signal_strength,
      thesis_id: s.thesis_id || null,
      status: s.status,
      source_attribution: s.source_attribution || "Manual entry",
      tags: jsonb([]),
      related_signal_ids: jsonb([]),
    });
  }

  // === MARKET OBSERVATIONS ===
  const obsData = [
    { type: "price", symbol: "CL", name: "WTI Crude Oil", provider: "manual", data: { price: 78.5, change: 1.2, changePercent: 1.55, volume: 450000, timestamp: now, source_attribution: "Manual entry" } },
    { type: "price", symbol: "USD/JPY", name: "Dollar-Yen", provider: "manual", data: { price: 152.3, change: -0.45, changePercent: -0.3, volume: 0, timestamp: now, source_attribution: "Manual entry" } },
    { type: "macro_series", symbol: "US_CPI", name: "US CPI YoY", provider: "manual", data: { value: 3.1, previousValue: 3.2, date: "2026-03-10", unit: "percent", source_attribution: "BLS" } },
    { type: "macro_series", symbol: "JP_CPI", name: "Japan CPI YoY", provider: "manual", data: { value: 3.2, previousValue: 2.9, date: "2026-03-08", unit: "percent", source_attribution: "Japan Statistics Bureau" } },
    { type: "macro_series", symbol: "FEDERAL_FUNDS_RATE", name: "Fed Funds Rate", provider: "manual", data: { value: 4.5, previousValue: 4.75, date: "2026-03-01", unit: "percent", source_attribution: "Federal Reserve" } },
    { type: "news", symbol: null, name: "Middle East Tensions", provider: "manual", data: { title: "Iran warns of retaliation if Israel strikes nuclear sites", url: "", source: "Reuters", publishedAt: now, source_attribution: "Reuters" } },
    { type: "calendar_event", symbol: null, name: "BoJ Meeting", provider: "manual", data: { title: "Bank of Japan Monetary Policy Meeting", date: "2026-04-25", impact: "high", country: "JP", source_attribution: "BoJ Calendar" } },
    { type: "calendar_event", symbol: null, name: "FOMC Meeting", provider: "manual", data: { title: "FOMC Rate Decision", date: "2026-05-07", impact: "high", country: "US", source_attribution: "Federal Reserve Calendar" } },
    { type: "sentiment", symbol: "CL", name: "Crude Oil Sentiment", provider: "manual", data: { sentiment: 0.35, description: "Moderately bullish positioning but low implied vol", source_attribution: "CFTC COT Report" } },
    { type: "volatility", symbol: "CL", name: "Crude Oil Implied Vol", provider: "manual", data: { impliedVol30d: 28.5, historicalVol30d: 32.1, ratio: 0.89, description: "IV below realized vol — potential underpricing of risk", source_attribution: "Options analytics" } },
  ];

  for (const obs of obsData) {
    await knex("market_observations").insert({
      id: uuidv4(),
      provider: obs.provider,
      source_attribution: obs.data.source_attribution || `${obs.provider} - ${obs.type}`,
      fetched_at: now,
      observation_type: obs.type,
      symbol: obs.symbol,
      name: obs.name,
      data: jsonb(obs.data),
    });
  }

  // === PREDICTION MARKET DATA ===
  const polymarketProviderId = uuidv4();
  await knex("prediction_market_providers").insert({
    id: polymarketProviderId,
    name: "Polymarket",
    provider_key: "polymarket",
    base_url: "https://polymarket.com",
    active: true,
    created_at: now,
    updated_at: now,
  });

  const pmEvent1Id = uuidv4();
  const pmEvent2Id = uuidv4();
  const pmEvent3Id = uuidv4();

  const pmEvents = [
    { id: pmEvent1Id, external_market_id: "pm-hormuz-closure-2026", title: "Will Iran close the Strait of Hormuz by June 30, 2026?", description: "This market resolves YES if the Strait of Hormuz is closed to commercial shipping for 24+ consecutive hours due to Iranian military action before June 30, 2026.", url: "https://polymarket.com/event/hormuz-closure-2026", category: "geopolitics", open_time: "2026-01-15T00:00:00Z", close_time: "2026-06-30T23:59:59Z", tags_json: jsonb(["iran", "hormuz", "oil", "geopolitics"]) },
    { id: pmEvent2Id, external_market_id: "pm-oil-above-100-q2", title: "Will WTI Crude Oil trade above $100/barrel in Q2 2026?", description: "This market resolves YES if WTI Crude Oil (front-month futures) trades at or above $100.00 per barrel at any point between April 1 and June 30, 2026.", url: "https://polymarket.com/event/oil-100-q2-2026", category: "energy", open_time: "2026-02-01T00:00:00Z", close_time: "2026-06-30T23:59:59Z", tags_json: jsonb(["oil", "energy", "commodities"]) },
    { id: pmEvent3Id, external_market_id: "pm-boj-rate-hike-apr", title: "Will the Bank of Japan raise rates at the April 2026 meeting?", description: "This market resolves YES if the Bank of Japan announces an interest rate increase at or following its April 24-25, 2026 monetary policy meeting.", url: "https://polymarket.com/event/boj-rate-hike-april-2026", category: "macro", open_time: "2026-02-15T00:00:00Z", close_time: "2026-04-25T23:59:59Z", tags_json: jsonb(["japan", "boj", "rates", "macro"]) },
  ];

  for (const e of pmEvents) {
    await knex("prediction_market_events").insert({
      ...e,
      provider_id: polymarketProviderId,
      status: "open",
      market_type: "binary",
      created_at: now,
      updated_at: now,
    });
  }

  const snapshotData = [
    { eventId: pmEvent1Id, daysAgo: 7, prob: 0.08, vol: 45000, liq: 120000, spread: 0.02 },
    { eventId: pmEvent1Id, daysAgo: 5, prob: 0.10, vol: 62000, liq: 135000, spread: 0.02 },
    { eventId: pmEvent1Id, daysAgo: 3, prob: 0.14, vol: 89000, liq: 142000, spread: 0.03 },
    { eventId: pmEvent1Id, daysAgo: 1, prob: 0.16, vol: 125000, liq: 155000, spread: 0.02 },
    { eventId: pmEvent1Id, daysAgo: 0, prob: 0.18, vol: 142000, liq: 160000, spread: 0.02 },
    { eventId: pmEvent2Id, daysAgo: 5, prob: 0.22, vol: 210000, liq: 380000, spread: 0.01 },
    { eventId: pmEvent2Id, daysAgo: 2, prob: 0.25, vol: 245000, liq: 395000, spread: 0.01 },
    { eventId: pmEvent2Id, daysAgo: 0, prob: 0.28, vol: 280000, liq: 410000, spread: 0.01 },
    { eventId: pmEvent3Id, daysAgo: 5, prob: 0.30, vol: 180000, liq: 290000, spread: 0.02 },
    { eventId: pmEvent3Id, daysAgo: 2, prob: 0.35, vol: 220000, liq: 310000, spread: 0.02 },
    { eventId: pmEvent3Id, daysAgo: 0, prob: 0.38, vol: 260000, liq: 330000, spread: 0.01 },
  ];

  for (const s of snapshotData) {
    const observedAt = new Date(Date.now() - s.daysAgo * 86400000).toISOString();
    await knex("prediction_market_snapshots").insert({
      id: uuidv4(),
      prediction_market_event_id: s.eventId,
      observed_at: observedAt,
      yes_price: s.prob,
      no_price: 1 - s.prob,
      implied_probability: s.prob,
      volume_24h: s.vol,
      liquidity: s.liq,
      spread: s.spread,
      source_attribution: "Polymarket - market snapshot",
      is_stale: false,
      created_at: now,
    });
  }

  const linkData = [
    { thesis_id: thesis1Id, event_id: pmEvent1Id, confidence: 0.65, type: "partial_match", wordingScore: 0.55, mismatch: true, rationale: "Contract asks about full closure for 24h. Thesis is about material disruption which is broader — includes insurance-driven rerouting and partial blockage. Wording mismatch: thesis covers scenarios the contract does not." },
    { thesis_id: thesis1Id, event_id: pmEvent2Id, confidence: 0.70, type: "proxy", wordingScore: 0.4, mismatch: true, rationale: "Oil above $100 is a downstream consequence of thesis, not the thesis itself. Useful as a proxy for whether the market is pricing energy disruption risk, but not a direct validation." },
    { thesis_id: thesis2Id, event_id: pmEvent3Id, confidence: 0.80, type: "partial_match", wordingScore: 0.7, mismatch: false, rationale: "Contract asks specifically about the April meeting. Thesis covers broader timeline but April is a key catalyst. Good partial match — result would be strongly confirmatory or disconfirmatory for the thesis." },
  ];

  for (const l of linkData) {
    await knex("thesis_prediction_links").insert({
      id: uuidv4(),
      thesis_id: l.thesis_id,
      prediction_market_event_id: l.event_id,
      link_confidence: l.confidence,
      link_type: l.type,
      wording_match_score: l.wordingScore,
      wording_mismatch_flag: l.mismatch,
      rationale: l.rationale,
      created_at: now,
      updated_at: now,
    });
  }

  console.log("[Seed] Complete:");
  console.log(`  Theses: 2`);
  console.log(`  Signals: ${signalData.length}`);
  console.log(`  Market observations: ${obsData.length}`);
  console.log(`  Prediction market providers: 1`);
  console.log(`  Prediction market events: 3`);
  console.log(`  Prediction market snapshots: ${snapshotData.length}`);
  console.log(`  Thesis-prediction links: 3`);
}
