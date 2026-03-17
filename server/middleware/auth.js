/**
 * API Key Authentication Middleware
 * Session 1b: Wire this into server/index.js on /api routes
 *
 * Checks x-api-key header against process.env.API_KEY
 * Sets req.userId = 'default' (single user for now)
 * Skip auth in dev if no API_KEY set
 */
export function apiKeyAuth(req, res, next) {
  if (!process.env.API_KEY) {
    req.userId = "default";
    return next();
  }
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = "default";
  next();
}
