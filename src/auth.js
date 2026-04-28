// =============================================================================
// auth.js — Hashing de mot de passe (bcrypt), JWT et middlewares
// =============================================================================

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_EXPIRES_IN = "7d";
const BCRYPT_ROUNDS = 12;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET manquant ou trop court (min. 32 caractères)."
    );
  }
  return secret;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.UserId,
      username: user.Username,
      isAdmin: !!user.IsAdmin,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Middleware : exige un Bearer token valide. Remplit req.user.
export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return res.status(401).json({
      error: { code: "AUTH_REQUIRED", message: "Token requis." },
    });
  }
  try {
    const payload = jwt.verify(parts[1], getJwtSecret());
    req.user = {
      userId: payload.sub,
      username: payload.username,
      isAdmin: !!payload.isAdmin,
    };
    next();
  } catch {
    return res.status(401).json({
      error: { code: "AUTH_INVALID", message: "Token invalide ou expiré." },
    });
  }
}

// Middleware : exige les privilèges admin (à mettre APRÈS authMiddleware)
export function adminMiddleware(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Privilèges administrateur requis." },
    });
  }
  next();
}
