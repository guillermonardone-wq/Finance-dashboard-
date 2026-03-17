// ============================================================
// PREDICTION MARKET ROUTES — API endpoints
// ============================================================

import { Router } from "express";
import * as service from "../providers/prediction-market/service.js";

const router = Router();

// ---- PROVIDERS ----

router.get("/providers", (req, res) => {
  res.json(service.getProviders());
});

router.post("/providers", (req, res) => {
  const { name, provider_key, base_url } = req.body;
  if (!name || !provider_key) {
    return res
      .status(400)
      .json({ error: "name and provider_key are required" });
  }
  const provider = service.createProvider({ name, provider_key, base_url });
  res.status(201).json(provider);
});

// ---- EVENTS ----

router.get("/events", (req, res) => {
  const { provider_id, category, status } = req.query;
  res.json(service.getEvents({ provider_id, category, status }));
});

router.get("/events/:id", (req, res) => {
  const event = service.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

router.post("/events", (req, res) => {
  const { provider_id, title } = req.body;
  if (!provider_id || !title) {
    return res
      .status(400)
      .json({ error: "provider_id and title are required" });
  }
  const event = service.createEvent(req.body);
  res.status(201).json(event);
});

router.put("/events/:id", (req, res) => {
  const event = service.updateEvent(req.params.id, req.body);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

// ---- SNAPSHOTS ----

router.get("/events/:eventId/snapshots", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(service.getSnapshots(req.params.eventId, limit));
});

router.post("/events/:eventId/snapshots", (req, res) => {
  const data = {
    ...req.body,
    prediction_market_event_id: req.params.eventId,
  };
  const snapshot = service.createSnapshot(data);
  res.status(201).json(snapshot);
});

// ---- LINKS (thesis ↔ event) ----

router.get("/links/thesis/:thesisId", (req, res) => {
  res.json(service.getLinksForThesis(req.params.thesisId));
});

router.get("/links/event/:eventId", (req, res) => {
  res.json(service.getLinksForEvent(req.params.eventId));
});

router.post("/links", (req, res) => {
  const { thesis_id, prediction_market_event_id } = req.body;
  if (!thesis_id || !prediction_market_event_id) {
    return res
      .status(400)
      .json({ error: "thesis_id and prediction_market_event_id are required" });
  }
  const link = service.createLink(req.body);
  res.status(201).json(link);
});

router.put("/links/:id", (req, res) => {
  const link = service.updateLink(req.params.id, req.body);
  if (!link) return res.status(404).json({ error: "Link not found" });
  res.json(link);
});

router.delete("/links/:id", (req, res) => {
  service.deleteLink(req.params.id);
  res.json({ deleted: true });
});

// ---- ASSESSMENTS ----

router.get("/assessments/thesis/:thesisId", (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(service.getAssessmentsForThesis(req.params.thesisId, limit));
});

router.get("/assessments/thesis/:thesisId/latest", (req, res) => {
  const assessment = service.getLatestAssessment(req.params.thesisId);
  res.json(assessment || null);
});

router.post("/assessments/thesis/:thesisId/compute", (req, res) => {
  const result = service.computeAndStoreAssessment(req.params.thesisId);
  if (!result) return res.status(404).json({ error: "Thesis not found" });
  res.json(result);
});

export default router;
