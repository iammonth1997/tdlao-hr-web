/**
 * Cloudflare Worker Auth API
 * Actions: check, register, login, seed, verify
 * Auth model: emp_id + DOB verification + self-set PIN + device binding
 */

const PIN_ITERATIONS = 100000;
const PIN_KEY_BYTES = 32;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const GENERIC_LOGIN_ERROR = "Invalid Employee ID or PIN";

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      assertRequiredEnv(env);
      const { action, payload } = await parseRequest(request);

      if (!action) return json({ error: "Missing action" }, 400, corsHeaders);

      if (action === "check") {
        return await handleCheck(request, env, payload, corsHeaders);
      }
      if (action === "register") {
        return await handleRegister(request, env, payload, corsHeaders);
      }
      if (action === "login") {
        return await handleLogin(request, env, payload, corsHeaders);
      }
      if (action === "seed") {
        return await handleSeed(request, env, payload, corsHeaders);
      }
      if (action === "verify") {
        return await handleVerify(request, env, payload, corsHeaders);
      }

      return json({ error: "Unknown action" }, 404, corsHeaders);
    } catch (err) {
      console.error("Worker fatal error:", err);
      return json({ error: "Internal server error" }, 500, corsHeaders);
    }
  }
};

function buildCorsHeaders(env) {
  return {
    "access-control-allow-origin": env.CORS_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-seed-key",
    "access-control-max-age": "86400",
    "cache-control": "no-store"
  };
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function assertRequiredEnv(env) {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PIN_PEPPER", "JWT_SECRET"];
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing env: ${key}`);
    }
  }
}

async function parseRequest(request) {
  const url = new URL(request.url);
  const pathAction = url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  let body = {};
  const contentType = request.headers.get("content-type") || "";
  if (request.method !== "GET" && contentType.includes("application/json")) {
    body = await request.json().catch(() => ({}));
  }

  const payload = { ...body };
  for (const [k, v] of url.searchParams.entries()) {
    if (!(k in payload)) payload[k] = v;
  }

  const action = String(payload.action || pathAction || "").trim().toLowerCase();
  delete payload.action;
  return { action, payload };
}

function normalizeEmpId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePin(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeDeviceId(value) {
  return String(value || "").trim();
}

function isValidEmpId(empId) {
  return /^[A-Z0-9_-]{4,32}$/.test(empId);
}

function isValidPin(pin) {
  return /^\d{6}$/.test(pin);
}

function isValidDeviceId(deviceId) {
  return deviceId.length >= 8 && deviceId.length <= 256;
}

function readClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

async function rateLimitKV(env, key, limit, windowSeconds) {
  if (!env.AUTH_RATE_LIMIT_KV) return false;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const kvKey = `auth_rl:${key}:${bucket}`;
  const current = Number((await env.AUTH_RATE_LIMIT_KV.get(kvKey)) || "0");
  if (current >= limit) return true;
  await env.AUTH_RATE_LIMIT_KV.put(kvKey, String(current + 1), {
    expirationTtl: windowSeconds + 5
  });
  return false;
}

async function supabaseRequest(env, table, options = {}) {
  const method = options.method || "GET";
  const query = options.query || null;
  const body = options.body;
  const prefer = options.prefer || null;

  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`);
  if (query instanceof URLSearchParams) {
    url.search = query.toString();
  } else if (query && typeof query === "object") {
    url.search = new URLSearchParams(query).toString();
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
  if (prefer) headers.Prefer = prefer;
  if (method !== "GET" && method !== "HEAD") {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? safeJSONParse(text) : null;

  if (!res.ok) {
    const message = (data && (data.message || data.error || data.hint)) || text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data || text;
    throw err;
  }

  return data;
}

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePbkdf2Bytes(secret, saltBytes, iterations, keyBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    keyMaterial,
    keyBytes * 8
  );
  return new Uint8Array(derivedBits);
}

async function hashPin(pin, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePbkdf2Bytes(`${pin}:${pepper}`, salt, PIN_ITERATIONS, PIN_KEY_BYTES);
  return `pbkdf2$sha256$${PIN_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

async function verifyPin(pin, encodedHash, pepper) {
  const parts = String(encodedHash || "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    // Legacy compatibility:
    // - sha256(pin)
    // - sha256(pin:pepper)
    const legacy = String(encodedHash || "").trim().toLowerCase();
    const legacyA = await sha256Hex(pin);
    const legacyB = await sha256Hex(`${pin}:${pepper}`);
    const a = encoder.encode(legacy);
    const b = encoder.encode(legacyA);
    const c = encoder.encode(legacyB);
    return timingSafeEqualBytes(a, b) || timingSafeEqualBytes(a, c);
  }

  const iterations = Number(parts[2]);
  const salt = fromBase64Url(parts[3]);
  const expected = fromBase64Url(parts[4]);
  if (!iterations || !salt.length || !expected.length) return false;

  const actual = await derivePbkdf2Bytes(`${pin}:${pepper}`, salt, iterations, expected.length);
  return timingSafeEqualBytes(actual, expected);
}

async function hashDeviceBinding(empId, deviceId, pepper) {
  return await sha256Hex(`${pepper}|${empId}|${deviceId}`);
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = toBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, error: "Invalid token format" };

  const [headerB64, payloadB64, sigB64] = parts;
  const unsigned = `${headerB64}.${payloadB64}`;

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSig = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(unsigned));
  const expectedSigB64 = toBase64Url(new Uint8Array(expectedSig));

  const a = encoder.encode(expectedSigB64);
  const b = encoder.encode(sigB64);
  if (!timingSafeEqualBytes(a, b)) {
    return { ok: false, error: "Invalid token signature" };
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
  } catch {
    return { ok: false, error: "Invalid token payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return { ok: false, error: "Token expired" };
  }

  return { ok: true, payload };
}

async function getEmployee(env, empId) {
  const query = new URLSearchParams({
    select: "emp_id,status,dob",
    emp_id: `eq.${empId}`,
    limit: "1"
  });
  const rows = await supabaseRequest(env, "employees", { method: "GET", query });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}


async function getLoginUser(env, empId) {
  const query = new URLSearchParams({
    select: "emp_id,pin_hash,device_id_hash",
    emp_id: `eq.${empId}`,
    limit: "1"
  });
  const rows = await supabaseRequest(env, "login_users", { method: "GET", query });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function upsertLoginUser(env, row) {
  const payload = [{
    emp_id: row.emp_id,
    pin_hash: row.pin_hash,
    device_id_hash: row.device_id_hash
  }];
  const query = new URLSearchParams({ on_conflict: "emp_id" });
  return await supabaseRequest(env, "login_users", {
    method: "POST",
    query,
    body: payload,
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

async function persistSessionIfEnabled(env, session) {
  if (env.STORE_LOGIN_SESSIONS !== "1") return;
  const tokenPepper = env.SESSION_TOKEN_PEPPER || env.JWT_SECRET;
  const tokenHash = await sha256Hex(`${tokenPepper}|${session.token}`);

  try {
    await supabaseRequest(env, "login_sessions", {
      method: "POST",
      body: [{
        emp_id: session.emp_id,
        device_id_hash: session.device_id_hash,
        token_hash: tokenHash,
        expires_at: session.expires_at
      }],
      prefer: "return=minimal"
    });
  } catch (err) {
    // Session persistence is optional. Do not fail login if table is absent.
    console.warn("persistSessionIfEnabled skipped:", err.message || err);
  }
}

async function handleCheck(request, env, payload, corsHeaders) {
  const empId = normalizeEmpId(payload.emp_id || payload.emp);
  if (!isValidEmpId(empId)) return json({ error: "Invalid emp_id" }, 400, corsHeaders);

  const ip = readClientIp(request);
  const limited = await rateLimitKV(env, `check:${ip}`, 30, 300);
  if (limited) return json({ error: "Too many requests" }, 429, corsHeaders);

  const employee = await getEmployee(env, empId);
  if (!employee) return json({ exists: false }, 200, corsHeaders);

  const active = employee.status !== "ลาออก";

  let registered = false;
  try {
    const user = await getLoginUser(env, empId);
    registered = !!(user && user.pin_hash);
  } catch {}

  return json({ exists: true, active, registered }, 200, corsHeaders);
}

async function handleRegister(request, env, payload, corsHeaders) {
  const empId = normalizeEmpId(payload.emp_id || payload.emp);
  const pin = normalizePin(payload.pin);
  const deviceId = normalizeDeviceId(payload.device_id);
  const dob = String(payload.dob || "").trim(); // expected: YYYY-MM-DD

  if (!isValidEmpId(empId)) return json({ error: "Invalid emp_id" }, 400, corsHeaders);
  if (!isValidPin(pin)) return json({ error: "PIN must be 6 digits" }, 400, corsHeaders);
  if (!isValidDeviceId(deviceId)) return json({ error: "Invalid device_id" }, 400, corsHeaders);
  if (!dob) return json({ error: "Date of birth required" }, 400, corsHeaders);

  const ip = readClientIp(request);
  const limited = await rateLimitKV(env, `register:${ip}`, 20, 300);
  if (limited) return json({ error: "Too many requests" }, 429, corsHeaders);

  const employee = await getEmployee(env, empId);
  if (!employee) return json({ error: "Employee not found" }, 404, corsHeaders);

  if (employee.status === "ลาออก") {
    return json({ error: "Account suspended", code: "RESIGNED" }, 403, corsHeaders);
  }

  // Verify date of birth
  const empDob = String(employee.dob || "").trim().slice(0, 10);
  if (!empDob || empDob !== dob) {
    await sleep(300);
    return json({ error: "Date of birth does not match", code: "DOB_MISMATCH" }, 401, corsHeaders);
  }

  // Block if already registered (must use login)
  const existing = await getLoginUser(env, empId);
  if (existing && existing.pin_hash) {
    return json({ error: "Already registered. Please login.", code: "ALREADY_REGISTERED" }, 409, corsHeaders);
  }

  const pinHash = await hashPin(pin, env.PIN_PEPPER);
  const deviceHash = await hashDeviceBinding(empId, deviceId, env.PIN_PEPPER);

  await upsertLoginUser(env, {
    emp_id: empId,
    pin_hash: pinHash,
    device_id_hash: deviceHash
  });

  // Auto-login after successful registration
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_SECONDS;
  const payloadJwt = { sub: empId, did: deviceHash, iat: now, exp, jti: crypto.randomUUID() };
  const token = await signJwt(payloadJwt, env.JWT_SECRET);

  await persistSessionIfEnabled(env, {
    token, emp_id: empId, device_id_hash: deviceHash,
    expires_at: new Date(exp * 1000).toISOString()
  });

  return json({ ok: true, token, token_type: "Bearer", expires_in: SESSION_TTL_SECONDS, emp_id: empId }, 200, corsHeaders);
}

async function handleLogin(request, env, payload, corsHeaders) {
  const empId = normalizeEmpId(payload.emp_id || payload.emp);
  const pin = normalizePin(payload.pin);
  const deviceId = normalizeDeviceId(payload.device_id);

  if (!isValidEmpId(empId) || !isValidPin(pin) || !isValidDeviceId(deviceId)) {
    await sleep(250);
    return json({ error: GENERIC_LOGIN_ERROR }, 401, corsHeaders);
  }

  const ip = readClientIp(request);
  const ipLimited = await rateLimitKV(env, `login-ip:${ip}`, 30, 300);
  const empLimited = await rateLimitKV(env, `login-emp:${empId}`, 8, 300);
  if (ipLimited || empLimited) {
    return json({ error: "Too many login attempts" }, 429, corsHeaders);
  }

  // Block resigned employees
  let employee = null;
  try {
    employee = await getEmployee(env, empId);
  } catch (err) {
    console.error("login employee lookup error:", err);
    return json({ error: "Auth service unavailable" }, 503, corsHeaders);
  }
  if (!employee || employee.status === "ลาออก") {
    await sleep(300);
    return json({ error: GENERIC_LOGIN_ERROR }, 401, corsHeaders);
  }

  let user = null;
  try {
    user = await getLoginUser(env, empId);
  } catch (err) {
    console.error("login lookup error:", err);
    return json({ error: "Auth service unavailable" }, 503, corsHeaders);
  }

  if (!user || !user.pin_hash) {
    await sleep(300);
    return json({ error: GENERIC_LOGIN_ERROR }, 401, corsHeaders);
  }

  const pinOk = await verifyPin(pin, user.pin_hash, env.PIN_PEPPER);
  if (!pinOk) {
    await sleep(300);
    return json({ error: GENERIC_LOGIN_ERROR }, 401, corsHeaders);
  }

  const incomingDeviceHash = await hashDeviceBinding(empId, deviceId, env.PIN_PEPPER);

  // Upgrade legacy hash formats to pbkdf2 on successful login.
  if (!String(user.pin_hash || "").startsWith("pbkdf2$sha256$")) {
    try {
      const upgradedPinHash = await hashPin(pin, env.PIN_PEPPER);
      await upsertLoginUser(env, {
        emp_id: empId,
        pin_hash: upgradedPinHash,
        device_id_hash: user.device_id_hash || incomingDeviceHash
      });
      user.pin_hash = upgradedPinHash;
    } catch (err) {
      console.warn("pin hash upgrade skipped:", err.message || err);
    }
  }

  if (!user.device_id_hash) {
    // First successful login can auto-bind if row was seeded without a device.
    await upsertLoginUser(env, {
      emp_id: empId,
      pin_hash: user.pin_hash,
      device_id_hash: incomingDeviceHash
    });
  } else if (user.device_id_hash !== incomingDeviceHash) {
    return json({ error: "Device mismatch", code: "DEVICE_MISMATCH" }, 403, corsHeaders);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_SECONDS;
  const payloadJwt = {
    sub: empId,
    did: incomingDeviceHash,
    iat: now,
    exp,
    jti: crypto.randomUUID()
  };
  const token = await signJwt(payloadJwt, env.JWT_SECRET);

  await persistSessionIfEnabled(env, {
    token,
    emp_id: empId,
    device_id_hash: incomingDeviceHash,
    expires_at: new Date(exp * 1000).toISOString()
  });

  return json({
    token,
    token_type: "Bearer",
    expires_in: SESSION_TTL_SECONDS,
    emp_id: empId
  }, 200, corsHeaders);
}

async function handleSeed(request, env, payload, corsHeaders) {
  const seedKey = request.headers.get("x-seed-key") || String(payload.seed_key || "");
  if (!env.SEED_ADMIN_KEY || seedKey !== env.SEED_ADMIN_KEY) {
    return json({ error: "Forbidden" }, 403, corsHeaders);
  }

  const records = Array.isArray(payload.records) ? payload.records : [payload];
  if (!records.length) return json({ error: "No records" }, 400, corsHeaders);
  if (records.length > 500) return json({ error: "Too many records" }, 400, corsHeaders);

  let ok = 0;
  const errors = [];

  for (const rec of records) {
    const empId = normalizeEmpId(rec.emp_id || rec.emp);
    const pin = normalizePin(rec.pin);
    const deviceId = normalizeDeviceId(rec.device_id || "");

    if (!isValidEmpId(empId) || !isValidPin(pin)) {
      errors.push({ emp_id: empId || null, error: "Invalid emp_id or pin" });
      continue;
    }

    try {
      const pinHash = await hashPin(pin, env.PIN_PEPPER);
      const deviceHash = deviceId ? await hashDeviceBinding(empId, deviceId, env.PIN_PEPPER) : null;
      await upsertLoginUser(env, {
        emp_id: empId,
        pin_hash: pinHash,
        device_id_hash: deviceHash
      });
      ok += 1;
    } catch (err) {
      errors.push({ emp_id: empId, error: err.message || "Seed failed" });
    }
  }

  return json({ ok, failed: errors.length, errors }, 200, corsHeaders);
}

async function handleVerify(request, env, payload, corsHeaders) {
  const auth = request.headers.get("authorization") || "";
  const bearerToken = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const token = String(payload.token || bearerToken || "").trim();
  const deviceId = normalizeDeviceId(payload.device_id || "");

  if (!token) return json({ error: "Missing token" }, 401, corsHeaders);

  const verified = await verifyJwt(token, env.JWT_SECRET);
  if (!verified.ok) return json({ error: verified.error || "Invalid token" }, 401, corsHeaders);

  if (deviceId) {
    const deviceHash = await hashDeviceBinding(verified.payload.sub, deviceId, env.PIN_PEPPER);
    if (deviceHash !== verified.payload.did) {
      return json({ error: "Device mismatch", code: "DEVICE_MISMATCH" }, 403, corsHeaders);
    }
  }

  return json({
    ok: true,
    emp_id: verified.payload.sub,
    exp: verified.payload.exp
  }, 200, corsHeaders);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
