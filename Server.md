# BioAuth — Backend Documentation

## Overview

The backend is a **Node.js + Express** REST API using **MongoDB** (via Mongoose) for data persistence. It handles user authentication, biometric template storage, matching logic, and error rate computation.

```
backend/
├── server.js                   Express app + MongoDB connection
├── .env.example                Environment variable template
├── middleware/
│   └── auth.js                 JWT verification middleware
├── models/
│   └── User.js                 Mongoose schema
├── routes/
│   ├── auth.js                 /api/auth/*
│   ├── enroll.js               /api/enroll/*
│   ├── verify.js               /api/verify/*
│   └── stats.js                /api/stats/*
└── utils/
    ├── matchingUtils.js        Distance & similarity functions
    └── fingerprintUtils.js     Fingerprint feature extraction
```

---

## Environment Variables

Defined in `.env` (copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3002` | Port the Express server listens on |
| `MONGO_URI` | `mongodb://localhost:27017/biometric_db` | MongoDB connection string |
| `JWT_SECRET` | `biometric_secret_key` | Secret for signing/verifying JWT tokens |

> **Important:** Change `JWT_SECRET` to a long random string in production. Never commit your real `.env` to version control.

---

## `server.js` — Entry Point

Bootstraps the Express app and connects to MongoDB.

```
startup sequence:
  1. Load environment variables (dotenv)
  2. Configure middleware:
       - cors({ origin: "http://localhost:5173" })
       - express.json({ limit: "10mb" })   ← needed for base64 images
  3. Mount routes
  4. Connect mongoose → then start listening
```

**Middleware applied globally:**

| Middleware | Purpose |
|---|---|
| `cors` | Allows requests from the Vite dev server (port 5173) |
| `express.json` | Parses JSON request bodies; 10MB limit for base64 images |

**Mounted routes:**

| Prefix | Module |
|---|---|
| `/api/auth` | `routes/auth.js` |
| `/api/enroll` | `routes/enroll.js` |
| `/api/verify` | `routes/verify.js` |
| `/api/stats` | `routes/stats.js` |
| `/api/health` | Inline — returns `{ status: "ok" }` |

---

## `models/User.js` — MongoDB Schema

A single `User` document stores everything about a user — credentials, biometric templates, and match history.

### Schema Structure

```
User {
  username:     String  (unique, trimmed)
  email:        String  (unique, lowercase)
  password:     String  (bcrypt hash, never stored plain)
  enrolled: {
    face:         Boolean  (default: false)
    fingerprint:  Boolean  (default: false)
  }
  templates:    [BiometricTemplate]
  matchHistory: [MatchAttempt]
  createdAt:    Date  (auto — Mongoose timestamps)
  updatedAt:    Date  (auto — Mongoose timestamps)
}
```

### `BiometricTemplate` Sub-schema

Embedded array — one document per enrolled modality.

```
{
  type:       "face" | "fingerprint"
  descriptor: [Number]    // 128 values for face, 64 for fingerprint
  imagePath:  String      // optional stored image path
  quality:    Number      // 0–100 quality score
  enrolledAt: Date
}
```

On re-enrollment the old template is filtered out before the new one is pushed:
```js
user.templates = user.templates.filter(t => t.type !== "face");
user.templates.push({ type: "face", descriptor, quality });
```

### `MatchAttempt` Sub-schema

Embedded array — one document per verification attempt.

```
{
  type:      "face" | "fingerprint" | "multimodal"
  score:     Number   // normalized match score (0–1)
  threshold: Number   // threshold used for this attempt
  decision:  "accept" | "reject"
  timestamp: Date
}
```

Used by the stats route to compute FAR, FRR, and EER.

---

## `middleware/auth.js` — JWT Verification

Applied to all routes in `/api/enroll`, `/api/verify`, and `/api/stats`.

### How It Works

```
Request arrives with:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Middleware:
  1. Extract header → split(" ")[1] → token string
  2. jwt.verify(token, JWT_SECRET) → decoded payload
  3. req.userId = decoded.id      → available in route handlers
  4. next()                       → pass to route

On failure (missing / expired / invalid):
  → 401 { error: "No token provided" | "Invalid token" }
```

### Usage in Routes

```js
import { authenticate } from "../middleware/auth.js";

router.get("/status", authenticate, async (req, res) => {
  const user = await User.findById(req.userId);  // req.userId set by middleware
  // ...
});
```

---

## `routes/auth.js` — Authentication

**Base path:** `/api/auth`

### `POST /register`

Creates a new user account.

**Request body:**
```json
{ "username": "johndoe", "email": "john@example.com", "password": "secret123" }
```

**Logic:**
1. Check if email or username already exists → `400` if so.
2. Hash password: `bcrypt.hash(password, 12)`.
3. Create user in MongoDB.
4. Sign JWT: `jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" })`.
5. Return token + user object.

**Response:**
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "username": "johndoe", "email": "john@example.com", "enrolled": { "face": false, "fingerprint": false } }
}
```

---

### `POST /login`

Signs in an existing user.

**Request body:**
```json
{ "email": "john@example.com", "password": "secret123" }
```

**Logic:**
1. Find user by email → `400` if not found.
2. `bcrypt.compare(password, user.password)` → `400` if mismatch.
3. Sign new JWT.
4. Return token + user object.

**Error responses:**

| Status | Message |
|---|---|
| 400 | `"User already exists"` (register) |
| 400 | `"Invalid credentials"` (login) |
| 500 | Internal server error |

---

## `routes/enroll.js` — Enrollment

**Base path:** `/api/enroll`  
**Auth required:** Yes (all routes)

---

### `POST /face`

Stores a face biometric template.

**Request body:**
```json
{
  "descriptor": [0.123, -0.456, ...],   // exactly 128 floats
  "quality": 87                          // optional, 0–100
}
```

**Validation:** Descriptor must exist and have length exactly 128.

**Logic:**
1. Find user by `req.userId`.
2. Remove any existing face template.
3. Push new template `{ type: "face", descriptor, quality }`.
4. Set `enrolled.face = true`.
5. Save user.

**Response:**
```json
{ "success": true, "message": "Face enrolled successfully" }
```

---

### `POST /fingerprint`

Stores a fingerprint biometric template.

**Request body:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "quality": 70   // optional
}
```

