import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export const ROLES = {
  SUPERADMIN: 1,
  AUTHOR: 2,
  USER: 3
};

export function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      email: user.email, 
      role_id: user.role_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    var ans = jwt.verify(token, JWT_SECRET);
    console.log("answer is " , ans)
    return ans;
  } catch (error) {
    return null;
  }
}

// ✅ Server side — cookie se user lo (API routes & Server Components)
export async function getUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return null;
    
    const decoded = verifyToken(token);
    if (!decoded) return null;

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role_id, u.created_at, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (rows.length === 0) return null;
    return rows[0];
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// ✅ Server side — token string directly pass karo (URL token ke liye)
export async function getUserFromToken(token) {
  try {
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role_id, u.created_at, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (rows.length === 0) return null;
    return rows[0];
  } catch (error) {
    console.error('getUserFromToken error:', error);
    return null;
  }
}

export function isSuperAdmin(user) { return user?.role_id === ROLES.SUPERADMIN; }
export function isAuthor(user) { return user?.role_id === ROLES.AUTHOR; }
export function isUser(user) { return user?.role_id === ROLES.USER; }
export function hasRole(user, roleId) { return user?.role_id === roleId; }
export function hasAnyRole(user, roleIds) { return user && roleIds.includes(user?.role_id); }
