// app/api/sync-students/route.js

import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcrypt"; // ✅ Add karo

const EXTERNAL_API_BASE =
  "https://mohitgupta-api.edmingle.com/nuSource/api/v1/organization/students";

const API_KEY = "fd1741e2a38f195aa55fceaeac3f90da";
const ORG_ID = "9870";

const API_HEADERS = { apikey: API_KEY, ORGID: ORG_ID };

const PARAMS = {
  organization_id: ORG_ID,
  search: "",
  is_archived: 0,
  per_page: 50,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ✅ Ek baar hash karo — sab users ke liye same reuse hoga (performance)
const DEFAULT_PASSWORD = "1234";
const hashedDefaultPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

async function fetchPageWithRetry(url, retries = 0) {
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: API_HEADERS,
  });

  if (res.status === 429) {
    if (retries >= 3) {
      const body = await res.text();
      throw new Error(`Rate limited after 3 retries: ${body}`);
    }
    console.log(`429 received. Retry ${retries + 1}/3 after 5s...`);
    await sleep(5000);
    return fetchPageWithRetry(url, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error: ${res.status} - ${body}`);
  }

  return res.json();
}

async function fetchAllStudents() {
  const allStudents = [];
  let page = 1;

  while (true) {
    const url = new URL(EXTERNAL_API_BASE);
    Object.entries({ ...PARAMS, page }).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );

    console.log(`Fetching students page ${page}: ${url.toString()}`);

    const data = await fetchPageWithRetry(url);
    const students = data?.students ?? [];

    if (students.length === 0) break;

    allStudents.push(...students);

    const hasMore = data?.page_context?.has_more_page ?? false;
    if (!hasMore) break;

    page++;
    await sleep(1000);
  }

  return allStudents;
}

export async function GET() {
  try {
    const students = await fetchAllStudents();

    if (students.length === 0) {
      return NextResponse.json({ message: "No students found", synced: 0 });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const skippedUsers = [];

    for (const student of students) {
      const { user_id, name, email } = student;

      if (!user_id) {
        skipped++;
        skippedUsers.push({ reason: "missing user_id", student });
        continue;
      }

      const resolvedEmail = email?.trim()
        ? email.trim()
        : `user_${user_id}@noemail.local`;

      const resolvedName = name?.trim() ? name.trim() : `User_${user_id}`;

      try {
        const [rows] = await db.query(
          "SELECT id FROM users WHERE external_user_id = ?",
          [user_id]
        );

        if (rows.length > 0) {
          await db.query(
            `UPDATE users SET username = ?, email = ? WHERE external_user_id = ?`,
            [resolvedName, resolvedEmail, user_id]
          );
          updated++;
        } else {
          await db.query(
            `INSERT INTO users
               (username, email, password, role_id, external_user_id, external_source)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              resolvedName,
              resolvedEmail,
              hashedDefaultPassword, // ✅ "1234" hashed
              3,
              user_id,
              "edmingle",
            ]
          );
          inserted++;
        }
      } catch (dbError) {
        console.error(`DB error for user_id ${user_id}:`, dbError.message);
        skipped++;
        skippedUsers.push({ reason: dbError.message, user_id });
      }
    }

    return NextResponse.json({
      success: true,
      total_fetched: students.length,
      inserted,
      updated,
      skipped,
      skipped_details: skippedUsers,
    });
  } catch (error) {
    console.error("Sync students error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}