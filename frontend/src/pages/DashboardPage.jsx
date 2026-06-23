import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import { api } from "../utils/api.js";

export default function DashboardPage() {
  const { user, updateEnrolled } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.enrollStatus(), api.errorRates(), api.history()])
      .then(([status, rates, hist]) => {
        updateEnrolled(status.enrolled);
        setStats(rates);
        setHistory(hist.history.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const enrolled = user?.enrolled || {};

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, <strong>{user?.username}</strong> — biometric lab overview</p>
      </div>

      {/* Enrollment Status */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="card-title">Face Recognition</div>
              <div className="card-subtitle">128-dim descriptor via face-api.js</div>
            </div>
            <span style={{ fontSize: 28 }}>👤</span>
          </div>
          <span className={`badge ${enrolled.face ? "badge-success" : "badge-danger"}`}>
            {enrolled.face ? "✓ Enrolled" : "✗ Not Enrolled"}
          </span>
          {!enrolled.face && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={() => navigate("/enroll")}>Enroll Face</button>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="card-title">Fingerprint</div>
              <div className="card-subtitle">Statistical feature extraction</div>
            </div>
            <span style={{ fontSize: 28 }}>🖐️</span>
          </div>
          <span className={`badge ${enrolled.fingerprint ? "badge-success" : "badge-danger"}`}>
            {enrolled.fingerprint ? "✓ Enrolled" : "✗ Not Enrolled"}
          </span>
          {!enrolled.fingerprint && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={() => navigate("/enroll")}>Enroll Fingerprint</button>
            </div>
          )}
        </div>
      </div>

      {/* Error Rate Metrics */}
      {!loading && stats && (
        <>
          <div className="metric-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <div className="label">Total Attempts</div>
              <div className="value" style={{ color: "var(--accent)" }}>{stats.totalAttempts ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="label">Accepted</div>
              <div className="value" style={{ color: "var(--success)" }}>{stats.accepted ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="label">Rejected</div>
              <div className="value" style={{ color: "var(--danger)" }}>{stats.rejected ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="label">EER</div>
              <div className="value" style={{ color: "var(--warning)" }}>
                {stats.EER != null ? (stats.EER * 100).toFixed(1) + "%" : "—"}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Match History */}
      <div className="card">
        <div className="card-title">Recent Verification Attempts</div>
        <div className="card-subtitle">Last 5 match events</div>

        {history.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
            No verification attempts yet. Go to <strong>Verify</strong> to test biometric matching.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "8px 0", fontWeight: 500 }}>Type</th>
                <th style={{ padding: "8px 0", fontWeight: 500 }}>Score</th>
                <th style={{ padding: "8px 0", fontWeight: 500 }}>Threshold</th>
                <th style={{ padding: "8px 0", fontWeight: 500 }}>Decision</th>
                <th style={{ padding: "8px 0", fontWeight: 500 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 0", fontFamily: "var(--mono)", fontSize: 12 }}>{h.type}</td>
                  <td style={{ padding: "10px 0", fontFamily: "var(--mono)" }}>{h.score?.toFixed(3)}</td>
                  <td style={{ padding: "10px 0", fontFamily: "var(--mono)" }}>{h.threshold?.toFixed(2)}</td>
                  <td style={{ padding: "10px 0" }}>
                    <span className={`badge ${h.decision === "accept" ? "badge-success" : "badge-danger"}`}>
                      {h.decision}
                    </span>
                  </td>
                  <td style={{ padding: "10px 0", color: "var(--text-muted)", fontSize: 11 }}>
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
