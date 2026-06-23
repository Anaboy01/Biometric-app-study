import { useState, useRef, useEffect } from "react";
import { api } from "../utils/api.js";
import { useAuth } from "../utils/AuthContext.jsx";

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

function ScoreBar({ score, threshold, label }) {
  const pct = Math.round(score * 100);
  const color = score >= threshold ? "var(--success)" : "var(--danger)";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontFamily: "var(--mono)", color }}>{pct}%</span>
      </div>
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
        Threshold: {Math.round(threshold * 100)}%
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("face");
  const [faceThreshold, setFaceThreshold] = useState(0.55);
  const [fpThreshold, setFpThreshold] = useState(0.70);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [fpFile, setFpFile] = useState(null);
  const [fpFile2, setFpFile2] = useState(null);
  const [fpPreview, setFpPreview] = useState(null);
  const [fpPreview2, setFpPreview2] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("");

  const enrolled = user?.enrolled || {};

  useEffect(() => {
    if (tab === "face" || tab === "multimodal") {
      loadFaceApi().then(() => setModelsLoaded(true)).catch(console.error);
    }
    return () => stopCamera();
  }, [tab]);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    videoRef.current.play();
    setStreaming(true);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  };

  const verifyFace = async () => {
    setLoading(true);
    setResult(null);
    setStatus("Detecting face…");
    try {
      const fa = await loadFaceApi();
      const detection = await fa
        .detectSingleFace(videoRef.current, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) { setStatus("No face detected."); setLoading(false); return; }

      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      fa.draw.drawDetections(canvas, [detection]);

      const descriptor = Array.from(detection.descriptor);
      const res = await api.verifyFace({ descriptor, threshold: faceThreshold });
      setResult({ ...res, type: "face" });
      setStatus("");
      stopCamera();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyFingerprint = async () => {
    if (!fpFile) return;
    setLoading(true);
    setResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const res = await api.verifyFingerprint({ imageBase64: ev.target.result, threshold: fpThreshold });
          setResult({ ...res, type: "fingerprint" });
        } catch (err) {
          setStatus(err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(fpFile);
    } catch { setLoading(false); }
  };

  const verifyMultimodal = async () => {
    if (!fpFile2) return;
    setLoading(true);
    setResult(null);
    setStatus("Running multimodal verification…");
    try {
      const fa = await loadFaceApi();
      const detection = await fa
        .detectSingleFace(videoRef.current, new fa.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) { setStatus("No face detected for multimodal."); setLoading(false); return; }

      const faceDescriptor = Array.from(detection.descriptor);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const res = await api.verifyMultimodal({
            faceDescriptor,
            fingerprintBase64: ev.target.result,
            faceWeight: 0.5,
            fpWeight: 0.5,
            threshold: (faceThreshold + fpThreshold) / 2,
          });
          setResult({ ...res, type: "multimodal" });
          setStatus("");
        } catch (err) {
          setStatus(err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(fpFile2);
    } catch { setLoading(false); }
  };

  const handleFpChange = (e, which) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => which === 1 ? setFpPreview(ev.target.result) : setFpPreview2(ev.target.result);
    reader.readAsDataURL(file);
    which === 1 ? setFpFile(file) : setFpFile2(file);
  };

  const decisionColor = result?.decision === "accept" ? "var(--success)" : "var(--danger)";
  const decisionIcon = result?.decision === "accept" ? "✅" : "❌";

  return (
    <div>
      <div className="page-header">
        <h1>Biometric Verification</h1>
        <p>Authenticate using enrolled templates — tune thresholds to analyze FAR/FRR tradeoffs</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { key: "face", label: "👤 Face", locked: !enrolled.face },
          { key: "fingerprint", label: "🖐️ Fingerprint", locked: !enrolled.fingerprint },
          { key: "multimodal", label: "🔀 Multimodal", locked: !enrolled.face || !enrolled.fingerprint },
        ].map(({ key, label, locked }) => (
          <button key={key} className={`btn ${tab === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => !locked && setTab(key)} title={locked ? "Enroll first" : ""} style={{ opacity: locked ? 0.5 : 1 }}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid-2">
        {/* Left — Input */}
        <div>
          {(tab === "face" || tab === "multimodal") && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Face Capture</div>
              <div className="webcam-wrap" style={{ position: "relative" }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: streaming ? "block" : "none" }} />
                <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
                {!streaming && (
                  <div style={{ aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", borderRadius: "var(--radius)", color: "var(--text-muted)", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 36 }}>📷</span>
                    <span style={{ fontSize: 12 }}>Camera off</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {!streaming
                  ? <button className="btn btn-primary" onClick={startCamera} disabled={!modelsLoaded}>Start Camera</button>
                  : <>
                    <button className="btn btn-primary" onClick={tab === "face" ? verifyFace : verifyMultimodal} disabled={loading}>
                      {loading ? "Verifying…" : "Verify"}
                    </button>
                    <button className="btn btn-ghost" onClick={stopCamera}>Stop</button>
                  </>
                }
              </div>
            </div>
          )}

          {(tab === "fingerprint" || tab === "multimodal") && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Fingerprint {tab === "multimodal" ? "(Multimodal)" : ""}</div>
              <div style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center", cursor: "pointer", marginBottom: 12 }}
                onClick={() => document.getElementById(tab === "multimodal" ? "fp2-input" : "fp-verify-input").click()}>
                {(tab === "fingerprint" ? fpPreview : fpPreview2) ? (
                  <img src={tab === "fingerprint" ? fpPreview : fpPreview2} alt="fp" style={{ maxHeight: 120, filter: "grayscale(100%)", borderRadius: 4 }} />
                ) : (
                  <><div style={{ fontSize: 28 }}>🖐️</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Upload fingerprint</div></>
                )}
                <input id="fp-verify-input" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFpChange(e, 1)} />
                <input id="fp2-input" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFpChange(e, 2)} />
              </div>
              {tab === "fingerprint" && (
                <button className="btn btn-primary" onClick={verifyFingerprint} disabled={!fpFile || loading}>
                  {loading ? "Matching…" : "Verify Fingerprint"}
                </button>
              )}
            </div>
          )}

          {/* Threshold Sliders */}
          <div className="card">
            <div className="card-title">Threshold Tuning</div>
            <div className="card-subtitle">Adjust to explore FAR / FRR tradeoffs</div>
            <div style={{ marginTop: 12 }}>
              <label>Face threshold: <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{faceThreshold.toFixed(2)}</span></label>
              <input type="range" min="0.1" max="0.9" step="0.01" value={faceThreshold}
                onChange={(e) => setFaceThreshold(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--accent)", marginTop: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>Strict (low FAR)</span><span>Permissive (low FRR)</span>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label>Fingerprint threshold: <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{fpThreshold.toFixed(2)}</span></label>
              <input type="range" min="0.1" max="0.99" step="0.01" value={fpThreshold}
                onChange={(e) => setFpThreshold(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--accent)", marginTop: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>Strict</span><span>Permissive</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Result */}
        <div>
          {status && <div className="alert alert-info" style={{ marginBottom: 16 }}>{status}</div>}

          {result ? (
            <div className="card">
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 52 }}>{decisionIcon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: decisionColor, marginTop: 8, fontFamily: "var(--mono)", textTransform: "uppercase" }}>
                  {result.decision}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {result.type} verification
                </div>
              </div>

              <div className="divider" />

              {result.type === "face" && (
                <>
                  <ScoreBar score={result.score} threshold={faceThreshold} label="Face Match Score" />
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                    Euclidean distance: {result.distance}
                  </div>
                </>
              )}

              {result.type === "fingerprint" && (
                <ScoreBar score={result.score} threshold={fpThreshold} label="Fingerprint Match Score" />
              )}

              {result.type === "multimodal" && (
                <>
                  <ScoreBar score={result.faceScore} threshold={faceThreshold} label="Face Score" />
                  <ScoreBar score={result.fpScore} threshold={fpThreshold} label="Fingerprint Score" />
                  <div style={{ marginTop: 12, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>FUSED SCORE</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: decisionColor, fontFamily: "var(--mono)" }}>
                      {(result.fusedScore * 100).toFixed(1)}%
                    </div>
                  </div>
                </>
              )}

              <div className="divider" />
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Threshold used: <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{result.threshold}</span>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--text-muted)", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 40 }}>🔐</span>
              <span style={{ fontSize: 13 }}>Verification result will appear here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
