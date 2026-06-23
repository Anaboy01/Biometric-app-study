import mongoose from "mongoose";

const biometricTemplateSchema = new mongoose.Schema({
  type: { type: String, enum: ["face", "fingerprint"], required: true },
  descriptor: { type: [Number], default: [] }, // 128-dim face vector or fingerprint features
  imagePath: { type: String },                  // stored fingerprint image path
  quality: { type: Number, default: 0 },        // 0–100 quality score
  enrolledAt: { type: Date, default: Date.now },
});

const matchAttemptSchema = new mongoose.Schema({
  type: { type: String, enum: ["face", "fingerprint", "multimodal"] },
  score: Number,
  threshold: Number,
  decision: { type: String, enum: ["accept", "reject"] },
  timestamp: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    templates: [biometricTemplateSchema],
    matchHistory: [matchAttemptSchema],
    enrolled: {
      face: { type: Boolean, default: false },
      fingerprint: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
