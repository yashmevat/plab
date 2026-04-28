import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("Webhook received:", body);

    const event = body.event || body.type;

    switch (event?.event) {
      case "user.user_created":
        const { name, email, user_id } = body.payload;

        if (!email || !name || !user_id) {
          console.error("Missing required fields:", body.data);
          return NextResponse.json(
            { error: "Missing required fields: name, email, user_id" },
            { status: 400 }
          );
        }

        // Check if user with this email already exists
        const [existingUsers] = await pool.query(
          "SELECT id FROM users WHERE email = ?",
          [email]
        );

        if (existingUsers.length > 0) {
          console.log("User already exists with email:", email);
          return NextResponse.json({
            success: true,
            message: "User already exists"
          });
        }

        // Create new user
        await pool.query(
          `INSERT INTO users (username, email, password, role_id, external_user_id, external_source)
           VALUES (?, ?, 'EXTERNAL_USER', 3, ?, 'plabcoach')`,
          [name, email, user_id]
        );

        console.log("New user created:", { name, email, external_user_id: user_id });
        return NextResponse.json({
          success: true,
          message: "User created successfully"
        });

      case "user.updated":
        console.log("User updated:", body.data);
        break;

      default:
        console.log("Unhandled event:", event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
