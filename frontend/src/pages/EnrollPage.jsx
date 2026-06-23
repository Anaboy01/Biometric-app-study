import { useState, useRef, useEffect } from "react";
import { api } from "../utils/api.js";
import { useAuth } from "../utils/AuthContext.jsx";

// Dynamically import face-api.js
let faceapi = null;

async function loadFaceApi() {
  if (faceapi) return faceapi;
  faceapi = await import("face-api.js");
  const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  return faceapi;
}

export default function EnrollPage() {
  const { user, updateEnrolled } = useAuth();
  const [tab, setTab] = useState("face");
  const [status, setStatus] = useState({ msg: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [fpFile, setFpFile] = useState(null);
  const [fpPreview, setFpPreview] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const enrolled = user?.enrolled || {};

  // Load face-api models
  useEffect(() => {
    if (tab === "face") {
      setStatus({ msg: "Loading face detection models…", type: "info" });
      loadFaceApi()
        .then(() => {
          setModelsLoaded(true);
          setStatus({ msg: "Models loaded. Start camera to enroll.", type: "info" });
        })
        .catch(() => setStatus({ msg: "Failed to load models.", type: "danger" }));
    }
    return () => stopCamera();
  }, [tab]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStreaming(true);
      setStatus({ msg: "Camera active — position your face and click Capture.", type: "info" });
    } catch {
      setStatus({ msg: "Camera access denied.", type: "danger" });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  };

  const captureFace = async () => {
    if (!modelsLoaded || !streaming) return;
    setLoading(true);
    setStatus({ msg: "Detecting face…", type: "info" });
    try {
      const fa = await loadFaceApi();
      const detection = await fa
        .detectSingleFace(videoRef.current, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus({ msg: "No face detected. Ensure good lighting and face the camera.", type: "danger" });
        return;
      }

      // Draw detection on canvas overlay
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      fa.draw.drawDetections(canvas, [detection]);
      fa.draw.drawFaceLandmarks(canvas, [detection]);

      const descriptor = Array.from(detection.descriptor);
      const quality = Math.round(detection.detection.score * 100);

      await api.enrollFace({ descriptor, quality });
      updateEnrolled({ ...enrolled, face: true });
      setStatus({ msg: `✓ Face enrolled! Quality score: ${quality}%`, type: "success" });
      stopCamera();
    } catch (err) {
      setStatus({ msg: err.message, type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleFpFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFpFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setFpPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const enrollFingerprint = async () => {
    if (!fpFile) return;
    setLoading(true);
    setStatus({ msg: "Extracting fingerprint features…", type: "info" });
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const imageBase64 = ev.target.result;
          await api.enrollFingerprint({ imageBase64 });
          updateEnrolled({ ...enrolled, fingerprint: true });
          setStatus({ msg: "✓ Fingerprint enrolled successfully!", type: "success" });
        } catch (err) {
          setStatus({ msg: err.message, type: "danger" });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(fpFile);
    } catch (err) {
      setStatus({ msg: err.message, type: "danger" });
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Biometric Enrollment</h1>
        <p>Register your biometric templates for authentication</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["face", "fingerprint"].map((t) => (
          <button key={t} className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
            {t === "face" ? "👤 Face" : "🖐️ Fingerprint"}
            {enrolled[t] && <span className="badge badge-success" style={{ marginLeft: 4 }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Status */}
      {status.msg && <div className={`alert alert-${status.type}`}>{status.msg}</div>}

      <div style={{ marginTop: 20 }}>
        {tab === "face" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title">Face Capture</div>
              <div className="card-subtitle">Uses face-api.js to extract a 128-dim facial descriptor</div>

              <div className="webcam-wrap">
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: streaming ? "block" : "none" }} />
                <canvas ref={canvasRef} className="webcam-overlay" style={{ position: "absolute", top: 0, left: 0 }} />
                {!streaming && (
                  <div style={{ width: "100%", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", borderRadius: "var(--radius)", color: "var(--text-muted)", flexDirection: "column", gap: 12 }}>
                    <span style={{ fontSize: 40 }}>📷</span>
                    <span>Camera off</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {!streaming ? (
                  <button className="btn btn-primary" onClick={startCamera} disabled={!modelsLoaded}>
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button className="btn btn-primary" onClick={captureFace} disabled={loading}>
                      {loading ? "Processing…" : "Capture & Enroll"}
                    </button>
                    <button className="btn btn-ghost" onClick={stopCamera}>Stop</button>
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title">How It Works</div>
              <div className="card-subtitle">Face enrollment pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
                {[
                  ["1. Detection", "SSD MobileNet v1 detects face bounding box"],
                  ["2. Landmarks", "68-point facial landmark localization"],
                  ["3. Descriptor", "ResNet-34 generates 128-dim embedding"],
                  ["4. Storage", "Template saved to MongoDB (encrypted)"],
                  ["5. Quality", "Confidence score stored as quality metric"],
                ].map(([step, desc]) => (
                  <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", minWidth: 100 }}>{step}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "fingerprint" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title">Fingerprint Upload</div>
              <div className="card-subtitle">Upload a fingerprint image for feature extraction</div>

              <div style={{
                border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: 32,
                textAlign: "center", cursor: "pointer", marginBottom: 16, position: "relative"
              }}
                onClick={() => document.getElementById("fp-input").click()}>
                {fpPreview ? (
                  <img src={fpPreview} alt="fingerprint" style={{ maxHeight: 200, borderRadius: "var(--radius)", filter: "grayscale(100%)" }} />
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🖐️</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Click to upload fingerprint image</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>PNG, JPG, BMP supported</div>
                  </>
                )}
                <input id="fp-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handleFpFile} />
              </div>

              <button className="btn btn-primary" onClick={enrollFingerprint} disabled={!fpFile || loading}>
                {loading ? "Extracting Features…" : "Enroll Fingerprint"}
              </button>
            </div>

            <div className="card">
              <div className="card-title">How It Works</div>
              <div className="card-subtitle">Fingerprint enrollment pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
                {[
                  ["1. Upload", "Fingerprint image uploaded as base64"],
                  ["2. Preprocessing", "Grayscale conversion, contrast normalization"],
                  ["3. Block Analysis", "8×8 grid → mean & std-dev per block"],
                  ["4. Feature Vector", "64-dim statistical descriptor extracted"],
                  ["5. Storage", "Template saved to MongoDB for matching"],
                ].map(([step, desc]) => (
                  <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", minWidth: 100 }}>{step}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
