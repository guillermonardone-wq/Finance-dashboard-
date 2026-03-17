// ============================================================
// API KEY AUTH MIDDLEWARE
// ============================================================
// - If config.apiKey is empty → dev mode → allow all requests
// - If config.apiKey is set → require x-api-key header or api_key query param
// - Sets req.userId = 'default' (single-user)
// ============================================================

import config from "../config.js";

export function apiKeyAuth(req, res, next) {
  // Dev mode: no API key configured → skip auth
  if (!config.apiKey) {
    req.userId = "default";
    return next();
  }

  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key || key !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.userId = "default";
  next();
}
