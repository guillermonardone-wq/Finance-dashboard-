import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import * as thesisRepo from "../db/thesis-repo.js";

const router = Router();

// GET all theses (with optional filters)
router.get("/", (req, res) => {
  const { status, classification } = req.query;
  const rows = thesisRepo.findAll({ status, classification });
  console.log(
    `[Theses] GET / — filters: status=${status || "all"}, returned ${rows.length} theses`,
  );
  res.json(rows);
});

// GET single thesis
router.get("/:id", (req, res) => {
  const thesis = thesisRepo.findById(req.params.id);
  if (!thesis) {
    console.log(`[Theses] GET /${req.params.id} — NOT FOUND`);
    return res.status(404).json({ error: "Thesis not found" });
  }
  console.log(`[Theses] GET /${req.params.id} — found: "${thesis.title}"`);
  res.json(thesis);
});

// POST create thesis
router.post("/", (req, res) => {
  const id = uuidv4();
  const t = req.body;

  console.log(`[Theses] POST / — title="${t?.title}", status="${t?.status}"`);

  if (!t || !t.title || !t.thesis_statement) {
    console.log(
      "[Theses] POST / — REJECTED: missing title or thesis_statement",
    );
    return res
      .status(400)
      .json({ error: "Title and thesis statement are required." });
  }

  // Draft theses skip behavioral gates — rigor is enforced at classification upgrade
  const isDraft = (t.status || "draft") === "draft";

  if (!isDraft) {
    if (
      !t.disconfirming_evidence ||
      !t.strongest_bear_case ||
      !t.what_would_make_opposite_stronger
    ) {
      return res.status(400).json({
        error:
          "BEHAVIORAL GATE: You must provide disconfirming evidence, the strongest bear case, and what would make the opposite case stronger. No shortcuts.",
      });
    }
    if (t.probability_best <= 0 || t.probability_best >= 1) {
      return res.status(400).json({
        error:
          "BEHAVIORAL GATE: Probability must be between 0 and 1 exclusive. Certainty language is not allowed.",
      });
    }
  }

  try {
    const created = thesisRepo.create(id, t);
    if (!created) {
      console.error(
        `[Theses] POST / — INSERT succeeded but SELECT returned null for id=${id}`,
      );
      return res
        .status(500)
        .json({
          error: "Thesis was not saved — database write failed silently.",
        });
    }
    console.log(`[Theses] POST / — CREATED id=${id}`);
    res.status(201).json(created);
  } catch (err) {
    console.error(`[Theses] POST / — DB INSERT FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// PUT update thesis
router.put("/:id", (req, res) => {
  try {
    const updated = thesisRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Thesis not found" });
    res.json(updated);
  } catch (err) {
    console.error(
      `[Theses] PUT /${req.params.id} — DB UPDATE FAILED: ${err.message}`,
    );
    return res.status(500).json({ error: err.message });
  }
});

// DELETE thesis
router.delete("/:id", (req, res) => {
  thesisRepo.remove(req.params.id);
  res.json({ deleted: true });
});

export default router;
