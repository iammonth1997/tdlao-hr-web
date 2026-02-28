#!/usr/bin/env node

/**
 * TDLAO HR - Employee Seed Helper
 * 
 * Usage:
 *   node seed-helper.js --check-table
 *   node seed-helper.js --seed-sample
 *   node seed-helper.js --seed-file employees.csv
 */

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hokthzztcijvgnvcgkms.supabase.co";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WORKER_API = process.env.WORKER_API || "https://login-supabase-api.iammonth1997.workers.dev/";
const SEED_KEY = process.env.SEED_ADMIN_KEY || "";

async function checkTable() {
  console.log("Checking Supabase connection and employees table...\n");

  try {
    // Test connection
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`
      }
    });

    if (!res.ok) {
      console.error(`❌ Error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(text.substring(0, 500));
      return;
    }

    const data = await res.json();
    console.log(`✓ Connection successful`);
    console.log(`✓ Table has ${Array.isArray(data) ? data.length : "unknown"} rows\n`);

    if (Array.isArray(data) && data.length > 0) {
      console.log("Sample employee:");
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log("⚠ Table is empty. You need to seed data.");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function seedSample() {
  console.log("Creating sample employees...\n");

  // Sample Thai-like employee IDs and names
  const samples = [
    { emp_id: "L2506110", thai_name: "สมชาย แสงทอง", dob: "1990-05-15", department: "Mining", position: "Worker" },
    { emp_id: "L2506111", thai_name: "สมหญิง จันทน์", dob: "1992-08-22", department: "Mining", position: "Worker" },
    { emp_id: "L2506112", thai_name: "วิศวะ ศรีสวัสดิ์", dob: "1988-03-10", department: "Mining", position: "Supervisor" },
    { emp_id: "L2506113", thai_name: "ณัฐนิกา รัตนะ", dob: "1995-11-30", department: "Admin", position: "Staff" },
    { emp_id: "L2506114", thai_name: "สามารถ กิจการ", dob: "1985-01-20", department: "Mining", position: "Manager" }
  ];

  try {
    for (const emp of samples) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/employees`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          emp_id: emp.emp_id,
          thai_name: emp.thai_name,
          dob: emp.dob,
          status: "active",
          department: emp.department,
          position: emp.position
        })
      });

      if (res.ok) {
        console.log(`✓ Created: ${emp.emp_id} ${emp.thai_name}`);
      } else {
        console.error(`✗ Failed: ${emp.emp_id} - ${res.status}`);
      }
    }
    console.log("\n✓ Sample seed complete");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function seedFromFile(filePath) {
  console.log(`Reading from ${filePath}...\n`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    if (lines.length === 0) {
      console.error("❌ File is empty");
      return;
    }

    // Parse CSV/TSV
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

    console.log(`Headers: ${headers.join(", ")}\n`);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      const emp = {};

      headers.forEach((h, idx) => {
        emp[h] = values[idx] || "";
      });

      if (!emp.emp_id) {
        console.log(`⚠ Row ${i + 1}: Missing emp_id, skipping`);
        continue;
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/employees`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            emp_id: (emp.emp_id || "").toUpperCase(),
            thai_name: emp.thai_name || emp.name || "",
            english_name: emp.english_name || emp.name_en || "",
            dob: emp.dob || emp.birth_date || emp.date_of_birth || "",
            status: emp.status || "active",
            department: emp.department || emp.dept || "",
            position: emp.position || emp.pos || "",
            salary_level: emp.salary_level || ""
          })
        });

        if (res.ok) {
          console.log(`✓ Row ${i + 1}: ${emp.emp_id}`);
        } else {
          const error = await res.text();
          console.error(`✗ Row ${i + 1}: ${emp.emp_id} - ${error.substring(0, 100)}`);
        }
      } catch (err) {
        console.error(`✗ Row ${i + 1}: ${err.message}`);
      }
    }
    console.log("\n✓ Seed complete");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function testCheckApi(empId) {
  console.log(`Testing check API for ${empId}...\n`);

  try {
    const res = await fetch(`${WORKER_API}?action=check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emp_id: empId })
    });

    const data = await res.json();
    console.log("Response:");
    console.log(JSON.stringify(data, null, 2));

    if (data.exists) {
      console.log("\n✓ Employee found!");
    } else {
      console.log("\n✗ Employee not found - need to seed or check database");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

// Main
const arg = process.argv[2];

if (arg === "--check-table") {
  checkTable();
} else if (arg === "--seed-sample") {
  seedSample();
} else if (arg === "--seed-file") {
  const file = process.argv[3];
  if (!file) {
    console.error("Usage: node seed-helper.js --seed-file employees.csv");
    process.exit(1);
  }
  seedFromFile(file);
} else if (arg === "--test-api") {
  const empId = process.argv[3] || "L2506110";
  testCheckApi(empId);
} else {
  console.log(`TDLAO HR - Employee Seed Helper

Usage:
  node seed-helper.js --check-table          # Check employees table status
  node seed-helper.js --seed-sample          # Add 5 sample employees
  node seed-helper.js --seed-file FILE.csv   # Seed from CSV file
  node seed-helper.js --test-api [emp_id]    # Test check API

Environment variables:
  SUPABASE_URL                 (default: production URL)
  SUPABASE_SERVICE_ROLE_KEY    (required for --check and --seed)
  WORKER_API                   (default: production worker)
  SEED_ADMIN_KEY               (not used yet)

CSV Format (with header):
  emp_id,thai_name,dob,department,position,status
  L2506110,สมชาย แสงทอง,1990-05-15,Mining,Worker,active
  L2506111,สมหญิง จันทน์,1992-08-22,Mining,Worker,active
`);
}
