import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../utils/api.js";

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.errorRates(), api.history()])
      .then(([rates, hist]) => { setData(rates); setHistory(hist.history); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading statistics…</div>;

  const rocData = data?.roc?.map((r) => ({
    threshold: r.threshold,
    FAR: +(r.FAR * 100).toFixed(2),
    FRR: +(r.FRR * 100).toFixed(2),
  })) || [];

  return (
    <div>
      <div className="page-header">
        <h1>Error Rate Analysis</h1>
        <p>FAR, FRR, and EER — key biometric performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="metric-grid" style={{ marginBottom: 28 }}>
        <div className="metric-card">
          <div className="label">Total Attempts</div>
          <div className="value" style={{ color: "var(--accent)" }}>{data?.totalAttempts ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="label">EER</div>
          <div className="value" style={{ color: "var(--warning)" }}>
            {data?.EER != null ? (data.EER * 100).toFixed(2) + "%" : "—"}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">EER Threshold</div>
          <div className="value" style={{ color: "var(--text)" }}>
            {data?.eerThreshold ?? "—"}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">Accepted</div>
          <div className="value" style={{ color: "var(--success)" }}>{data?.accepted ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="label">Rejected</div>
          <div className="value" style={{ color: "var(--danger)" }}>{data?.rejected ?? 0}</div>
        </div>
      </div>

      {/* Definitions */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {[
          { term: "FAR", full: "False Accept Rate", desc: "Proportion of impostor attempts incorrectly accepted. Lower is more secure.", color: "var(--danger)" },
          { term: "FRR", full: "False Reject Rate", desc: "Proportion of genuine attempts incorrectly rejected. Lower improves usability.", color: "var(--accent)" },
          { term: "EER", full: "Equal Error Rate", desc: "Point where FAR = FRR. Used to compare biometric systems — lower is better.", color: "var(--warning)" },
          { term: "ROC", full: "Receiver Operating Characteristic", desc: "Curve showing FAR vs FRR tradeoff across all thresholds.", color: "var(--success)" },
        ].map(({ term, full, desc, color }) => (
          <div className="card" key={term} style={{ borderLeft: `3px solid ${color}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color, fontSize: 16 }}>{term}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{full}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* ROC Chart */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-title">FAR vs FRR Curve</div>
        <div className="card-subtitle">Threshold sweep showing error rate tradeoffs — intersection = EER</div>

        {rocData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No match data yet. Complete some verifications to generate this chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rocData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="threshold" stroke="var(--text-muted)" tick={{ fontSize: 11, fontFamily: "var(--mono)" }} label={{ value: "Threshold", position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11, fontFamily: "var(--mono)" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--text-muted)" }}
                formatter={(val) => [`${val}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data?.eerThreshold && <ReferenceLine x={data.eerThreshold} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "EER", fill: "var(--warning)", fontSize: 11 }} />}
              <Line type="monotone" dataKey="FAR" stroke="var(--danger)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="FRR" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Match History Table */}
      <div className="card">
        <div className="card-title">Match History</div>
        <div className="card-subtitle">All verification attempts (latest first)</div>

        {history.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>No history yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Type", "Score", "Threshold", "Decision", "Time"].map((h) => (
                    <th key={h} style={{ padding: "8px 0", fontWeight: 500, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 0", fontFamily: "var(--mono)", fontSize: 11 }}>{h.type}</td>
                    <td style={{ padding: "10px 0", fontFamily: "var(--mono)" }}>{h.score?.toFixed(4)}</td>
                    <td style={{ padding: "10px 0", fontFamily: "var(--mono)" }}>{h.threshold?.toFixed(2)}</td>
                    <td style={{ padding: "10px 0" }}>
                      <span className={`badge ${h.decision === "accept" ? "badge-success" : "badge-danger"}`}>{h.decision}</span>
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--text-muted)", fontSize: 11 }}>
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
