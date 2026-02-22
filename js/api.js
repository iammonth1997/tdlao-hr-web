/** TDLAO HR API - Frontend Connector */

const WORKER_API     = "https://tdlao-api.iammonth1997.workers.dev/";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSAu53R-6U8kPfFk8oIfwDk2ofCy_maGjfcotT7P3UvB05ohujiblJYtentnsRPYWmNw/exec";

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

/** Always inject empId + token from localStorage */
function getAuthParams() {
  const token = localStorage.getItem("tdlao_token");
  const empId = localStorage.getItem("tdlao_emp");
  if (!token || !empId) return null;
  return { emp: empId, token };
}

async function apiFetchWorker(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  return await fetchJSON(`${WORKER_API}${endpoint}?${query}`);
}

async function apiFetchAppsScript(action, params = {}) {
  const query = new URLSearchParams({ action, endpoint: action, type: action, ...params }).toString();
  return await fetchJSON(`${APPS_SCRIPT_URL}?${query}`);
}

const ENDPOINT_MAP = {
  daywork:          "daywork",
  getDayWork:       "daywork",
  ot:               "ot",
  getOT:            "ot",
  salary:           "salary",
  getSalarySlip:    "salary",
  otslip:           "otslip",
  getOTSlip:        "otslip",
  getSalarySlipPDF: "salary-pdf",
  getOTSlipPDF:     "otslip-pdf",
  login:            "login"
};

async function callAPI(action, params = {}) {
  // Inject auth automatically (except for login itself)
  if (action !== "login") {
    const auth = getAuthParams();
    if (!auth) {
      window.location.href = "/web/login.html";
      return { error: "Not authenticated" };
    }
    params = { ...auth, ...params };
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

  const endpoint = ENDPOINT_MAP[action] || action;

  // Try Worker first, fallback to Apps Script
  const workerData = await apiFetchWorker(endpoint, cleanParams);
  if (workerData && !workerData.error) return workerData;

  const scriptData = await apiFetchAppsScript(endpoint, cleanParams);
  if (scriptData && !scriptData.error) return scriptData;

  return { error: scriptData?.error || workerData?.error || "API request failed" };
}

/** Convenience wrappers */
async function loadDayWork(emp, month, year)  { return await callAPI("daywork", { emp, month, year }); }
async function loadOT(emp, month, year)       { return await callAPI("ot",      { emp, month, year }); }
async function loadSalarySlip(emp, month, year){ return await callAPI("salary",  { emp, month, year }); }
async function loadOTSlip(emp, month, year)   { return await callAPI("otslip",  { emp, month, year }); }

console.log("TDLAO HR API loaded");