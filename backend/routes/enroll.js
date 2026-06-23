import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";
import { computeFingerprintDescriptor } from "../utils/fingerprintUtils.js";

const router = express.Router();

// Enroll face — receives 128-dim descriptor from face-api.js on frontend
router.post("/face", authenticate, async (req, res) => {
  try {
    const { descriptor, quality } = req.body;
    if (!descriptor || descriptor.length !== 128)
      return res.status(400).json({ error: "Invalid face descriptor (must be 128 values)" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Remove old face template if any
    user.templates = user.templates.filter((t) => t.type !== "face");
    user.templates.push({ type: "face", descriptor, quality: quality || 80 });
    user.enrolled.face = true;
    await user.save();

    res.json({ success: true, message: "Face enrolled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll fingerprint — receives base64 image, extracts features server-side
router.post("/fingerprint", authenticate, async (req, res) => {
  try {
    const { imageBase64, quality } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No fingerprint image provided" });

    const descriptor = await computeFingerprintDescriptor(imageBase64);

    const user = await User.findById(req.userId);
    user.templates = user.templates.filter((t) => t.type !== "fingerprint");
    user.templates.push({
      type: "fingerprint",
      descriptor,
      quality: quality || 70,
    });
    user.enrolled.fingerprint = true;
    await user.save();

    res.json({ success: true, message: "Fingerprint enrolled successfully", features: descriptor.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get enrollment status
router.get("/status", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("enrolled username");
    res.json({ enrolled: user.enrolled, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
