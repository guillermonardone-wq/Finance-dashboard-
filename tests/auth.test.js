// ============================================================
// AUTH MIDDLEWARE — Unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test apiKeyAuth by importing it after mocking config
describe("apiKeyAuth middleware", () => {
  let apiKeyAuth;
  let req, res, next;

  function makeReq(headers = {}, query = {}) {
    return { headers, query };
  }
  function makeRes() {
    const r = { statusCode: null, body: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (body) => { r.body = body; return r; };
    return r;
  }

  // Reload the auth module with a given apiKey config
  async function loadAuth(apiKey = "") {
    vi.resetModules();
    vi.doMock("../server/config.js", () => ({
      default: { apiKey },
    }));
    const mod = await import("../server/middleware/auth.js");
    return mod.apiKeyAuth;
  }

  beforeEach(() => {
    next = vi.fn();
  });

  describe("dev mode (no API_KEY)", () => {
    it("allows all requests and sets userId", async () => {
      apiKeyAuth = await loadAuth("");
      req = makeReq();
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("default");
    });

    it("does not return 401", async () => {
      apiKeyAuth = await loadAuth("");
      req = makeReq();
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(res.statusCode).toBeNull();
    });
  });

  describe("auth mode (API_KEY set)", () => {
    const SECRET = "test-secret-key-123";

    it("rejects request with no key", async () => {
      apiKeyAuth = await loadAuth(SECRET);
      req = makeReq();
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("rejects request with wrong key", async () => {
      apiKeyAuth = await loadAuth(SECRET);
      req = makeReq({ "x-api-key": "wrong-key" });
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it("accepts valid x-api-key header", async () => {
      apiKeyAuth = await loadAuth(SECRET);
      req = makeReq({ "x-api-key": SECRET });
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("default");
    });

    it("accepts valid api_key query param", async () => {
      apiKeyAuth = await loadAuth(SECRET);
      req = makeReq({}, { api_key: SECRET });
      res = makeRes();
      apiKeyAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("default");
    });
  });
});
