/** TDLAO HR - Auth Manager */

const AUTH_KEY = "tdlao_token";
const EMP_KEY  = "tdlao_emp";
const EXP_KEY = "tdlao_exp";
const TS_KEY = "tdlao_ts";
const TOKEN_TTL = 8 * 60 * 60 * 1000; // 8 hours

function saveAuth(empId, token, expiresInSec = 8 * 60 * 60) {
  const now = Date.now();
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(EMP_KEY, empId);
  localStorage.setItem(EXP_KEY, (now + (Number(expiresInSec) * 1000)).toString());
  localStorage.setItem(TS_KEY, now.toString());
}

function getAuth() {
  const token = localStorage.getItem(AUTH_KEY);
  const empId = localStorage.getItem(EMP_KEY);
  const exp   = parseInt(localStorage.getItem(EXP_KEY) || "0", 10);
  const ts    = parseInt(localStorage.getItem(TS_KEY) || "0", 10);
  const now   = Date.now();
  const validByExp = exp > 0 ? now < exp : (ts > 0 && now - ts < TOKEN_TTL);

  if (!token || !empId) return null;
  if (!validByExp) {
    clearAuth();
    return null;
  }
  return { token, empId };
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(EMP_KEY);
  localStorage.removeItem(EXP_KEY);
  localStorage.removeItem(TS_KEY);
}

function requireAuth() {
  const auth = getAuth();
  if (!auth) {
    window.location.replace("/web/login.html");
    return null;
  }
  // Refresh timestamp on activity
  localStorage.setItem(TS_KEY, Date.now().toString());
  return auth;
}

function logout() {
  clearAuth();
  window.location.replace("/web/login.html");
}
