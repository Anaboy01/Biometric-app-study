import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";
import { euclideanDistance, cosineSimilarity } from "../utils/matchingUtils.js";
import { computeFingerprintDescriptor } from "../utils/fingerprintUtils.js";

const router = express.Router();

// Default thresholds (tunable)
const DEFAULT_FACE_THRESHOLD = 0.45;       // Euclidean distance — lower = stricter
const DEFAULT_FP_THRESHOLD = 0.70;         // Cosine similarity — higher = stricter

// Verify face
router.post("/face", authenticate, async (req, res) => {
  try {
    const { descriptor, threshold = DEFAULT_FACE_THRESHOLD } = req.body;
    if (!descriptor || descriptor.length !== 128)
      return res.status(400).json({ error: "Invalid descriptor" });

    const user = await User.findById(req.userId);
    const faceTemplate = user.templates.find((t) => t.type === "face");
    if (!faceTemplate) return res.status(400).json({ error: "No face template enrolled" });

    const distance = euclideanDistance(descriptor, faceTemplate.descriptor);
    const score = 1 - distance;                // Normalize to 0–1 (higher = more similar)
    const decision = distance <= threshold ? "accept" : "reject";

    // Log attempt
    user.matchHistory.push({ type: "face", score, threshold, decision });
    await user.save();

    res.json({ decision, score: +score.toFixed(4), distance: +distance.toFixed(4), threshold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify fingerprint
router.post("/fingerprint", authenticate, async (req, res) => {
  try {
    const { imageBase64, threshold = DEFAULT_FP_THRESHOLD } = req.body;
    const user = await User.findById(req.userId);
    const fpTemplate = user.templates.find((t) => t.type === "fingerprint");
    if (!fpTemplate) return res.status(400).json({ error: "No fingerprint template enrolled" });

    const descriptor = await computeFingerprintDescriptor(imageBase64);
    const score = cosineSimilarity(descriptor, fpTemplate.descriptor);
    const decision = score >= threshold ? "accept" : "reject";

    user.matchHistory.push({ type: "fingerprint", score, threshold, decision });
    await user.save();

    res.json({ decision, score: +score.toFixed(4), threshold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multimodal fusion (score-level)
router.post("/multimodal", authenticate, async (req, res) => {
  try {
    const { faceDescriptor, fingerprintBase64, faceWeight = 0.5, fpWeight = 0.5, threshold = 0.6 } = req.body;
    const user = await User.findById(req.userId);

    const faceTemplate = user.templates.find((t) => t.type === "face");
    const fpTemplate = user.templates.find((t) => t.type === "fingerprint");
    if (!faceTemplate || !fpTemplate)
      return res.status(400).json({ error: "Both face and fingerprint must be enrolled" });

    const faceDist = euclideanDistance(faceDescriptor, faceTemplate.descriptor);
    const faceScore = 1 - faceDist;

    const fpDescriptor = await computeFingerprintDescriptor(fingerprintBase64);
    const fpScore = cosineSimilarity(fpDescriptor, fpTemplate.descriptor);

    // Weighted score fusion
    const fusedScore = faceWeight * faceScore + fpWeight * fpScore;
    const decision = fusedScore >= threshold ? "accept" : "reject";

    user.matchHistory.push({ type: "multimodal", score: fusedScore, threshold, decision });
    await user.save();

    res.json({
      decision,
      fusedScore: +fusedScore.toFixed(4),
      faceScore: +faceScore.toFixed(4),
      fpScore: +fpScore.toFixed(4),
      threshold,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
