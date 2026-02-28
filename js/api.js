/** TDLAO HR API - Frontend Connector */

const WORKER_API     = "https://tdlao-api.iammonth1997.workers.dev/";
const AUTH_WORKER_API = "https://login-supabase-api.iammonth1997.workers.dev/";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGhWYfjV1vX3yl6OcROs17PZX8tZi7luapo4zV2K-iEj46u9prmehiR0WqK6LJMx_1gA/exec";
const SUPABASE_URL = "https://hokthzztcijvgnvcgkms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SnfPbihz94Zt2aOYDA91hw_1cCGTXDF";
const DEVICE_KEY = "tdlao_device_id";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function fetchJSON(url, init = {}) {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch (err) {
    return "";
  }
}

/** Always inject empId + token from localStorage */
function getAuthParams() {
  const token = localStorage.getItem("tdlao_token");
  const empId = localStorage.getItem("tdlao_emp");
  const exp = parseInt(localStorage.getItem("tdlao_exp") || "0", 10);
  const ts = parseInt(localStorage.getItem("tdlao_ts") || "0", 10);
  const now = Date.now();
  const validByExp = exp > 0 ? now < exp : (ts > 0 && now - ts < SESSION_TTL_MS);

  if (!token || !empId || !validByExp) {
    localStorage.removeItem("tdlao_token");
    localStorage.removeItem("tdlao_emp");
    localStorage.removeItem("tdlao_exp");
    localStorage.removeItem("tdlao_ts");
    return null;
  }

  localStorage.setItem("tdlao_ts", now.toString());
  return { emp: empId, token, device_id: getOrCreateDeviceId() };
}

async function apiFetchWorker(endpoint, params = {}, authToken = "") {
  const query = new URLSearchParams(params).toString();
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  return await fetchJSON(
    `${WORKER_API}${endpoint}?${query}`,
    headers ? { headers } : {}
  );
}

async function apiPostAuth(action, payload = {}) {
  try {
    const res = await fetch(`${AUTH_WORKER_API}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function apiFetchAppsScript(action, params = {}, authToken = "") {
  const query = new URLSearchParams({ action, endpoint: action, type: action, ...params }).toString();
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  return await fetchJSON(
    `${APPS_SCRIPT_URL}?${query}`,
    headers ? { headers } : {}
  );
}

function normalizePayMonth(month, year) {
  const y = String(year || "").trim();
  const m = Number(month);
  if (!y || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

function hasValue(v) {
  return v !== undefined && v !== null && v !== "";
}

function buildEmployeeName(row) {
  const engName = pickValue(row, ["name_eng", "full_name", "employee_name"]);
  if (hasValue(engName)) return engName;

  const localName = [row.prefix, row.first_name, row.last_name]
    .filter(hasValue)
    .join(" ")
    .trim();
  return localName || null;
}

function mapEmployeeRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    name: buildEmployeeName(row),
    empcode: pickValue(row, ["emp_id", "employee_id", "empcode"]),
    position: pickValue(row, ["position", "job_title"]),
    department: pickValue(row, ["department", "dept", "department_name"])
  };
}

function mergeEmployeeProfile(data, profile, preferProfile = false) {
  if (!data || data.error || !profile) return data;
  const merged = { ...data };
  const keys = ["name", "empcode", "position", "department"];

  for (const key of keys) {
    const baseVal = merged[key];
    const profileVal = profile[key];
    merged[key] = preferProfile
      ? (hasValue(profileVal) ? profileVal : baseVal)
      : (hasValue(baseVal) ? baseVal : profileVal);
  }

  return merged;
}

async function fetchEmployeeFromSupabase(empId) {
  const emp = String(empId || "").trim().toUpperCase();
  if (!emp) return { error: "Missing employee id" };

  const query = new URLSearchParams({
    select: "*",
    emp_id: `eq.${emp}`,
    limit: "1"
  });

  try {
    const jwtToken = localStorage.getItem("tdlao_token") || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?${query.toString()}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwtToken}`
      }
    });

    if (!res.ok) {
      const detail = await res.text();
      return { error: `Supabase employees error (${res.status}): ${detail || res.statusText}` };
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: "Employee not found" };
    }

    return mapEmployeeRow(rows[0]);
  } catch (err) {
    return { error: err.message || "Supabase employees request failed" };
  }
}

