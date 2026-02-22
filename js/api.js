/** TDLAO HR API - Frontend Connector */

const WORKER_API = "https://tdlao-api.iammonth1997.workers.dev/";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwSAu53R-6U8kPfFk8oIfwDk2ofCy_maGjfcotT7P3UvB05ohujiblJYtentnsRPYWmNw/exec";

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function apiFetchWorker(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${WORKER_API}${endpoint}?${query}`;
  return await fetchJSON(url);
}

async function apiFetchAppsScript(action, params = {}) {
  const query = new URLSearchParams({
    action,
    endpoint: action,
    type: action,
    ...params
  }).toString();
  const url = `${APPS_SCRIPT_URL}?${query}`;
  return await fetchJSON(url);
}

const ENDPOINT_MAP = {
  daywork: "daywork",
  getDayWork: "daywork",
  ot: "ot",
  getOT: "ot",
  salary: "salary",
  getSalarySlip: "salary",
  otslip: "otslip",
  getOTSlip: "otslip",
  getSalarySlipPDF: "salary-pdf",
  getOTSlipPDF: "otslip-pdf"
};

async function callAPI(action, params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

  const candidates = [];
  if (ENDPOINT_MAP[action]) {
    candidates.push(ENDPOINT_MAP[action]);
  }
  if (!candidates.includes(action)) {
    candidates.push(action);
  }

  let lastError = "";
  for (const endpoint of candidates) {
    const workerData = await apiFetchWorker(endpoint, cleanParams);
    if (workerData && !workerData.error) {
      return workerData;
    }
    lastError = (workerData && workerData.error) || `No data from worker:${endpoint}`;

    const scriptData = await apiFetchAppsScript(endpoint, cleanParams);
    if (scriptData && !scriptData.error) {
      return scriptData;
    }
    lastError = (scriptData && scriptData.error) || `No data from appscript:${endpoint}`;
  }

  return { error: lastError || "API request failed" };
}

async function loadDayWork(emp, month, year) {
  return await callAPI("daywork", { emp, month, year });
}

async function loadOT(emp, month, year) {
  return await callAPI("ot", { emp, month, year });
}

async function loadSalarySlip(emp, month, year) {
  return await callAPI("salary", { emp, month, year });
}

async function loadOTSlip(emp, month, year) {
  return await callAPI("otslip", { emp, month, year });
}

console.log("TDLAO HR API loaded");
