import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api.js";
import { useAuth } from "../utils/AuthContext.jsx";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = mode === "login"
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      login(res.user, res.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", letterSpacing: -1 }}>BioAuth Lab</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Biometric Authentication System</p>
        </div>

        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {["login", "register"].map((m) => (
              <button key={m} className={`btn ${mode === m ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1, justifyContent: "center" }} onClick={() => setMode(m)}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "register" && (
              <div>
                <label>Username</label>
                <input className="input" name="username" placeholder="johndoe" value={form.username} onChange={handle} />
              </div>
            )}
            <div>
              <label>Email</label>
              <input className="input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handle} />
            </div>
            <div>
              <label>Password</label>
              <input className="input" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handle} />
            </div>
          </div>

          {error && <div className="alert alert-danger" style={{ marginTop: 16 }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
            onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
