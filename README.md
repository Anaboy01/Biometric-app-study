# BioAuth — Biometric Authentication Lab

A full-stack biometric authentication app built with **Vite + React** (frontend) and **Node.js + Express + MongoDB** (backend), covering all core biometric lab objectives.

## Features

| Module | Description |
|---|---|
| 👤 Face Enrollment | Webcam capture → face-api.js 128-dim descriptor |
| 🖐️ Fingerprint Enrollment | Image upload → statistical block feature extraction |
| 🔐 Face Verification | Euclidean distance matching with tunable threshold |
| 🔐 Fingerprint Verification | Cosine similarity matching |
| 🔀 Multimodal Fusion | Score-level fusion of face + fingerprint |
| 📈 Error Rate Analysis | FAR, FRR, EER calculation + ROC curve |
| 🔒 Security | JWT auth, bcrypt passwords, encrypted templates |

---

## Project Structure

```
biometric-app/
├── backend/
│   ├── models/User.js          # MongoDB schema (templates, match history)
│   ├── routes/
│   │   ├── auth.js             # Register / Login
│   │   ├── enroll.js           # Face & fingerprint enrollment
│   │   ├── verify.js           # Verification + multimodal fusion
│   │   └── stats.js            # FAR, FRR, EER, history
│   ├── utils/
│   │   ├── matchingUtils.js    # Euclidean distance, cosine similarity
│   │   └── fingerprintUtils.js # Statistical feature extraction
│   ├── middleware/auth.js      # JWT authentication
│   └── server.js               # Express entry point
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── EnrollPage.jsx
    │   │   ├── VerifyPage.jsx
    │   │   └── StatsPage.jsx
    │   ├── utils/
    │   │   ├── api.js           # Fetch wrapper
    │   │   └── AuthContext.jsx  # User state
    │   ├── App.jsx
    │   └── index.css
    └── vite.config.js          # Proxy to backend
```

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Edit MONGO_URI and JWT_SECRET
npm run dev                 # Starts on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # Starts on http://localhost:5173
```

---

## Usage Flow

1. **Register** an account at `/login`
2. **Enroll** → face (via webcam) + fingerprint (upload image)
3. **Verify** → test each modality or use multimodal fusion
4. **Tune thresholds** using the sliders on the Verify page
5. **Analyze** FAR/FRR/EER on the Error Rates page

---

## Lab Objectives Coverage

| Objective | Where |
|---|---|
| Capture biometric samples | EnrollPage — webcam + upload |
| Image processing / quality | fingerprintUtils.js, face-api.js |
| Feature extraction | face-api.js descriptors, block stats |
| Biometric matching | matchingUtils.js (Euclidean, cosine) |
| Threshold experiments | VerifyPage sliders |
| FAR, FRR, EER | StatsPage + stats route |
| Multimodal fusion | verify/multimodal route + VerifyPage |
| Privacy & security | JWT, bcrypt, template isolation |
