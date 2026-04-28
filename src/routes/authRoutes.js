// =============================================================================
// /api/auth/* — Inscription, connexion, info user courant
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sql, getPool } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  authMiddleware,
} from "../auth.js";
import { handleSqlError } from "../errors.js";

const router = Router();

// Limite les tentatives de login/register pour ralentir le brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

// -----------------------------------------------------------------------------
// POST /api/auth/register
// -----------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "username et password sont requis." },
      });
    }
    if (typeof username !== "string" || username.trim().length < 2 || username.length > 50) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "username invalide (2 à 50 caractères)." },
      });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Mot de passe trop court (6+ caractères)." },
      });
    }

    const passwordHash = await hashPassword(password);
    const pool = await getPool();

    // 1. Création
    const reg = pool.request();
    reg.input("Username", sql.NVarChar(50), username.trim());
    reg.input("PasswordHash", sql.NVarChar(255), passwordHash);
    reg.input("Email", sql.NVarChar(254), email || null);
    reg.output("UserId", sql.UniqueIdentifier);
    await reg.execute("dbo.sp_RegisterUser");

    // 2. Récupérer l'utilisateur (pour avoir IsAdmin résolu)
    const lookup = await pool
      .request()
      .input("Username", sql.NVarChar(50), username.trim())
      .execute("dbo.sp_GetUserByUsername");
    const user = lookup.recordset[0];

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        userId: user.UserId,
        username: user.Username,
        isAdmin: !!user.IsAdmin,
      },
    });
  } catch (err) {
    return handleSqlError(err, res);
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "username et password sont requis." },
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Username", sql.NVarChar(50), String(username).trim())
      .execute("dbo.sp_GetUserByUsername");

    const user = result.recordset[0];
    if (!user || !user.IsActive) {
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Identifiants invalides." },
      });
    }

    const ok = await verifyPassword(password, user.PasswordHash);
    if (!ok) {
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Identifiants invalides." },
      });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        userId: user.UserId,
        username: user.Username,
        isAdmin: !!user.IsAdmin,
      },
    });
  } catch (err) {
    return handleSqlError(err, res);
  }
});

// -----------------------------------------------------------------------------
// GET /api/auth/me
// -----------------------------------------------------------------------------
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
