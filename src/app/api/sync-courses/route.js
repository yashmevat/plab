// app/api/sync-courses/route.js

import { NextResponse } from "next/server";
import db from "@/lib/db";

const INSTITUTE_ID = 7740;
const EXTERNAL_API_BASE = `https://mohitgupta-api.edmingle.com/nuSource/api/v1/institute/${INSTITUTE_ID}/courses`;

const PARAMS = {
  get_tutors: 1,
  get_tags: 1,
  get_student_count: 1,
  order_by: "ASC",
  per_page: 10,
};

async function fetchAllBundles() {
  const allBundles = [];
  let page = 1;

  while (true) {
    const url = new URL(EXTERNAL_API_BASE);
    Object.entries({ ...PARAMS, page }).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );

    console.log(`Fetching page ${page}: ${url.toString()}`);

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`External API error: ${res.status} on page ${page} — ${body}`);
    }

    const data = await res.json();
    const instituteCourses = data?.institute_courses ?? [];
    const bundles = instituteCourses.flatMap((ic) => ic.course_bundles ?? []);

    if (bundles.length === 0) break;
    allBundles.push(...bundles);
    if (bundles.length < PARAMS.per_page) break;
    page++;
  }

  return allBundles;
}

export async function GET() {
  try {
    const bundles = await fetchAllBundles();

    let inserted = 0;
    let updated = 0;
    let orphanInserted = 0;

    // ─── Step 1: API se aaye bundles sync karo ───────────────────────────────
    if (bundles.length > 0) {
      for (const bundle of bundles) {
        const { bundle_id, bundle_name } = bundle;
        if (!bundle_id) continue;

        const [rows] = await db.query(
          "SELECT id FROM courses WHERE bundle_id = ?",
          [bundle_id]
        );

        if (rows.length > 0) {
          await db.query(
            "UPDATE courses SET course_name = ? WHERE bundle_id = ?",
            [bundle_name, bundle_id]
          );
          updated++;
        } else {
          await db.query(
            "INSERT INTO courses (bundle_id, course_name) VALUES (?, ?)",
            [bundle_id, bundle_name]
          );
          inserted++;
        }
      }
    }

    // ─── Step 2: user_courses me aisi bundle_ids dhundo jo courses me nahi hain
    // actual_master_batch_name se course_name lelo — latest wala prefer karo
    const [orphanBundles] = await db.query(
      `SELECT 
         uc.bundle_id,
         (
           SELECT uc2.actual_master_batch_name 
           FROM user_courses uc2 
           WHERE uc2.bundle_id = uc.bundle_id 
             AND uc2.actual_master_batch_name IS NOT NULL 
           LIMIT 1
         ) AS course_name
       FROM user_courses uc
       LEFT JOIN courses c ON c.bundle_id = uc.bundle_id
       WHERE c.bundle_id IS NULL
       GROUP BY uc.bundle_id`
    );

    // ─── Step 3: Orphan bundle_ids insert karo ────────────────────────────────
    for (const { bundle_id, course_name } of orphanBundles) {
      const finalName = course_name ?? `Unknown Course (${bundle_id})`;

      await db.query(
        `INSERT INTO courses (bundle_id, course_name) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE bundle_id = bundle_id`,
        [bundle_id, finalName]
      );
      orphanInserted++;
    }

    return NextResponse.json({
      success: true,
      api_bundles: {
        total_fetched: bundles.length,
        inserted,
        updated,
      },
      orphan_bundles: {
        found: orphanBundles.length,
        inserted: orphanInserted,
        details: orphanBundles.map((b) => ({
          bundle_id: b.bundle_id,
          course_name: b.course_name ?? `Unknown Course (${b.bundle_id})`,
        })),
      },
    });
  } catch (error) {
    console.error("Sync courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}