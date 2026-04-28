import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcrypt";
import crypto from "crypto";

const ROLE_AUTHOR = 2;

function normalizeUserData(data = {}) {
  return {
    externalId: data.id ? String(data.id) : null,
    name: data.name?.trim() || null,
    email: data.email?.trim().toLowerCase() || null,
  };
}

function generateUsername(name, email) {
  if (name) return name;
  if (email) return email.split("@")[0];
  return "author";
}

function generateTempPassword() {
  return crypto.randomBytes(12).toString("hex");
}

// Optional shared-secret validation
function isValidWebhookSecret(req) {
  const expected = process.env.PLABCOACH_WEBHOOK_SECRET;
  if (!expected) return true; // allow if not configured
  const got = req.headers.get("x-webhook-secret");
  return got && got === expected;
}

export async function POST(req) {
  try {
    if (!isValidWebhookSecret(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized webhook" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Webhook received:", body);

    const event = body.event || body.type;
    const data = body.data || {};

    switch (event) {
      case "user.created": {
        const { externalId, name, email } = normalizeUserData(data);

        if (!externalId || !email) {
          return NextResponse.json(
            { success: false, error: "Invalid payload: data.id and data.email are required" },
            { status: 400 }
          );
        }

        // Idempotency: try find by external_user_id first, then by email
        const [byExternal] = await pool.query(
          "SELECT id, email, username FROM users WHERE external_user_id = ? LIMIT 1",
          [externalId]
        );

        const [byEmail] = await pool.query(
          "SELECT id, email, username, external_user_id FROM users WHERE email = ? LIMIT 1",
          [email]
        );

        const username = generateUsername(name, email);

        if (byExternal.length > 0) {
          // Already synced user: keep data fresh and ensure role is author
          await pool.query(
            "UPDATE users SET username = ?, email = ?, role_id = ? WHERE id = ?",
            [username, email, ROLE_AUTHOR, byExternal[0].id]
          );

          return NextResponse.json({ success: true, message: "Author already existed, updated" });
        }

        if (byEmail.length > 0) {
          // Existing user with same email: link external id and promote to author role
          await pool.query(
            "UPDATE users SET external_user_id = ?, username = ?, role_id = ? WHERE id = ?",
            [externalId, username, ROLE_AUTHOR, byEmail[0].id]
          );

          return NextResponse.json({ success: true, message: "Existing user linked and updated as author" });
        }

        // New author user
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await pool.query(
          "INSERT INTO users (username, email, password, role_id, external_user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
          [username, email, hashedPassword, ROLE_AUTHOR, externalId]
        );

        return NextResponse.json({ success: true, message: "Author created from webhook" }, { status: 201 });
      }

      case "user.updated": {
        const { externalId, name, email } = normalizeUserData(data);
        if (!externalId) {
          return NextResponse.json(
            { success: false, error: "Invalid payload: data.id is required" },
            { status: 400 }
          );
        }

        const [existing] = await pool.query(
          "SELECT id FROM users WHERE external_user_id = ? LIMIT 1",
          [externalId]
        );

        if (existing.length === 0) {
          return NextResponse.json({ success: true, message: "No local user found for update" });
        }

        const updates = [];
        const values = [];

        if (name) {
          updates.push("username = ?");
          values.push(name);
        }
        if (email) {
          updates.push("email = ?");
          values.push(email);
        }

        if (updates.length > 0) {
          values.push(existing[0].id);
          await pool.query(
            "UPDATE users SET " + updates.join(", ") + " WHERE id = ?",
            values
          );
        }

        return NextResponse.json({ success: true, message: "User updated from webhook" });
      }

      default:
        console.log("Unhandled event:", event);
        return NextResponse.json({ success: true, message: "Event ignored" });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
