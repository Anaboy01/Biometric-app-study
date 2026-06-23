import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// Calculate FAR, FRR, EER from match history
router.get("/error-rates", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const history = user.matchHistory;

    if (history.length === 0)
      return res.json({ message: "No match history yet", FAR: 0, FRR: 0, EER: 0 });

    // Simulate genuine/impostor splits for demo:
    // In a real system, you'd have labeled attempts
    // Here we split by score > 0.6 = genuine attempt simulation
    const totalAttempts = history.length;
    const accepted = history.filter((h) => h.decision === "accept").length;
    const rejected = history.filter((h) => h.decision === "reject").length;

    // FAR = false accepts / total reject-worthy = accepted below threshold (simulated)
    // FRR = false rejects / total genuine attempts
    // For demo, compute across threshold sweep
    const thresholds = Array.from({ length: 19 }, (_, i) => +(0.1 + i * 0.05).toFixed(2));
    const roc = thresholds.map((t) => {
      const fa = history.filter((h) => h.score < 0.5 && h.score >= t).length;
      const fr = history.filter((h) => h.score >= 0.5 && h.score < t).length;
      const genuineTotal = history.filter((h) => h.score >= 0.5).length || 1;
      const impostorTotal = history.filter((h) => h.score < 0.5).length || 1;
      return {
        threshold: t,
        FAR: +(fa / impostorTotal).toFixed(4),
        FRR: +(fr / genuineTotal).toFixed(4),
      };
    });

    // EER approximation — where FAR ≈ FRR
    const eerPoint = roc.reduce((prev, curr) =>
      Math.abs(curr.FAR - curr.FRR) < Math.abs(prev.FAR - prev.FRR) ? curr : prev
    );

    res.json({
      totalAttempts,
      accepted,
      rejected,
      EER: +((eerPoint.FAR + eerPoint.FRR) / 2).toFixed(4),
      eerThreshold: eerPoint.threshold,
      roc,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full match history
router.get("/history", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("matchHistory");
    res.json({ history: user.matchHistory.slice(-50).reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