async function enrichWithEmployeeProfile(data, empId, preferProfile = false) {
  if (!data || data.error || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const profile = await fetchEmployeeFromSupabase(empId);
  if (!profile || profile.error) return data;
  return mergeEmployeeProfile(data, profile, preferProfile);
}

function mapMonthlyPayrollRow(row) {
  const empId = pickValue(row, ["emp_id", "empcode", "employee_id"]);
  return {
    name:         pickValue(row, ["name", "emp_name", "employee_name", "full_name"]) || empId,
    empcode:      empId,
    position:     pickValue(row, ["position", "job_title"]),
    department:   pickValue(row, ["department", "dept", "department_name"]),
    salary:       pickValue(row, ["salary", "salary_paid", "base_salary"]),
    shift:        pickValue(row, ["shift", "shift_allowance"]),
    skill:        pickValue(row, ["skill", "skill_allowance"]),
    welfare:      pickValue(row, ["welfare", "other_benefits"]),
    misc:         pickValue(row, ["misc", "other_income"]),
    total_income: pickValue(row, ["total_income", "gross_income"]),
    sso:          pickValue(row, ["sso", "sso_deduction"]),
    tax:          pickValue(row, ["tax", "tax_deduction"]),
    deduct_other: pickValue(row, ["deduct_other", "other_deductions"]),
    total_deduct: pickValue(row, ["total_deduct", "total_deductions"]),
    net:          pickValue(row, ["net", "net_salary", "netpay"]),
    working_days: pickValue(row, ["working_days"]),
    pay_month:    pickValue(row, ["pay_month"])
  };
}

async function fetchSalaryFromSupabase(params = {}) {
  const emp = String(params.emp || localStorage.getItem("tdlao_emp") || "").trim().toUpperCase();
  if (!emp) return { error: "Missing employee id" };

  const payMonth = normalizePayMonth(params.month, params.year);
  const query = new URLSearchParams({
    select: "*",
    emp_id: `eq.${emp}`,
    order: "pay_month.desc",
    limit: "1"
  });

  if (payMonth) {
    query.set("pay_month", `eq.${payMonth}`);
  }

  try {
    const jwtToken = localStorage.getItem("tdlao_token") || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/monthly_payroll?${query.toString()}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwtToken}`
      }
    });

    if (!res.ok) {
      const detail = await res.text();
      return { error: `Supabase salary error (${res.status}): ${detail || res.statusText}` };
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: "No salary data found" };
    }

    const payrollData = mapMonthlyPayrollRow(rows[0]);
    return await enrichWithEmployeeProfile(payrollData, emp, true);
  } catch (err) {
    return { error: err.message || "Supabase request failed" };
  }
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
  const isAuthAction = action === "login" || action === "check" || action === "register";

  // Inject auth automatically (except for pre-auth actions)
  if (!isAuthAction) {
    const auth = getAuthParams();
    if (!auth) {

      return { error: "Not authenticated" };
    }
    params = { ...auth, ...params };
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  let authToken = "";

  if (!isAuthAction) {
    authToken = String(cleanParams.token || "");
    delete cleanParams.token;
  }

  if (action === "login" && !cleanParams.device_id) {
    cleanParams.device_id = getOrCreateDeviceId();
  }

  if (action === "salary" || action === "getSalarySlip") {
    return await fetchSalaryFromSupabase(cleanParams);
  }

  const endpoint = ENDPOINT_MAP[action] || action;

  if (action === "login" || action === "check" || action === "register") {
    return await apiPostAuth(action, cleanParams);
  }

  // Try Worker first, fallback to Apps Script
  const shouldEnrich = action !== "login" && !String(action).includes("pdf");

  const workerData = await apiFetchWorker(endpoint, cleanParams, authToken);
  if (workerData && !workerData.error) {
    return shouldEnrich
      ? await enrichWithEmployeeProfile(workerData, cleanParams.emp, true)
      : workerData;
  }

  const scriptData = await apiFetchAppsScript(endpoint, cleanParams, authToken);
  if (scriptData && !scriptData.error) {
    return shouldEnrich
      ? await enrichWithEmployeeProfile(scriptData, cleanParams.emp, true)
      : scriptData;
  }

  return { error: scriptData?.error || workerData?.error || "API request failed" };
}

/** Convenience wrappers */
async function loadDayWork(emp, month, year)  { return await callAPI("daywork", { emp, month, year }); }
async function loadOT(emp, month, year)       { return await callAPI("ot",      { emp, month, year }); }
async function loadSalarySlip(emp, month, year){ return await callAPI("salary",  { emp, month, year }); }
async function loadOTSlip(emp, month, year)   { return await callAPI("otslip",  { emp, month, year }); }

console.log("TDLAO HR API loaded");
