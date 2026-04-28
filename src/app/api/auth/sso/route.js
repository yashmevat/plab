import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '@/lib/db';
import { generateToken } from '@/lib/auth';

const SSO_JWT_SECRET =
  process.env.SSO_JWT_SECRET ||
  process.env.BRIDGE_JWT_SECRET ||
  process.env.BRIDGE_SECRET ||
  process.env.JWT_SECRET ||
  'your-secret-key-change-this';

const SSO_EXPECTED_ISSUER = process.env.SSO_EXPECTED_ISSUER || "plabcoach";
const DEFAULT_SSO_ROLE = 3;

const ROLES = {
  SUPERADMIN: 1,
  AUTHOR: 2,
  USER: 3
};

function buildUsername(firstName, lastName, email) {
  const name = `${firstName || ''} ${lastName || ''}`
    .trim()
    .replace(/\s+/g, ' ');

  if (name) return name;
  if (email) return email.split('@')[0];
  return 'user';
}

export async function POST(request) {
  try {
    console.log('[SSO] request start', {
      url: request.url,
      origin: request.headers.get('origin'),
      hasAuthHeader: !!request.headers.get('authorization'),
    });

    const { token: tokenFromBody } = await request.json();

    const incomingToken = tokenFromBody;

    console.log('[SSO] token source', {
      fromBody: !!tokenFromBody,
      tokenPreview: incomingToken ? `${incomingToken.slice(0, 20)}...` : null,
    });

    if (!incomingToken) {
      console.log('[SSO] missing token');
      return NextResponse.json(
        { status: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    // =============================
    // STEP 1: VERIFY TOKEN
    // =============================
    let decoded;
    try {
      console.log(SSO_JWT_SECRET);
      decoded = jwt.verify(incomingToken, SSO_JWT_SECRET);
      console.log('[SSO] token decoded', {
        iss: decoded?.iss,
        exp: decoded?.exp,
        jti: decoded?.jti,
        email: decoded?.email,
        first_name: decoded?.first_name,
        last_name: decoded?.last_name,
      });
    } catch (error) {
      console.log('[SSO] verify failed', error.message);
      return NextResponse.json(
        { status: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (decoded?.iss !== SSO_EXPECTED_ISSUER) {
      console.log('[SSO] invalid issuer', {
        expected: SSO_EXPECTED_ISSUER,
        got: decoded?.iss,
      });
      return NextResponse.json(
        { status: false, message: 'Invalid issuer' },
        { status: 401 }
      );
    }

    const tokenId = decoded?.jti;

    console.log('[SSO] jti check', { tokenId });

    if (!tokenId) {
      console.log('[SSO] missing jti');
      return NextResponse.json(
        { status: false, message: 'Token ID (jti) missing' },
        { status: 400 }
      );
    }

    // =============================
    // STEP 2: CHECK JTI (ONE TIME TOKEN)
    // =============================
    const [existingToken] = await pool.query(
      'SELECT jti FROM used_sso_tokens WHERE jti=?',
      [tokenId]
    );

    console.log('[SSO] used token lookup', {
      alreadyUsed: existingToken.length > 0,
      count: existingToken.length,
    });

    if (existingToken.length > 0) {
      console.log('[SSO] token already used');
      return NextResponse.json(
        { status: false, message: 'Token already used' },
        { status: 401 }
      );
    }

    // =============================
    // STEP 3: EXTRACT USER DATA
    // =============================
    const email = (decoded?.email || '').trim().toLowerCase();
    const firstName = decoded?.first_name || '';
    const lastName = decoded?.last_name || '';
    const username = buildUsername(firstName, lastName, email);

    console.log('[SSO] extracted user data', {
      email,
      firstName,
      lastName,
      username,
    });

    if (!email) {
      console.log('[SSO] missing email in token');
      return NextResponse.json(
        { status: false, message: 'Email missing in token' },
        { status: 400 }
      );
    }

    // =============================
    // STEP 4: FIND USER
    // =============================
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role_id, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?`,
      [email]
    );

    console.log('[SSO] user lookup', {
      found: rows.length > 0,
      count: rows.length,
    });

    let user;

    // =============================
    // STEP 5: CREATE USER IF NOT EXISTS
    // =============================
    if (rows.length === 0) {
      console.log('[SSO] creating new user');

      const tempPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const [result] = await pool.query(
        `INSERT INTO users (username, email, password, role_id, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [username, email, hashedPassword, DEFAULT_SSO_ROLE]
      );

      const [newUserRows] = await pool.query(
        `SELECT u.id, u.username, u.email, u.role_id, r.role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id=?`,
        [result.insertId]
      );

      user = newUserRows[0];
      console.log('[SSO] new user created', {
        id: user?.id,
        role_id: user?.role_id,
        role_name: user?.role_name,
      });

    } else {

      user = rows[0];

      console.log('[SSO] existing user found', {
        id: user?.id,
        role_id: user?.role_id,
        role_name: user?.role_name,
      });

      if (username && user.username !== username) {
        console.log('[SSO] updating username', {
          oldUsername: user.username,
          newUsername: username,
        });
        await pool.query(
          'UPDATE users SET username=? WHERE id=?',
          [username, user.id]
        );
        user.username = username;
      }

    }

    // =============================
    // STEP 6: STORE JTI (MARK TOKEN USED)
    // =============================
    console.log('[SSO] storing used jti', {
      tokenId,
      exp: decoded.exp,
    });

    await pool.query(
      'INSERT INTO used_sso_tokens (jti, expires_at) VALUES (?, FROM_UNIXTIME(?))',
      [tokenId, decoded.exp]
    );

    // =============================
    // STEP 7: CREATE SESSION TOKEN
    // =============================
    console.log('[SSO] generating app token', {
      userId: user?.id,
      username: user?.username,
      email: user?.email,
      role_id: user?.role_id,
      hasUser: !!user,
    });

    const appToken = generateToken(user);

    console.log('[SSO] app token generated', {
      tokenPreview: appToken ? `${appToken.slice(0, 20)}...` : null,
    });

    // =============================
    // STEP 8: ROLE BASED REDIRECT
    // =============================
    let redirectUrl = '/';

    switch (user.role_id) {
      case ROLES.SUPERADMIN:
        redirectUrl = '/dashboard/authors';
        break;
      case ROLES.AUTHOR:
        redirectUrl = '/author/books';
        break;
      case ROLES.USER:
        redirectUrl = '/';
        break;
    }

    const baseUrl =
      process.env.SSO_REDIRECT_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      request.nextUrl.origin;

    const response = NextResponse.json({
      status: true,
      message: rows.length === 0
        ? 'User created and logged in'
        : 'User logged in',
      redirectUrl: `${baseUrl}`,
    });

    // =============================
    // STEP 9: SET SESSION COOKIE
    // =============================
    response.cookies.set('token', appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('[SSO] cookie set on response', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      hasTokenCookie: !!response.cookies.get('token'),
    });

    return response;

  } catch (error) {

    console.error('SSO API error:', error);
    console.error('SSO API stack:', error?.stack);

    return NextResponse.json(
      { status: false, message: 'Internal server error' },
      { status: 500 }
    );

  }
}