**Logic:**
1. Pass `imageBase64` to `computeFingerprintDescriptor()` → 64-dim float array.
2. Remove any existing fingerprint template.
3. Push new template `{ type: "fingerprint", descriptor, quality }`.
4. Set `enrolled.fingerprint = true`.
5. Save user.

**Response:**
```json
{ "success": true, "message": "Fingerprint enrolled successfully", "features": 64 }
```

---

### `GET /status`

Returns the user's current enrollment status.

**Response:**
```json
{ "enrolled": { "face": true, "fingerprint": false }, "username": "johndoe" }
```

---

## `routes/verify.js` — Verification

**Base path:** `/api/verify`  
**Auth required:** Yes (all routes)

Default thresholds (configurable per request):

| Modality | Threshold | Metric |
|---|---|---|
| Face | 0.45 | Euclidean distance (lower = stricter) |
| Fingerprint | 0.70 | Cosine similarity (higher = stricter) |

---

### `POST /face`

Verifies a live face descriptor against the stored template.

**Request body:**
```json
{
  "descriptor": [0.123, -0.456, ...],   // 128 floats from face-api.js
  "threshold": 0.55                      // optional, overrides default
}
```

**Logic:**
1. Fetch user → find face template.
2. `euclideanDistance(descriptor, template.descriptor)` → `distance`.
3. `score = 1 − distance` (higher = more similar).
4. `decision = distance <= threshold ? "accept" : "reject"`.
5. Push `{ type: "face", score, threshold, decision }` to `matchHistory`.
6. Save user.

**Response:**
```json
{
  "decision": "accept",
  "score": 0.8321,
  "distance": 0.1679,
  "threshold": 0.55
}
```

---

### `POST /fingerprint`

Verifies a fingerprint image against the stored template.

**Request body:**
```json
{
  "imageBase64": "data:image/png;base64,...",
  "threshold": 0.70
}
```

**Logic:**
1. Extract fresh 64-dim descriptor from uploaded image.
2. `cosineSimilarity(descriptor, template.descriptor)` → `score`.
3. `decision = score >= threshold ? "accept" : "reject"`.
4. Log to `matchHistory`.

**Response:**
```json
{ "decision": "reject", "score": 0.6134, "threshold": 0.70 }
```

---

### `POST /multimodal`

Fused verification combining face + fingerprint.

**Request body:**
```json
{
  "faceDescriptor": [...],          // 128 floats
  "fingerprintBase64": "data:...",  // base64 image
  "faceWeight": 0.5,                // optional, default 0.5
  "fpWeight": 0.5,                  // optional, default 0.5
  "threshold": 0.6                  // optional fused score threshold
}
```

