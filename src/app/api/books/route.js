// // app/api/books/route.js
// import { NextResponse } from 'next/server';
// import pool from '@/lib/db';

// export async function GET() {
//   try {
//     const [rows] = await pool.query(
//       `SELECT 
//         b.id, 
//         b.title, 
//         b.created_at,
//         u.username as author_name,
//         (SELECT COUNT(*) FROM topics WHERE book_id = b.id) as topic_count,
//         (SELECT COUNT(*) FROM subtopics WHERE book_id = b.id) as subtopic_count
//        FROM books b 
//        LEFT JOIN users u ON b.author_id = u.id
//        ORDER BY b.created_at DESC`
//     );
    
//     return NextResponse.json({ success: true, data: rows });
//   } catch (error) {
//     console.error('Books GET Error:', error);
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
//   }
// }


// app/api/books/route.js

import { NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(req) {
  try {
    // ✅ Token check
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

    // ✅ Step 1: User ke enrolled bundle_ids nikalo
    const [userCourses] = await db.query(
      `SELECT bundle_id FROM user_courses WHERE user_id = ?`,
      [userId]
    );

    if (userCourses.length === 0) {
      return NextResponse.json({ success: true, data: [], message: "No enrolled courses" });
    }

    const bundleIds = userCourses.map((row) => row.bundle_id);

    // ✅ Step 2: JSON_CONTAINS — MySQL 5.7+ compatible
    const conditions = bundleIds.map(() => `JSON_CONTAINS(course_ids, ?)`).join(' OR ');
    const params = bundleIds.map((id) => JSON.stringify(id));

    const [books] = await db.query(
      `SELECT 
          b.id, 
          b.title,
          b.created_at,
          u.username as author_name,
          (SELECT COUNT(*) FROM topics WHERE book_id = b.id) as topic_count,
          (SELECT COUNT(*) FROM subtopics WHERE book_id = b.id) as subtopic_count
       FROM books b
       LEFT JOIN users u ON b.author_id = u.id
       WHERE ${conditions}
       ORDER BY b.created_at DESC`,
      params
    );

    return NextResponse.json({ success: true, data: books });

  } catch (error) {
    console.error("Books fetch error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}