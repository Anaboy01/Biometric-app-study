# BioAuth — Calculations & Logic

## 1. Face Descriptor Extraction (face-api.js)

Face-api.js uses a **ResNet-34** architecture trained on facial recognition tasks. It outputs a **128-dimensional embedding vector** for each detected face. Faces from the same person cluster close together in this 128-dim space; faces from different people are far apart.

The pipeline runs three models in sequence:

| Model | Purpose | Output |
|---|---|---|
| SSD MobileNet v1 | Detect face bounding box | `{ x, y, width, height, score }` |
| Face Landmark 68 Net | 68-point facial geometry | Array of 2D points |
| Face Recognition Net | Identity embedding | `Float32Array[128]` |

Detection confidence from SSD MobileNet (`0.0–1.0`) is saved as the **quality score** (multiplied by 100).

---

## 2. Fingerprint Feature Extraction

Since browser JS cannot run native fingerprint minutiae algorithms, BioAuth uses a **block-level statistical descriptor** computed on the raw image bytes.

### Algorithm

```
Input: base64 image string
Output: Float64Array[64]

1. Decode base64 → raw byte buffer
2. Divide buffer into 64 equal-length segments
3. For each segment i:
     mean_i   = average(bytes[i]) / 255      (normalized 0–1)
     stddev_i = sqrt(variance(bytes[i]))
4. Feature[i] = mean_i   if i is even
              = stddev_i if i is odd
```

This gives a 64-dim vector capturing the **intensity distribution** and **contrast** across different regions of the fingerprint image.

> **Note:** This is a simplified approach suitable for a lab demo. Production systems use minutiae-based extractors (ridge endings, bifurcations) such as SourceAFIS or NBIS.

### Quality Score

```
quality = min(100, round((stddev / 128) × 100))
```

Higher standard deviation in pixel values = more ridges and contrast = better quality fingerprint.

---

## 3. Face Matching — Euclidean Distance

**Euclidean distance** measures the straight-line distance between two points in 128-dimensional space.

### Formula

```
d(A, B) = sqrt( Σ (A[i] − B[i])² )   for i = 0..127
```

### Interpretation

| Distance | Interpretation |
|---|---|
| < 0.35 | Very strong match (same person) |
| 0.35 – 0.50 | Likely match |
| 0.50 – 0.60 | Borderline |
| > 0.60 | Likely different people |

### Conversion to Score

Because the frontend displays a 0–1 similarity score (higher = better match):

```
score = 1 − distance
```

### Decision Rule

```
if distance ≤ threshold  →  ACCEPT
else                     →  REJECT
```

Default threshold: **0.45** (configurable via slider, 0.10–0.90).

---

## 4. Fingerprint Matching — Cosine Similarity

**Cosine similarity** measures the angle between two vectors, regardless of their magnitude. It is more robust than Euclidean distance for statistical feature vectors where magnitude may vary based on image brightness.

### Formula

```
cosine(A, B) = (A · B) / (‖A‖ × ‖B‖)

where:
  A · B  = Σ A[i] × B[i]          (dot product)
  ‖A‖    = sqrt( Σ A[i]² )        (L2 norm of A)
  ‖B‖    = sqrt( Σ B[i]² )        (L2 norm of B)
```

Range: `−1` (opposite) to `+1` (identical). For non-negative feature vectors, range is `0–1`.

### Decision Rule

```
if score ≥ threshold  →  ACCEPT
else                  →  REJECT
```

Default threshold: **0.70**.

---

## 5. Multimodal Fusion — Weighted Score Fusion

Score-level fusion combines the normalized match scores from both modalities before making a single accept/reject decision.

### Formula

```
fusedScore = (w_face × faceScore) + (w_fp × fpScore)

where:
  w_face + w_fp = 1.0   (weights sum to 1)
  default: w_face = 0.5, w_fp = 0.5
```

### Decision Rule

```
fusedThreshold = (faceThreshold + fpThreshold) / 2

if fusedScore ≥ fusedThreshold  →  ACCEPT
else                            →  REJECT
```

### Why Score Fusion?

Score fusion is the most practical fusion level because:
- No need to re-train models (unlike feature-level fusion)
- Scores from different modalities are easy to normalize
- Weights can be tuned to favour a more reliable modality

---

## 6. Biometric Error Rates

### FAR — False Accept Rate

The proportion of impostor (non-genuine) attempts that the system incorrectly accepts.

```
FAR = (False Accepts) / (Total Impostor Attempts)
```

A high FAR means the system is **too permissive** — attackers can get in.

### FRR — False Reject Rate

The proportion of genuine attempts that the system incorrectly rejects.

```
FRR = (False Rejects) / (Total Genuine Attempts)
```

A high FRR means the system is **too strict** — real users get locked out.

### The FAR/FRR Tradeoff

FAR and FRR move in opposite directions as the threshold changes:

```
Raise threshold → FAR decreases, FRR increases  (stricter)
Lower threshold → FAR increases, FRR decreases  (more permissive)
```

### EER — Equal Error Rate

The threshold at which FAR = FRR. Used as a single number to compare biometric systems.

```
EER ≈ (FAR_at_crossover + FRR_at_crossover) / 2
```

**Lower EER = better system.** Typical values:

| System | EER |
|---|---|
| Fingerprint (production) | 1–3% |
| Face recognition (production) | 0.1–2% |
| Simple statistical demo | 10–30% |

### ROC Curve Computation

BioAuth sweeps thresholds from 0.10 to 1.00 in steps of 0.05 and computes FAR and FRR at each point. The result is plotted as a curve — the intersection of the FAR and FRR lines marks the EER.

```
thresholds = [0.10, 0.15, 0.20, ..., 0.95, 1.00]

for each t in thresholds:
  FAR[t] = attempts where score < 0.5 AND score ≥ t  / total_impostor
  FRR[t] = attempts where score ≥ 0.5 AND score < t  / total_genuine
```

> In this demo, attempts with `score ≥ 0.5` are treated as genuine and `score < 0.5` as impostors. In a real system, you'd have labeled genuine/impostor datasets.

---

## 7. JWT Authentication

All protected routes use JWT (JSON Web Token) authentication.

### Token Generation (Login/Register)

```
payload = { id: user._id }
token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
```

### Token Verification (Middleware)

```
header = "Authorization: Bearer <token>"
decoded = jwt.verify(token, JWT_SECRET)
req.userId = decoded.id
```

Tokens expire after 7 days. If invalid or expired, the API returns `401 Unauthorized`.

### Password Hashing

```
hashed = bcrypt.hash(password, saltRounds=12)
valid  = bcrypt.compare(plaintext, hashed)
```

12 salt rounds means ~250ms per hash — fast enough for login, slow enough to deter brute force.