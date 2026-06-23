# BioAuth — Components & Pages

## Project Structure

```
frontend/src/
├── main.jsx                  Entry point — mounts React app
├── App.jsx                   Router + Layout shell
├── index.css                 Global styles and design tokens
├── pages/
│   ├── LoginPage.jsx         Register / sign in
│   ├── DashboardPage.jsx     Overview + enrollment status
│   ├── EnrollPage.jsx        Face & fingerprint enrollment
│   ├── VerifyPage.jsx        Verification + threshold tuning
│   └── StatsPage.jsx         FAR / FRR / EER + ROC chart
└── utils/
    ├── api.js                Fetch wrapper for all backend calls
    └── AuthContext.jsx       Global user state (React Context)

backend/
├── server.js                 Express entry point
├── middleware/auth.js        JWT verification middleware
├── models/User.js            MongoDB schema
├── routes/
│   ├── auth.js               POST /register, POST /login
│   ├── enroll.js             POST /face, POST /fingerprint, GET /status
│   ├── verify.js             POST /face, POST /fingerprint, POST /multimodal
│   └── stats.js              GET /error-rates, GET /history
└── utils/
    ├── matchingUtils.js      euclideanDistance(), cosineSimilarity()
    └── fingerprintUtils.js   computeFingerprintDescriptor(), computeQualityScore()
```

---

## Frontend Pages

---

### `LoginPage.jsx`

**Route:** `/login`  
**Access:** Public (redirects to `/dashboard` if already logged in)

Handles both registration and sign-in in a single page, toggled by two buttons.

**State:**
| Variable | Type | Purpose |
|---|---|---|
| `mode` | `"login" \| "register"` | Which form to show |
| `form` | `{ username, email, password }` | Controlled form fields |
| `error` | `string` | Error message from API |
| `loading` | `boolean` | Disables button during request |

**Flow:**
1. User fills form and clicks submit.
2. Calls `api.login()` or `api.register()`.
3. On success, calls `AuthContext.login(user, token)` which saves to `localStorage`.
4. Navigates to `/dashboard`.

---

### `DashboardPage.jsx`

**Route:** `/dashboard`  
**Access:** Authenticated

Overview page showing enrollment status, key error rate metrics, and recent match history.

**On mount:**
- Fetches `enrollStatus` → updates `enrolled` flags in AuthContext
- Fetches `errorRates` → displays FAR/FRR/EER metrics
- Fetches `history` → shows last 5 match attempts

**Sections:**
- **Enrollment cards** — shows face and fingerprint status with a quick-enroll button if not yet enrolled
- **Metric grid** — Total Attempts, Accepted, Rejected, EER
- **Match history table** — Type, Score, Threshold, Decision, Timestamp

---

### `EnrollPage.jsx`

**Route:** `/enroll`  
**Access:** Authenticated

Two-tab page for enrolling face (via webcam) and fingerprint (via image upload).

#### Face Tab

**Dependencies:** `face-api.js` (loaded dynamically on first visit)

**State:**
| Variable | Purpose |
|---|---|
| `modelsLoaded` | Whether face-api models finished loading |
| `streaming` | Whether webcam is active |
| `videoRef` | Ref to `<video>` element |
| `canvasRef` | Ref to overlay `<canvas>` for drawing landmarks |

**Flow:**
1. `loadFaceApi()` — loads 3 models from GitHub CDN (SSD MobileNet, Landmarks 68, Face Recognition).
2. "Start Camera" → `getUserMedia({ video: true })` → assigns stream to `<video>`.
3. "Capture & Enroll" → `detectSingleFace().withFaceLandmarks().withFaceDescriptor()`.
4. Draws bounding box + landmarks on the canvas overlay.
5. Extracts `descriptor` (128-dim) and `quality` (confidence × 100).
6. POSTs to `/api/enroll/face`.
7. Updates `enrolled.face = true` in AuthContext.

#### Fingerprint Tab

**Flow:**
1. User clicks the dashed upload area → file input opens.
2. Selected image previewed with grayscale CSS filter.
3. "Enroll Fingerprint" → reads file as data URL → POSTs to `/api/enroll/fingerprint`.
4. Backend extracts 64-dim descriptor and stores template.
5. Updates `enrolled.fingerprint = true` in AuthContext.

---

### `VerifyPage.jsx`

**Route:** `/verify`  
**Access:** Authenticated  
**Requires:** At least one modality enrolled

Three-tab verification page with live score display and threshold sliders.

**Tabs:**
- **Face** — requires face enrollment
- **Fingerprint** — requires fingerprint enrollment
- **Multimodal** — requires both enrolled (grayed out otherwise)

**Threshold sliders:**

| Slider | Range | Default | Metric |
|---|---|---|---|
| Face threshold | 0.10 – 0.90 | 0.55 | Euclidean similarity cutoff |
| Fingerprint threshold | 0.10 – 0.99 | 0.70 | Cosine similarity cutoff |

**Result panel:**

Displays after each verification:
- Accept ✅ or Reject ❌ with color coding
- `ScoreBar` component — a visual progress bar colored green (accept) or red (reject)
- Raw score, distance (face only), and threshold used
- Multimodal: shows individual face score + fingerprint score + fused score

