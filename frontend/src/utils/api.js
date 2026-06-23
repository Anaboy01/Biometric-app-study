const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("bio_token");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // Auth
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login:    (body) => request("/auth/login",    { method: "POST", body: JSON.stringify(body) }),

  // Enroll
  enrollFace:        (body) => request("/enroll/face",        { method: "POST", body: JSON.stringify(body) }),
  enrollFingerprint: (body) => request("/enroll/fingerprint", { method: "POST", body: JSON.stringify(body) }),
  enrollStatus:      ()     => request("/enroll/status"),

  // Verify
  verifyFace:        (body) => request("/verify/face",        { method: "POST", body: JSON.stringify(body) }),
  verifyFingerprint: (body) => request("/verify/fingerprint", { method: "POST", body: JSON.stringify(body) }),
  verifyMultimodal:  (body) => request("/verify/multimodal",  { method: "POST", body: JSON.stringify(body) }),

  // Stats
  errorRates: () => request("/stats/error-rates"),
  history:    () => request("/stats/history"),
};
