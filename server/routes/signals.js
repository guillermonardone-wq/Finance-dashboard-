import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import * as signalRepo from "../db/signal-repo.js";

const router = Router();

// GET all signals
router.get("/", async (req, res) => {
  const { status, category, thesis_id } = req.query;
  const rows = await signalRepo.findAll({ status, category, thesis_id });
  res.json(rows);
});

// GET signal counts by status
router.get("/counts", async (req, res) => {
  res.json(await signalRepo.countsByStatus());
});

// GET single signal
router.get("/:id", async (req, res) => {
  const signal = await signalRepo.findById(req.params.id);
  if (!signal) return res.status(404).json({ error: "Signal not found" });
  res.json(signal);
});

// POST create signal
router.post("/", async (req, res) => {
  const s = req.body;

  if (!s || !s.title || !s.title.trim()) {
    return res.status(400).json({ error: "Signal title is required." });
  }
  if (!s.description || !s.description.trim()) {
    return res.status(400).json({ error: "Signal description is required." });
  }
  if (!s.category || !s.category.trim()) {
    return res.status(400).json({ error: "Signal category is required." });
  }

  try {
    const id = uuidv4();
    const created = await signalRepo.create(id, s);
    if (!created) {
      console.error(
        `[Signals] POST / — INSERT succeeded but SELECT returned null for id=${id}`,
      );
      return res
        .status(500)
        .json({
          error: "Signal was not saved — database write failed silently.",
        });
    }
    res.status(201).json(created);
  } catch (err) {
    console.error(`[Signals] POST / — DB INSERT FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// PUT update signal
router.put("/:id", async (req, res) => {
  try {
    const updated = await signalRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Signal not found" });
    res.json(updated);
  } catch (err) {
    console.error(
      `[Signals] PUT /${req.params.id} — DB UPDATE FAILED: ${err.message}`,
    );
    return res.status(500).json({ error: err.message });
  }
});

// DELETE signal
router.delete("/:id", async (req, res) => {
  await signalRepo.remove(req.params.id);
  res.json({ deleted: true });
});

export default router;
