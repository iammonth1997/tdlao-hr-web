# Worker Auth API

This worker provides `register`, `login`, `seed`, and `verify` actions for:
- `emp_id + PIN` login
- strict device binding via `device_id_hash`
- JWT access token (no email/password flow)

## Required env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PIN_PEPPER`
- `JWT_SECRET`

## Optional env vars

- `CORS_ORIGIN` (default `*`)
- `SEED_ADMIN_KEY` (required for `seed` action)
- `DEVICE_REBIND_KEY` (required for forced rebind in `register`)
- `STORE_LOGIN_SESSIONS` (`1` to persist into `login_sessions`)
- `SESSION_TOKEN_PEPPER` (extra pepper for session token hashing)
- `AUTH_RATE_LIMIT_KV` (KV binding for rate limit)

## Request examples

### Register

```http
POST /?action=register
content-type: application/json

{
  "emp_id": "L2210007",
  "pin": "123456",
  "device_id": "8f76644b-2f37-4f4c-a530-e1d3f5ea1dc8"
}
```

### Login

```http
POST /?action=login
content-type: application/json

{
  "emp_id": "L2210007",
  "pin": "123456",
  "device_id": "8f76644b-2f37-4f4c-a530-e1d3f5ea1dc8"
}
```

### Verify token

```http
POST /?action=verify
content-type: application/json

{
  "token": "<jwt>",
  "device_id": "8f76644b-2f37-4f4c-a530-e1d3f5ea1dc8"
}
```

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend.
- Keep `login_users` and `login_sessions` blocked by RLS from anon/authenticated.
- Rotate `JWT_SECRET` and `PIN_PEPPER` using environment secrets.
- Use HTTPS only.
- Legacy hash fallback (`sha256`) is supported and auto-upgraded to PBKDF2 after successful login.

## Deploy quick steps

1. Copy `wrangler.example.toml` to `wrangler.toml` and edit values.
2. Set secrets:
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
   - `wrangler secret put PIN_PEPPER`
   - `wrangler secret put JWT_SECRET`
   - `wrangler secret put SEED_ADMIN_KEY`
   - `wrangler secret put DEVICE_REBIND_KEY`
   - `wrangler secret put SESSION_TOKEN_PEPPER`
3. Deploy: `wrangler deploy`
