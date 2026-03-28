// ============================================================
// ACLED PROVIDER — Armed Conflict Location & Event Data
// ============================================================
// Fetches weekly conflict events from ACLED's public API.
// Normalizes geocoded events into the standard signal schema.
//
// ACLED API: https://acleddata.com/resources/general/
// Free tier: registration required, key via ACLED_API_KEY + ACLED_EMAIL
// ============================================================

import config from "../config.js";

const ACLED_BASE_URL = "https://api.acleddata.com/acled/read";

// Event types we care about (ACLED taxonomy)
const TRACKED_EVENT_TYPES = [
  "Battles",
  "Explosions/Remote violence",
  "Violence against civilians",
  "Strategic developments",
  "Riots",
  "Protests",
];

// Regions of interest for geopolitical thesis relevance
const TRACKED_REGIONS = [
  "Middle East",
  "Eastern Europe",
  "Eastern Asia",
  "South-Eastern Asia",
  "Northern Africa",
  "Western Asia",
  "Central Asia",
  "Southern Asia",
];

/**
 * Fetch recent ACLED conflict events.
 *
 * @param {object} [options]
 * @param {number} [options.days=7] - how many days back to fetch
 * @param {number} [options.limit=200] - max rows
 * @returns {Promise<{ success: boolean, data: object[], error?: string }>}
 */
export async function fetchAcledEvents({ days = 7, limit = 200 } = {}) {
  const apiKey = config.providers.acledApiKey;
  const email = config.providers.acledEmail;

  if (!apiKey || !email) {
    return { success: false, data: [], error: "ACLED credentials not configured (ACLED_API_KEY, ACLED_EMAIL)" };
  }

  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateStr = fromDate.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    key: apiKey,
    email,
    event_date: dateStr,
    event_date_where: ">=",
    limit: String(limit),
    // Fields we need
    fields: "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|country|region|latitude|longitude|fatalities|notes|source",
  });

  try {
    const res = await fetch(`${ACLED_BASE_URL}?${params}`);
    if (!res.ok) {
      return { success: false, data: [], error: `ACLED API error: ${res.status} ${res.statusText}` };
    }

    const json = await res.json();
    const rawData = json.data || [];

    // Validate and clean each row
    const cleaned = [];
    for (const row of rawData) {
      const event = parseAcledRow(row);
      if (event) cleaned.push(event);
    }

    return { success: true, data: cleaned };
  } catch (err) {
    return { success: false, data: [], error: `ACLED fetch failed: ${err.message}` };
  }
}

/**
 * Parse and validate a single ACLED data row.
 * Returns null for malformed/incomplete rows (safe skip).
 */
export function parseAcledRow(row) {
  if (!row) return null;

  // Required fields
  const eventId = row.event_id_cnty || row.event_id || null;
  const eventDate = row.event_date || null;
  const eventType = row.event_type || null;
  const country = row.country || null;

  // Skip if critical fields are missing
  if (!eventId || !eventDate || !eventType || !country) {
    return null;
  }

  // Parse fatalities safely
  let fatalities = 0;
  if (row.fatalities != null) {
    const parsed = Number(row.fatalities);
    fatalities = isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  // Parse coordinates safely
  let latitude = null;
  let longitude = null;
  if (row.latitude != null && row.longitude != null) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      latitude = lat;
      longitude = lon;
    }
  }

  return {
    event_id: String(eventId),
    event_date: eventDate,
    event_type: eventType,
    sub_event_type: row.sub_event_type || null,
    actor1: row.actor1 || null,
    actor2: row.actor2 || null,
    country,
    region: row.region || null,
    latitude,
    longitude,
    fatalities,
    notes: row.notes || null,
    source: row.source || null,
  };
}

/**
 * Aggregate events by country to detect intensity spikes.
 * Returns per-country aggregates for the given events.
 *
 * @param {object[]} events - parsed ACLED events
 * @returns {Map<string, { country: string, region: string|null, totalEvents: number, totalFatalities: number, eventTypes: Set<string>, topActors: string[], latestDate: string }>}
 */
export function aggregateByCountry(events) {
  const agg = new Map();

  for (const e of events) {
    if (!agg.has(e.country)) {
      agg.set(e.country, {
        country: e.country,
        region: e.region,
        totalEvents: 0,
        totalFatalities: 0,
        eventTypes: new Set(),
        actors: new Map(),
        latestDate: e.event_date,
      });
    }

    const entry = agg.get(e.country);
    entry.totalEvents++;
    entry.totalFatalities += e.fatalities;
    entry.eventTypes.add(e.event_type);

    // Track actors
    if (e.actor1) {
      entry.actors.set(e.actor1, (entry.actors.get(e.actor1) || 0) + 1);
    }

    // Track most recent date
    if (e.event_date > entry.latestDate) {
      entry.latestDate = e.event_date;
    }
  }

  // Resolve top actors
  for (const [, entry] of agg) {
    entry.topActors = [...entry.actors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([actor]) => actor);
    entry.eventTypes = [...entry.eventTypes];
    delete entry.actors;
  }

  return agg;
}

/**
 * Determine which countries have conflict intensity worth signaling.
 *
 * @param {Map} countryAggs - output of aggregateByCountry
 * @param {object} [options]
 * @param {number} [options.minEvents=5] - minimum events to trigger signal
 * @param {number} [options.minFatalities=10] - OR: fatalities threshold
 * @returns {object[]} signal-worthy country aggregates
 */
export function detectIntensitySpikes(countryAggs, { minEvents = 5, minFatalities = 10 } = {}) {
  const results = [];

  for (const [, agg] of countryAggs) {
    // Only signal tracked regions OR high-intensity anywhere
    const isTrackedRegion = TRACKED_REGIONS.some((r) =>
      (agg.region || "").toLowerCase().includes(r.toLowerCase()),
    );
    const highIntensity = agg.totalEvents >= minEvents * 2 || agg.totalFatalities >= minFatalities * 2;

    if (!isTrackedRegion && !highIntensity) continue;

    if (agg.totalEvents >= minEvents || agg.totalFatalities >= minFatalities) {
      results.push(agg);
    }
  }

  return results;
}

// Export constants for testing
export { TRACKED_EVENT_TYPES, TRACKED_REGIONS };
