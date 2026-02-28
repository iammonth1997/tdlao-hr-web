# TDLAO HR Web App - Login Flow Debug Guide

## Issue Summary
The `check` API returns `{exists: false}` for emp_id `L2506110` even though the employee should exist.

## Root Cause Analysis

The `handleCheck` function queries Supabase like this:
```javascript
const query = new URLSearchParams({
  select: "emp_id,status,dob",
  emp_id: `eq.${empId}`,
  limit: "1"
});
const rows = await supabaseRequest(env, "employees", { method: "GET", query });
```

This will fail if:
1. **`employees` table doesn't exist** or is empty
2. **Column names are different** (not `emp_id`, `status`, `dob`)
3. **Data format mismatch** (case sensitivity, whitespace, data type)
4. **Foreign key not set up** (`login_users` references `employees(emp_id)`)

## Step-by-Step Diagnosis

### In Supabase SQL Editor, run these tests:

#### 1. Check employees table exists
```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'employees' AND table_schema = 'public';
```
**Expected:** One row with table_name='employees'

#### 2. See employees table schema
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;
```
**Expected columns:** `emp_id`, `status`, `dob`, possibly others

#### 3. Check if employees table has data
```sql
SELECT COUNT(*) as total FROM public.employees;
SELECT * FROM public.employees LIMIT 5;
```
**Expected:** Rows exist, emp_id looks like "L2506110"

#### 4. Test the exact query used by check API
```sql
SELECT emp_id, status, dob FROM public.employees 
WHERE emp_id = 'L2506110';
```
**Expected:** 1 row with the employee data

#### 5. Check login_users table
```sql
SELECT COUNT(*) as total FROM public.login_users;
SELECT * FROM public.login_users LIMIT 5;
```

---

## If employees table doesn't exist

You need to create it based on your HR system structure. Here's a template:

```sql
-- Create employees table (adjust columns to match your HR data)
create table if not exists public.employees (
  emp_id text primary key,
  thai_name text,
  english_name text,
  dob date,
  status text default 'active',  -- 'active', 'ลาออก' (resigned), etc
  department text,
  position text,
  salary_level text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_employees_status on public.employees(status);
create index if not exists idx_employees_dob on public.employees(dob);
```

---

## If employees table exists but is empty

You need to populate it with employee data. Options:

### Step 1: Use seed-tool.html
1. Open `/admin/seed-tool.html` in browser
2. It should have a form to seed login_users

### Step 2: Use Worker seed API
```bash
curl -X POST "https://login-supabase-api.iammonth1997.workers.dev/?action=seed" \
  -H "Content-Type: application/json" \
  -H "x-seed-key: YOUR_SEED_ADMIN_KEY" \
  -d '{
    "records": [
      {"emp_id": "L2506110", "pin": "123456", "device_id": "test-device-1"}
    ]
  }'
```

### Step 3: Manually add to employees table via SQL
```sql
INSERT INTO public.employees (emp_id, thai_name, dob, status, department, position)
VALUES 
  ('L2506110', 'ชื่อพนักงาน ชื่อสกุล', '1990-05-15', 'active', 'Mining', 'Worker'),
  ('L2506111', 'อีกคน', '1991-06-20', 'active', 'Mining', 'Worker');
```

---

## Column Name Mismatch

If the table has different column names, the query needs adjustment. Common alternatives:
- `emp_id` → might be `employee_id`, `id`, `emp_code`
- `status` → might be `emp_status`, `employment_status`
- `dob` → might be `date_of_birth`, `birth_date`

If your table uses different names, **update worker.js:**

```javascript
async function getEmployee(env, empId) {
  const query = new URLSearchParams({
    select: "emp_id,status,dob",  // ← Change these column names
    emp_id: `eq.${empId}`,         // ← Change this if column name is different
    limit: "1"
  });
  const rows = await supabaseRequest(env, "employees", { method: "GET", query });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}
```

---

## Case Sensitivity Issues

The `normalizeEmpId()` function in worker.js converts to UPPERCASE:
```javascript
function normalizeEmpId(value) {
  return String(value || "").trim().toUpperCase();
}
```

So if you search for "L2506110", it becomes "L2506110" (already uppercase).  
But if your database has "l2506110" (lowercase), it won't match.

**Fix:** Either:
1. Store emp_id as UPPERCASE in database
2. Or modify the query: `emp_id: `ilike.${empId}`` (case-insensitive like)
3. Or normalize in database: `SELECT emp_id UPPER(emp_id) FROM employees WHERE UPPER(emp_id) = 'L2506110'`

---

## Testing the Fix

Once you've created/populated the employees table:

1. **Use the diagnosis tool:**
   - Open `admin/diagnose.html` in browser
   - Test "Check Specific Employee" with "L2506110"

2. **Test via curl:**
   ```bash
   curl -X POST "https://login-supabase-api.iammonth1997.workers.dev/?action=check" \
     -H "Content-Type: application/json" \
     -d '{"emp_id": "L2506110"}'
   ```

3. **Expected response:**
   ```json
   {
     "exists": true,
     "active": true,
     "registered": false
   }
   ```

---

## Next Steps After Fixing Check API

1. ✅ **Fix check API** (return exists=true) ← You are here
2. **Test registration** - Enter DOB + PIN
3. **Test login** - Enter PIN only  
4. **Seed all employees** - Add ~2,000 employees to database
5. **Enable RLS** - Secure tables from unauthorized access

