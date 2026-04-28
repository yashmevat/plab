import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { generateToken } from '@/lib/auth';

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'my-super-secret-key-123';
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-key-123';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📥 Set-token request received:', {
      hasToken: !!body.token,
      hasUsername: !!body.username,
      hasEmail: !!body.email,
      body: body
    });

    // ── FLOW 2: Direct postMessage data ──
    if (!body.token && (body.username || body.email)) {
      console.log('🔄 Using DIRECT USER DATA flow');
      const { username, email, guestUserId, name } = body;

      if (!username || !email) {
        return NextResponse.json({ success: false, error: 'username and email are required' }, { status: 400 });
      }

      const external_user_id = guestUserId || username;
      const displayName = name || username;

      const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      let user;

      if (existing.length > 0) {
        user = existing[0];
        await pool.query(
          'UPDATE users SET external_user_id = ?, username = ? WHERE id = ?',
          [external_user_id, displayName, user.id]
        );
        user.username = displayName;
        user.external_user_id = external_user_id;
      } else {
        const [result] = await pool.query(
          `INSERT INTO users (username, email, password, role_id, external_user_id)
           VALUES (?, ?, 'EXTERNAL_USER', 3, ?)`,
          [displayName, email, external_user_id]
        );
        const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        user = newUser[0];
      }

      const newToken = generateToken(user);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role_id: user.role_id,
          external_user_id: user.external_user_id,
        },
        token: newToken,
      });
    }

    // ── FLOW 1: JWT bridge-token flow ──
    console.log('🔄 Using JWT TOKEN flow');
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token or user data missing' }, { status: 400 });
    }

    let decoded;
    const secretsToTry = [
      BRIDGE_SECRET,
      JWT_SECRET,
      'my-3001-jwt-secret',
      'my-super-secret-key-123',
      'your-secret-key-change-this'
    ];

    let verificationError;
    for (const secret of secretsToTry) {
      try {
        decoded = jwt.verify(token, secret);
        break;
      } catch (err) {
        verificationError = err;
        continue;
      }
    }

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
        details: verificationError.message
      }, { status: 401 });
    }

    const external_user_id = decoded.id || decoded.userId;
    const email = decoded.email;
    const username = decoded.username;

    if (!external_user_id || !email || !username) {
      return NextResponse.json({ success: false, error: 'Invalid token structure' }, { status: 400 });
    }

    const [existingByEmail] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const [existingByExternalId] = await pool.query(
      'SELECT * FROM users WHERE external_user_id = ?',
      [String(external_user_id)]
    );

    let user;

    if (existingByExternalId.length > 0) {
      user = existingByExternalId[0];
      if (user.email !== email || user.username !== username) {
        await pool.query(
          'UPDATE users SET email = ?, username = ? WHERE id = ?',
          [email, username, user.id]
        );
        user.email = email;
        user.username = username;
      }
    } else if (existingByEmail.length > 0) {
      user = existingByEmail[0];
      await pool.query(
        'UPDATE users SET external_user_id = ?, username = ? WHERE id = ?',
        [String(external_user_id), username, user.id]
      );
      user.external_user_id = String(external_user_id);
      user.username = username;
    } else {
      const [result] = await pool.query(
        `INSERT INTO users (username, email, password, role_id, external_user_id)
         VALUES (?, ?, 'EXTERNAL_USER', 3, ?)`,
        [username, email, String(external_user_id)]
      );
      const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
    }

    const newToken = generateToken(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        external_user_id: user.external_user_id,
      },
      token: newToken,
    });

  } catch (error) {
    console.error('❌ Set token error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}
