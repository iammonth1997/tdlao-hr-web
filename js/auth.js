/** TDLAO HR - Auth Manager */

const AUTH_KEY = "tdlao_token";
const EMP_KEY  = "tdlao_emp";
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function saveAuth(empId, token) {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(EMP_KEY, empId);
  localStorage.setItem("tdlao_ts", Date.now().toString());
}

function getAuth() {
  const token = localStorage.getItem(AUTH_KEY);
  const empId = localStorage.getItem(EMP_KEY);
  const ts    = parseInt(localStorage.getItem("tdlao_ts") || "0");
  if (!token || !empId) return null;
  if (Date.now() - ts > TOKEN_TTL) {
    clearAuth();
    return null;
  }
  return { token, empId };
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(EMP_KEY);
  localStorage.removeItem("tdlao_ts");
}

function requireAuth() {
  const auth = getAuth();
  if (!auth) {
    window.location.href = "/web/login.html";
    return null;
  }
  // Refresh timestamp on activity
  localStorage.setItem("tdlao_ts", Date.now().toString());
  return auth;
}

function logout() {
  clearAuth();
  window.location.href = "/web/login.html";
}