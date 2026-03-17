// ============================================================
// PREDICTION MARKET ROUTES — API endpoints
// ============================================================

import { Router } from "express";
import * as service from "../providers/prediction-market/service.js";

const router = Router();

// ---- PROVIDERS ----

router.get("/providers", async (req, res) => {
  res.json(await service.getProviders());
});

router.post("/providers", async (req, res) => {
  const { name, provider_key, base_url } = req.body;
  if (!name || !provider_key) {
    return res
      .status(400)
      .json({ error: "name and provider_key are required" });
  }
  const provider = await service.createProvider({ name, provider_key, base_url });
  res.status(201).json(provider);
});

// ---- EVENTS ----

router.get("/events", async (req, res) => {
  const { provider_id, category, status } = req.query;
  res.json(await service.getEvents({ provider_id, category, status }));
});

router.get("/events/:id", async (req, res) => {
  const event = await service.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

router.post("/events", async (req, res) => {
  const { provider_id, title } = req.body;
  if (!provider_id || !title) {
    return res
      .status(400)
      .json({ error: "provider_id and title are required" });
  }
  const event = await service.createEvent(req.body);
  res.status(201).json(event);
});

router.put("/events/:id", async (req, res) => {
  const event = await service.updateEvent(req.params.id, req.body);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

// ---- SNAPSHOTS ----

router.get("/events/:eventId/snapshots", async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(await service.getSnapshots(req.params.eventId, limit));
});

router.post("/events/:eventId/snapshots", async (req, res) => {
  const data = {
    ...req.body,
    prediction_market_event_id: req.params.eventId,
  };
  const snapshot = await service.createSnapshot(data);
  res.status(201).json(snapshot);
});

// ---- LINKS (thesis ↔ event) ----

router.get("/links/thesis/:thesisId", async (req, res) => {
  res.json(await service.getLinksForThesis(req.params.thesisId));
});

router.get("/links/event/:eventId", async (req, res) => {
  res.json(await service.getLinksForEvent(req.params.eventId));
});

router.post("/links", async (req, res) => {
  const { thesis_id, prediction_market_event_id } = req.body;
  if (!thesis_id || !prediction_market_event_id) {
    return res
      .status(400)
      .json({ error: "thesis_id and prediction_market_event_id are required" });
  }
  const link = await service.createLink(req.body);
  res.status(201).json(link);
});

router.put("/links/:id", async (req, res) => {
  const link = await service.updateLink(req.params.id, req.body);
  if (!link) return res.status(404).json({ error: "Link not found" });
  res.json(link);
});

router.delete("/links/:id", async (req, res) => {
  await service.deleteLink(req.params.id);
  res.json({ deleted: true });
});

// ---- ASSESSMENTS ----

router.get("/assessments/thesis/:thesisId", async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(await service.getAssessmentsForThesis(req.params.thesisId, limit));
});

router.get("/assessments/thesis/:thesisId/latest", async (req, res) => {
  const assessment = await service.getLatestAssessment(req.params.thesisId);
  res.json(assessment || null);
});

router.post("/assessments/thesis/:thesisId/compute", async (req, res) => {
  const result = await service.computeAndStoreAssessment(req.params.thesisId);
  if (!result) return res.status(404).json({ error: "Thesis not found" });
  res.json(result);
});

export default router;
