import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const TOKEN_EXPIRY = '7d';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export async function registerUser({ email, password, fullName, role }) {
  const normalizedEmail = normalizeEmail(email);

  const existing = await pool.query(
    'SELECT id FROM users WHERE lower(email) = $1',
    [normalizedEmail]
  );
  if (existing.rows.length > 0) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, created_at`,
    [normalizedEmail, passwordHash, fullName, role]
  );

  return rows[0];
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE lower(email) = $1',
    [normalizedEmail]
  );
  if (rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  // Prefer exact lowercase row if duplicates exist from older case-sensitive inserts
  const user =
    rows.find((r) => r.email === normalizedEmail) ||
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, jwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
  });

  return {
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
  };
}

export function verifyToken(token) {
  return jwt.verify(token, jwtSecret());
}