**`ScoreBar` component (inline):**
```jsx
<ScoreBar score={0.82} threshold={0.55} label="Face Match Score" />
// Renders a colored bar at 82% width, green because 0.82 > 0.55
```

---

### `StatsPage.jsx`

**Route:** `/stats`  
**Access:** Authenticated

Biometric error rate analysis with definitions, metrics, and a ROC curve chart.

**On mount:**
- Fetches `/api/stats/error-rates` → EER, FAR/FRR sweep data, totals
- Fetches `/api/stats/history` → full match history

**Sections:**

**Metric grid:**
| Metric | Description |
|---|---|
| Total Attempts | All verification attempts logged |
| EER | Equal Error Rate (%) |
| EER Threshold | Threshold value at EER point |
| Accepted | Total accept decisions |
| Rejected | Total reject decisions |

**Definition cards:** FAR, FRR, EER, ROC — each with a colored left border and plain-English description.

**ROC Curve chart:**
- Built with `recharts` `LineChart`
- X-axis: threshold (0.10–1.00)
- Y-axis: error rate (%)
- Two lines: FAR (red) and FRR (blue)
- Dashed vertical `ReferenceLine` at the EER threshold
- Tooltip on hover showing exact FAR/FRR at each threshold

**Match history table:** Full paginated list of all attempts with type, score, threshold, decision, and timestamp.

---

## Utility Modules

---

### `utils/api.js`

Central fetch wrapper for all backend API calls. Automatically:
- Reads JWT token from `localStorage`
- Attaches `Authorization: Bearer <token>` header
- Throws an `Error` with the server's message on non-2xx responses

```js
// Usage examples
await api.login({ email, password })
await api.enrollFace({ descriptor, quality })
await api.verifyMultimodal({ faceDescriptor, fingerprintBase64, ... })
await api.errorRates()
```

All methods are `async` and return the parsed JSON response body.

---

### `utils/AuthContext.jsx`

React Context providing global authentication state to all components.

**Provided values:**
| Value | Type | Purpose |
|---|---|---|
| `user` | `object \| null` | Current user (`{ id, username, email, enrolled }`) |
| `loading` | `boolean` | True while checking localStorage on first render |
| `login(userData, token)` | `function` | Save user + token, update state |
| `logout()` | `function` | Clear localStorage, reset state |
| `updateEnrolled(enrolled)` | `function` | Update enrolled flags without full re-login |

Wrap your component with `useAuth()` to access these:
```jsx
const { user, logout } = useAuth();
```

---

## Backend Modules

---

### `models/User.js`

MongoDB schema with three embedded sub-schemas:

**`biometricTemplateSchema`**
```
type:       "face" | "fingerprint"
descriptor: [Number]   // 128-dim (face) or 64-dim (fingerprint)
quality:    Number     // 0–100
enrolledAt: Date
```

**`matchAttemptSchema`**
```
type:      "face" | "fingerprint" | "multimodal"
score:     Number
threshold: Number
decision:  "accept" | "reject"
timestamp: Date
```

**`userSchema`**
```
username:     String (unique)
email:        String (unique)
password:     String (bcrypt hash)
templates:    [biometricTemplateSchema]
matchHistory: [matchAttemptSchema]
enrolled:     { face: Boolean, fingerprint: Boolean }
```

---

### `utils/matchingUtils.js`

| Function | Signature | Description |
|---|---|---|
| `euclideanDistance(a, b)` | `(number[], number[]) → number` | L2 distance between two vectors |
| `cosineSimilarity(a, b)` | `(number[], number[]) → number` | Cosine similarity, returns 0–1 |
| `normalizeVector(vec)` | `(number[]) → number[]` | Unit-normalizes a vector |

---

### `utils/fingerprintUtils.js`

| Function | Signature | Description |
|---|---|---|
| `computeFingerprintDescriptor(base64)` | `(string) → Promise<number[]>` | Extracts 64-dim feature vector from base64 image |
| `computeQualityScore(buffer)` | `(Buffer) → number` | Returns 0–100 quality score based on contrast |

---

### `middleware/auth.js`

Express middleware that verifies the JWT on every protected route.

```
GET /api/enroll/status
Authorization: Bearer eyJhbGc...

→ decoded = jwt.verify(token, JWT_SECRET)
→ req.userId = decoded.id
→ next()
```

Returns `401` if token is missing, expired, or tampered with.

---

### Routes Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Create account |
| POST | `/api/auth/login` | ✗ | Sign in, get JWT |
| POST | `/api/enroll/face` | ✓ | Save face descriptor |
| POST | `/api/enroll/fingerprint` | ✓ | Save fingerprint template |
| GET | `/api/enroll/status` | ✓ | Get enrollment flags |
| POST | `/api/verify/face` | ✓ | Verify face, log attempt |
| POST | `/api/verify/fingerprint` | ✓ | Verify fingerprint, log attempt |
| POST | `/api/verify/multimodal` | ✓ | Fused verification |
| GET | `/api/stats/error-rates` | ✓ | FAR, FRR, EER, ROC data |
| GET | `/api/stats/history` | ✓ | Last 50 match attempts |
| GET | `/api/health` | ✗ | Server health check |