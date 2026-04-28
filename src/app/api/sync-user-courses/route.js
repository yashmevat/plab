// app/api/sync-user-courses/route.js

import { NextResponse } from "next/server";
import db from "@/lib/db";

const DOMAIN_URL = "https://mohitgupta-api.edmingle.com/nuSource/api/v1";
const API_KEY = "fd1741e2a38f195aa55fceaeac3f90da";
const ORG_ID = "9870";

const API_HEADERS = {
  apikey: API_KEY,
  ORGID: ORG_ID,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchEnrolledCoursesWithRetry(externalUserId, retries = 0) {
  const url = new URL(
    `${DOMAIN_URL}/admin/student/enrollcourses/${externalUserId}`
  );
  url.searchParams.set("include_archived_batches", "0");
  url.searchParams.set("include_lastview_info", "0");
  url.searchParams.set("include_expired_courses", "0");
  url.searchParams.set("include_cancelled_courses", "0");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: API_HEADERS,
  });

  if (res.status === 429) {
    if (retries >= 3) {
      throw new Error(`Rate limited after 3 retries for user ${externalUserId}`);
    }
    console.log(`429 for user ${externalUserId}. Retry ${retries + 1}/3 after 5s...`);
    await sleep(5000);
    return fetchEnrolledCoursesWithRetry(externalUserId, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status} for user ${externalUserId}: ${body}`);
  }

  return res.json();
}

export async function GET() {
  try {
    // ✅ Step 1: Fetch all users with external_user_id from DB
    const [users] = await db.query(
      "SELECT id, external_user_id FROM users WHERE external_user_id IS NOT NULL"
    );

    if (users.length === 0) {
      return NextResponse.json({ message: "No users found", synced: 0 });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // ✅ Step 2: Loop every user
    for (const user of users) {
      const { id: userId, external_user_id } = user;

      try {
        const data = await fetchEnrolledCoursesWithRetry(external_user_id);

        const batches = data?.batches ?? [];

        if (batches.length === 0) {
          skipped++;
          await sleep(300); // small delay even on empty
          continue;
        }

        // ✅ Step 3: For each batch, upsert into user_courses
        for (const batch of batches) {
          const {
            bundle_id,
            actual_master_batch_name,
            mb_start_date,
            mb_end_date,
          } = batch;

          if (!bundle_id) continue;

          // Convert 0 timestamps to null (0 means not set)
          const startDate = mb_start_date ? new Date(mb_start_date * 1000) : null;
          const endDate = mb_end_date ? new Date(mb_end_date * 1000) : null;

          // ✅ Check if record already exists
          const [existing] = await db.query(
            "SELECT id FROM user_courses WHERE user_id = ? AND bundle_id = ?",
            [userId, bundle_id]
          );

          if (existing.length > 0) {
            await db.query(
              `UPDATE user_courses
               SET actual_master_batch_name = ?,
                   mb_start_date = ?,
                   mb_end_date = ?
               WHERE user_id = ? AND bundle_id = ?`,
              [
                actual_master_batch_name ?? null,
                startDate,
                endDate,
                userId,
                bundle_id,
              ]
            );
            updated++;
          } else {
            await db.query(
              `INSERT INTO user_courses
                 (user_id, bundle_id, actual_master_batch_name, mb_start_date, mb_end_date)
               VALUES (?, ?, ?, ?, ?)`,
              [
                userId,
                bundle_id,
                actual_master_batch_name ?? null,
                startDate,
                endDate,
              ]
            );
            inserted++;
          }
        }

        // ✅ Delay between users to avoid rate limit
        await sleep(500);
      } catch (userError) {
        console.error(`Error for external_user_id ${external_user_id}:`, userError.message);
        errors.push({ external_user_id, error: userError.message });
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      total_users: users.length,
      inserted,
      updated,
      skipped,
      errors, // ✅ which users failed
    });
  } catch (error) {
    console.error("Sync user courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}