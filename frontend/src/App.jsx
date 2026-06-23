import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./utils/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import EnrollPage from "./pages/EnrollPage.jsx";
import VerifyPage from "./pages/VerifyPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" />;

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h2>BioAuth</h2>
          <span>Biometric Lab v1.0</span>
        </div>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          📊 Dashboard
        </NavLink>
        <NavLink to="/enroll" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          🪪 Enroll
        </NavLink>
        <NavLink to="/verify" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          🔐 Verify
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          📈 Error Rates
        </NavLink>
        <div style={{ marginTop: "auto", padding: "0 20px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontFamily: "var(--mono)" }}>
            {user.username}
          </div>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/enroll"    element={<EnrollPage />} />
          <Route path="/verify"    element={<VerifyPage />} />
          <Route path="/stats"     element={<StatsPage />} />
          <Route path="*"          element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*"     element={<Layout />} />
      </Routes>
    </AuthProvider>
  );
}
