/**
 * Euclidean distance between two vectors.
 * Used for face descriptor matching (face-api.js 128-dim vectors).
 * Lower = more similar. Typical accept threshold: < 0.45
 */
export function euclideanDistance(a, b) {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

/**
 * Cosine similarity between two vectors.
 * Used for fingerprint feature matching.
 * Higher = more similar. Typical accept threshold: > 0.70
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Normalize a vector to unit length.
 */
export function normalizeVector(vec) {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v ** 2, 0));
  return mag === 0 ? vec : vec.map((v) => v / mag);
}
