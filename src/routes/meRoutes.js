// =============================================================================
// /api/me/* — Profil et participations de l'utilisateur courant
// =============================================================================

import { Router } from "express";
import { sql, getPool } from "../db.js";
import { authMiddleware } from "../auth.js";
import { handleSqlError } from "../errors.js";

const router = Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// GET /api/me — info de base (depuis le JWT)
// -----------------------------------------------------------------------------
router.get("/", (req, res) => {
  res.json({ user: req.user });
});

// -----------------------------------------------------------------------------
// GET /api/me/races — toutes les courses où j'ai pigé
// -----------------------------------------------------------------------------
router.get("/races", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, req.user.userId)
      .execute("dbo.sp_GetUserRaces");
    res.json({ races: result.recordset });
  } catch (err) {
    handleSqlError(err, res);
  }
});

export default router;
