-- TDLAO HR - Complete Database Schema Migration
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/[project]/sql)
-- This script creates all necessary tables for the HR system

-- ============================================================================
-- PART 1: EMPLOYEES TABLE (Master Data)
-- ============================================================================

-- Create employees table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employees (
  emp_id TEXT PRIMARY KEY,
  
  -- Basic Info
  thai_name TEXT,
  english_name TEXT,
  thai_surname TEXT,
  english_surname TEXT,
  dob DATE,
  gender TEXT, -- 'M', 'F', 'Other'
  
  -- Employment Info
  status TEXT DEFAULT 'active', -- 'active', 'ลาออก' (resigned), 'on_leave', etc
  department TEXT,
  position TEXT,
  salary_level TEXT,
  hire_date DATE,
  resign_date DATE,
  
  -- Contact
  phone TEXT,
  email TEXT,
  address TEXT,
  
  -- System Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CHECK (status IS NOT NULL),
  CHECK (thai_name IS NOT NULL OR english_name IS NOT NULL)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_dob ON public.employees(dob);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON public.employees(phone);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employees_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_timestamp_trigger ON public.employees;
CREATE TRIGGER employees_timestamp_trigger
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_employees_timestamp();

-- ============================================================================
-- PART 2: LOGIN TABLES (Authentication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_users (
  emp_id TEXT PRIMARY KEY REFERENCES public.employees(emp_id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  device_id_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL REFERENCES public.login_users(emp_id) ON DELETE CASCADE,
  device_id_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_sessions_emp_id ON public.login_sessions(emp_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_expires_at ON public.login_sessions(expires_at);

-- ============================================================================
-- PART 3: PAYROLL DATA TABLES
-- ============================================================================

-- Monthly payroll summary
CREATE TABLE IF NOT EXISTS public.monthly_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL REFERENCES public.employees(emp_id) ON DELETE CASCADE,
  pay_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  
  -- Income
  base_salary DECIMAL(12, 2),
  wages DECIMAL(12, 2),
  bonus DECIMAL(12, 2),
  ot_pay DECIMAL(12, 2),
  allowance DECIMAL(12, 2),
  welfare DECIMAL(12, 2),
  other_benefits DECIMAL(12, 2),
  total_income DECIMAL(12, 2),
  
  -- Deductions
  sso_deduction DECIMAL(12, 2),
  tax_deduction DECIMAL(12, 2),
  other_deductions DECIMAL(12, 2),
  total_deductions DECIMAL(12, 2),
  
  -- Net
  net_salary DECIMAL(12, 2),
  working_days NUMERIC(5, 2),
  
  -- System
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(emp_id, pay_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_payroll_emp_id ON public.monthly_payroll(emp_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payroll_pay_month ON public.monthly_payroll(pay_month);

-- Day work logs
CREATE TABLE IF NOT EXISTS public.day_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL REFERENCES public.employees(emp_id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  work_type TEXT, -- 'normal', 'ot', 'holiday', etc
  hours NUMERIC(5, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(emp_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_day_work_emp_id ON public.day_work(emp_id);
CREATE INDEX IF NOT EXISTS idx_day_work_date ON public.day_work(work_date);

-- Overtime records
CREATE TABLE IF NOT EXISTS public.overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL REFERENCES public.employees(emp_id) ON DELETE CASCADE,
  ot_date DATE NOT NULL,
  hours NUMERIC(5, 2),
  rate_type TEXT, -- 'regular', 'holiday', etc
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overtime_emp_id ON public.overtime(emp_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON public.overtime(ot_date);

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE public.login_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Block direct access from anon/authenticated clients (Worker only)
DROP POLICY IF EXISTS "deny_all_login_users" ON public.login_users;
CREATE POLICY "deny_all_login_users" ON public.login_users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_login_sessions" ON public.login_sessions;
CREATE POLICY "deny_all_login_sessions" ON public.login_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- PART 4b: RLS ON EMPLOYEES + PAYROLL TABLES
-- ============================================================================
-- PREREQUISITE: Set Supabase JWT Secret = same value as Worker's JWT_SECRET env var.
-- Dashboard → Project Settings → API → JWT Secret → change to your JWT_SECRET value.
-- This lets Supabase validate Worker-issued tokens so auth.jwt()->> works in policies.
-- ============================================================================

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime ENABLE ROW LEVEL SECURITY;

-- employees: each employee can SELECT their own row only
DROP POLICY IF EXISTS "employees_self_read" ON public.employees;
CREATE POLICY "employees_self_read" ON public.employees
  FOR SELECT
  TO authenticated
  USING (emp_id = auth.jwt()->>'sub');

-- monthly_payroll: each employee can SELECT their own payroll only
DROP POLICY IF EXISTS "payroll_self_read" ON public.monthly_payroll;
CREATE POLICY "payroll_self_read" ON public.monthly_payroll
  FOR SELECT
  TO authenticated
  USING (emp_id = auth.jwt()->>'sub');

-- day_work: self-read
DROP POLICY IF EXISTS "day_work_self_read" ON public.day_work;
CREATE POLICY "day_work_self_read" ON public.day_work
  FOR SELECT
  TO authenticated
  USING (emp_id = auth.jwt()->>'sub');

-- overtime: self-read
DROP POLICY IF EXISTS "overtime_self_read" ON public.overtime;
CREATE POLICY "overtime_self_read" ON public.overtime
  FOR SELECT
  TO authenticated
  USING (emp_id = auth.jwt()->>'sub');

-- Note: INSERT/UPDATE/DELETE are blocked automatically when no policy matches them.
-- Service role (used by Worker) bypasses RLS entirely.

-- Optional: Allow employees to view their own data

-- ============================================================================
-- PART 5: PGCRYPTO EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- VERIFICATION QUERIES (run these after creating tables)
-- ============================================================================

-- Check that all tables exist:
-- SELECT table_name FROM information_schema.tables 
--   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
--   ORDER BY table_name;

-- Check employees table structure:
-- SELECT column_name, data_type, is_nullable 
--   FROM information_schema.columns 
--   WHERE table_name = 'employees' 
--   ORDER BY ordinal_position;

-- Check if you can insert a test employee:
-- INSERT INTO public.employees (emp_id, thai_name, dob, status, department, position)
--   VALUES ('L2506110', 'สมชาย แสงทอง', '1990-05-15', 'active', 'Mining', 'Worker');
--
-- SELECT * FROM public.employees WHERE emp_id = 'L2506110';

