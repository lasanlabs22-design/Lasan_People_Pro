import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

const secret = () => new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "lasan-pro";

// `tid` pins the token to one workspace; the tenant context for every request comes from it.
export async function signToken(user) {
  return new SignJWT({ tid: user.tenantId, role: user.role, tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(env.JWT_TTL)
    .sign(secret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, algorithms: ["HS256"] });
    return payload.sub && payload.tid ? payload : null;
  } catch {
    return null;
  }
}

export const hashPassword = (plain) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Readable temporary password: no ambiguous characters (0/O, 1/l/I).
export function generateTempPassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export function publicUser(u) {
  return {
    id: u.id,
    employeeCode: u.employeeCode,
    email: u.email,
    role: u.role,
    name: u.name,
    gender: u.gender,
    designation: u.designation,
    department: u.department,
    dateOfJoining: u.dateOfJoining,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    photoPunch: u.photoPunch,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}