**Logic:**
1. Compute `faceScore = 1 − euclideanDistance(faceDescriptor, faceTemplate)`.
2. Compute `fpScore = cosineSimilarity(fpDescriptor, fpTemplate)`.
3. `fusedScore = faceWeight × faceScore + fpWeight × fpScore`.
4. `decision = fusedScore >= threshold ? "accept" : "reject"`.
5. Log `{ type: "multimodal", score: fusedScore, threshold, decision }`.

**Response:**
```json
{
  "decision": "accept",
  "fusedScore": 0.7842,
  "faceScore": 0.8210,
  "fpScore": 0.7474,
  "threshold": 0.6
}
```

---

## `routes/stats.js` — Error Rate Analysis

**Base path:** `/api/stats`  
**Auth required:** Yes (all routes)

---

### `GET /error-rates`

Computes FAR, FRR, and EER from the user's match history.

**Logic:**

1. Load all `matchHistory` entries.
2. Sweep thresholds `t` from 0.10 to 0.95 in steps of 0.05.
3. For each threshold:
   ```
   impostors = attempts where score < 0.5   (simulated non-genuine)
   genuines  = attempts where score ≥ 0.5   (simulated genuine)

   FAR[t] = count(impostors where score ≥ t) / total_impostors
   FRR[t] = count(genuines  where score < t) / total_genuines
   ```
4. EER = point where `|FAR − FRR|` is minimized:
   ```
   EER ≈ (FAR_at_min + FRR_at_min) / 2
   ```

**Response:**
```json
{
  "totalAttempts": 24,
  "accepted": 18,
  "rejected": 6,
  "EER": 0.1250,
  "eerThreshold": 0.50,
  "roc": [
    { "threshold": 0.10, "FAR": 1.0000, "FRR": 0.0000 },
    { "threshold": 0.15, "FAR": 0.8000, "FRR": 0.0500 },
    ...
    { "threshold": 0.95, "FAR": 0.0000, "FRR": 1.0000 }
  ]
}
```

The `roc` array is consumed by the recharts `LineChart` on the Stats page.

---

### `GET /history`

Returns the last 50 match attempts in reverse chronological order.

**Response:**
```json
{
  "history": [
    {
      "type": "face",
      "score": 0.8321,
      "threshold": 0.55,
      "decision": "accept",
      "timestamp": "2025-06-23T10:42:00.000Z"
    },
    ...
  ]
}
```

---

## `utils/matchingUtils.js` — Distance Functions

### `euclideanDistance(a, b)`

```
d = sqrt( Σ (a[i] − b[i])² )   for i = 0..N-1
```

- Input: two equal-length `number[]` arrays
- Output: `number` ≥ 0
- Throws if lengths differ
- Used for face matching (128-dim vectors)

### `cosineSimilarity(a, b)`

```
cos = (a · b) / (‖a‖ × ‖b‖)
```

- Input: two equal-length `number[]` arrays
- Output: `number` in range `[−1, 1]` (typically `[0, 1]` for non-negative vectors)
- Returns `0` if either vector is zero-magnitude
- Used for fingerprint matching (64-dim vectors)

### `normalizeVector(vec)`

- Divides each element by the L2 norm
- Returns unit vector (magnitude = 1)
- Returns original vector unchanged if magnitude is 0

---

## `utils/fingerprintUtils.js` — Feature Extraction

### `computeFingerprintDescriptor(imageBase64)`

**Input:** Base64 string (with or without `data:image/...;base64,` prefix)  
**Output:** `Promise<number[]>` — 64-element float array

**Algorithm:**
1. Strip data URL prefix if present.
2. Decode base64 → `Buffer`.
3. Divide buffer into 64 equal segments.
4. For each segment `i`:
   - Compute `mean` of byte values (normalized to 0–1)
   - Compute `stddev` of byte values
   - `feature[i] = mean` if `i` is even, `stddev` if `i` is odd
5. Return the 64-element array.

### `computeQualityScore(buffer)`

**Input:** Raw image `Buffer`  
**Output:** `number` 0–100

```
quality = min(100, round( (stddev / 128) × 100 ))
```

Higher pixel standard deviation = more contrast = better fingerprint quality.

---

## Error Handling Pattern

All route handlers follow this pattern:

```js
router.post("/route", authenticate, async (req, res) => {
  try {
    // ... logic
    res.json({ success: true, ... });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Specific validation errors return `400`; auth errors return `401`; everything else returns `500`.

---

## Running the Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm run dev                  # nodemon — auto-restarts on file changes
npm start                    # production (no auto-restart)
```

Requires MongoDB running locally (`mongod`) or a valid Atlas URI in `.env`.

**Health check:**
```
GET http://localhost:3002/api/health
→ { "status": "ok" }
```