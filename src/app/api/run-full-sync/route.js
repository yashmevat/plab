import { NextResponse } from "next/server";
import db from "@/lib/db";

const DOMAIN_URL = "https://mohitgupta-api.edmingle.com/nuSource/api/v1";
const API_KEY = "fd1741e2a38f195aa55fceaeac3f90da";
const ORG_ID = "9870";

const CHUNK_SIZE = 50;
const DELAY_BETWEEN_USERS = 300;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;

const API_HEADERS = { apikey: API_KEY, ORGID: ORG_ID };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchEnrolledCourses(externalUserId, attempt = 0) {
  const url = new URL(`${DOMAIN_URL}/admin/student/enrollcourses/${externalUserId}`);
  url.searchParams.set("include_archived_batches", "0");
  url.searchParams.set("include_lastview_info", "0");
  url.searchParams.set("include_expired_courses", "0");
  url.searchParams.set("include_cancelled_courses", "0");

  const res = await fetch(url.toString(), { cache: "no-store", headers: API_HEADERS });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`Rate limited for user ${externalUserId}`);
    await sleep(RETRY_DELAY_MS * (attempt + 1));
    return fetchEnrolledCourses(externalUserId, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status} for user ${externalUserId}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

async function upsertUserCourse(userId, batch) {
  const { bundle_id, actual_master_batch_name, mb_start_date, mb_end_date } = batch;
  if (!bundle_id) return null;

  const startDate = mb_start_date ? new Date(mb_start_date * 1000) : null;
  const endDate   = mb_end_date   ? new Date(mb_end_date   * 1000) : null;

  const [result] = await db.query(
    `INSERT INTO user_courses
       (user_id, bundle_id, actual_master_batch_name, mb_start_date, mb_end_date)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       actual_master_batch_name = VALUES(actual_master_batch_name),
       mb_start_date            = VALUES(mb_start_date),
       mb_end_date              = VALUES(mb_end_date)`,
    [userId, bundle_id, actual_master_batch_name ?? null, startDate, endDate]
  );

  return result.affectedRows;
}

// ─── GET /api/run-full-sync ───────────────────────────────────────────────────
// Streams progress as NDJSON (one JSON line per chunk)
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        // Total users count
        const [[{ total }]] = await db.query(
          "SELECT COUNT(*) AS total FROM users WHERE external_user_id IS NOT NULL"
        );

        if (total === 0) {
          send({ status: "done", message: "No users found", total: 0 });
          controller.close();
          return;
        }

        send({ status: "started", total_users: total });

        let offset = 0;
        let grandInserted = 0;
        let grandUpdated  = 0;
        let grandSkipped  = 0;
        const allErrors   = [];

        // ✅ Loop through all chunks automatically
        while (offset < total) {
          const [users] = await db.query(
            `SELECT id, external_user_id FROM users
             WHERE external_user_id IS NOT NULL
             LIMIT ? OFFSET ?`,
            [CHUNK_SIZE, offset]
          );

          if (users.length === 0) break;

          let inserted = 0;
          let updated  = 0;
          let skipped  = 0;
          const errors = [];

          for (const user of users) {
            const { id: userId, external_user_id } = user;
            try {
              const data = await fetchEnrolledCourses(external_user_id);
              const batches = data?.batches ?? [];

              if (batches.length === 0) { skipped++; continue; }

              for (const batch of batches) {
                const affected = await upsertUserCourse(userId, batch);
                if (affected === null) skipped++;
                else if (affected === 1) inserted++;
                else updated++;
              }

              await sleep(DELAY_BETWEEN_USERS);
            } catch (err) {
              errors.push({ external_user_id, error: err.message });
              skipped++;
            }
          }

          grandInserted += inserted;
          grandUpdated  += updated;
          grandSkipped  += skipped;
          allErrors.push(...errors);

          // ✅ Stream progress after each chunk
          send({
            status: "progress",
            chunk_offset: offset,
            chunk_processed: users.length,
            chunk_inserted: inserted,
            chunk_updated: updated,
            chunk_skipped: skipped,
            chunk_errors: errors,
            overall: {
              inserted: grandInserted,
              updated: grandUpdated,
              skipped: grandSkipped,
            },
          });

          offset += CHUNK_SIZE;
        }

        // ✅ Final summary
        send({
          status: "done",
          total_users: total,
          inserted: grandInserted,
          updated: grandUpdated,
          skipped: grandSkipped,
          errors: allErrors,
        });
      } catch (err) {
        send({ status: "error", error: err.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
