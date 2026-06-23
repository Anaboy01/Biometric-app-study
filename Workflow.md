# BioAuth — App Workflow

## Overview

BioAuth is a full-stack biometric authentication lab application. Users register an account, enroll their biometric data (face and/or fingerprint), then verify their identity using those templates. The system logs every match attempt and computes biometric error rates (FAR, FRR, EER) from the history.

---

## High-Level Flow

```
Register / Login
      │
      ▼
  Enrollment
  ┌─────────────────────┐
  │  Face (webcam)      │──► 128-dim descriptor ──► MongoDB
  │  Fingerprint (file) │──► 64-dim feature vec ──► MongoDB
  └─────────────────────┘
      │
      ▼
  Verification
  ┌─────────────────────────────────────────┐
  │  Face only       → Euclidean distance   │
  │  Fingerprint     → Cosine similarity    │
  │  Multimodal      → Weighted fusion      │
  └─────────────────────────────────────────┘
      │
      ▼
  Decision  ──► Log to matchHistory
      │
      ▼
  Stats / Error Rates
  (FAR, FRR, EER, ROC curve)
```

---

## Step-by-Step Workflow

### 1. Authentication

- User visits `/login` and either **registers** (username, email, password) or **signs in**.
- On success the backend returns a **JWT token** which the frontend stores in `localStorage`.
- All subsequent API calls attach this token in the `Authorization: Bearer <token>` header.

### 2. Enrollment

Enrollment stores a **biometric template** for a user. Each user can have one face template and one fingerprint template. Re-enrolling replaces the previous template.

#### Face Enrollment
1. Frontend loads `face-api.js` models from GitHub CDN (SSD MobileNet, Face Landmark 68, Face Recognition Net).
2. Webcam stream starts via `getUserMedia`.
3. On capture, `face-api.js` runs:
   - Face detection (bounding box)
   - 68-point landmark detection
   - ResNet-34 descriptor generation → **128-dimensional float array**
4. Detection confidence is saved as the **quality score** (0–100).
5. Frontend POSTs `{ descriptor, quality }` to `/api/enroll/face`.
6. Backend validates the descriptor length (must be exactly 128) and saves to MongoDB.

#### Fingerprint Enrollment
1. User uploads a fingerprint image (PNG, JPG, BMP).
2. Frontend reads it as a base64 data URL.
3. POSTs `{ imageBase64 }` to `/api/enroll/fingerprint`.
4. Backend runs `computeFingerprintDescriptor()` which extracts a **64-dimensional statistical feature vector** from the image bytes.
5. Vector is saved to MongoDB as the fingerprint template.

### 3. Verification

Verification compares a **live sample** against the stored template and returns a match score and decision.

#### Face Verification
1. User opens webcam → captures face → frontend extracts 128-dim descriptor.
2. POSTs descriptor + chosen threshold to `/api/verify/face`.
3. Backend computes **Euclidean distance** between live descriptor and stored template.
4. Converts to a similarity score: `score = 1 − distance`.
5. Decision: `distance ≤ threshold → accept`, else `reject`.
6. Attempt logged to `matchHistory`.

#### Fingerprint Verification
1. User uploads a fingerprint image.
2. Backend extracts a fresh 64-dim descriptor from the uploaded image.
3. Computes **cosine similarity** against the stored template.
4. Decision: `score ≥ threshold → accept`, else `reject`.
5. Attempt logged to `matchHistory`.

#### Multimodal Verification
1. User provides both webcam face + fingerprint image simultaneously.
2. Backend runs both modalities independently.
3. Scores are combined via **weighted score fusion**:
   ```
   fusedScore = (faceWeight × faceScore) + (fpWeight × fpScore)
   ```
   Default weights: `faceWeight = 0.5`, `fpWeight = 0.5`.
4. Decision based on fused score vs a combined threshold.

### 4. Threshold Tuning

The Verify page exposes two sliders:
- **Face threshold** (default 0.55): Euclidean-distance-derived similarity cutoff.
- **Fingerprint threshold** (default 0.70): Cosine similarity cutoff.

Lowering a threshold → fewer rejections (lower FRR, higher FAR).  
Raising a threshold → stricter matching (lower FAR, higher FRR).

### 5. Error Rate Analysis

After accumulating match attempts, the Stats page shows:
- **FAR** and **FRR** computed across a threshold sweep (0.10 → 1.00 in 0.05 steps).
- **EER** — the threshold where FAR ≈ FRR.
- A **ROC curve** chart (FAR vs FRR across all thresholds).
- Full match history table.

---

## Data Flow Diagram

```
Browser                        Express API                  MongoDB
───────                        ───────────                  ───────
getUserMedia()
    │
face-api.js
    │
descriptor[]  ──POST /enroll/face──►  validate 128-dim
                                           │
                                      User.templates.push()──► save
                                           │
                                      enrolled.face = true ──► save

upload image  ──POST /verify/fp──►   computeDescriptor()
                                           │
                                      cosineSimilarity() ◄── fetch template
                                           │
                                      log matchHistory ──────► save
                                           │
                              ◄── { decision, score, threshold }
```

---

## Security Notes

- Passwords are hashed with **bcrypt** (12 salt rounds) before storage.
- API routes are protected with **JWT middleware** — no template can be read or written without a valid token.
- Each user's templates are isolated — verification always runs against the authenticated user's own stored template.
- Templates are stored as raw float arrays in MongoDB. For production, consider encrypting them at rest.