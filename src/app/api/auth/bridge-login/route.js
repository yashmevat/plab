// app/api/auth/bridge-login/route.js (localhost:3000)
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateToken } from '@/lib/auth';

// Ek secret key jo sirf dono projects ko pata ho
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'my-super-secret-key-123';

export async function POST(request) {
  try {
    const { 
      external_user_id,  // 3001 wale project ka user ID
      email, 
      username,
      secret             // verify karne ke liye
    } = await request.json();

    // Secret verify karo
    if (secret !== BRIDGE_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check karo user already exist karta hai 3000 ke DB mein
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    let user;

    if (existing.length > 0) {
      // Already exist karta hai → use karo
      user = existing[0];
    } else {
      // Naya user create karo (without password — external user)
      const [result] = await pool.query(
        `INSERT INTO users (username, email, password, role_id, external_user_id) 
         VALUES (?, ?, 'EXTERNAL_USER', 3, ?)`,
        [username, email, external_user_id]
      );

      const [newUser] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
      user = newUser[0];
    }

    // Token generate karo
    const token = generateToken(user);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
      }
    });

    // Cookie set karo
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',  // Cross-origin ke liye
      secure: true,      // sameSite: none ke saath secure zaroori hai
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Bridge login error:', error);
    return NextResponse.json(
      { success: false, error: 'Bridge login failed' },
      { status: 500 }
    );
  }
}
