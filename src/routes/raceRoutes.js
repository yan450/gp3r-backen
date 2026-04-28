// =============================================================================
// /api/races/* — Lecture des courses + participation (tirage)
// =============================================================================

import { Router } from "express";
import { sql, getPool } from "../db.js";
import { authMiddleware } from "../auth.js";
import { handleSqlError } from "../errors.js";

const router = Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// GET /api/races — liste (admins voient aussi les brouillons)
// -----------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("IncludeDrafts", sql.Bit, req.user.isAdmin ? 1 : 0)
      .execute("dbo.sp_ListRaces");
    res.json({ races: result.recordset });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// -----------------------------------------------------------------------------
// GET /api/races/:id — détails complets (race + grille + participants)
// -----------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .execute("dbo.sp_GetRaceDetails");

    if (!result.recordsets[0] || result.recordsets[0].length === 0) {
      return res.status(404).json({
        error: { code: "RACE_NOT_FOUND", message: "Course introuvable." },
      });
    }

    res.json({
      race: result.recordsets[0][0],
      grid: result.recordsets[1] || [],
      participants: result.recordsets[2] || [],
    });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// -----------------------------------------------------------------------------
// POST /api/races/:id/join — pige un numéro aléatoire
// La logique de tirage atomique est dans sp_JoinRace (SERIALIZABLE + UPDLOCK)
// -----------------------------------------------------------------------------
router.post("/:id/join", async (req, res) => {
  try {
    const { paymentMethod, paymentReference } = req.body || {};
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("UserId", sql.UniqueIdentifier, req.user.userId)
      .input("PaymentMethod", sql.NVarChar(50), paymentMethod || "simulated")
      .input(
        "PaymentReference",
        sql.NVarChar(100),
        paymentReference || null
      )
      .execute("dbo.sp_JoinRace");

    res.status(201).json({ entry: result.recordset[0] });
  } catch (err) {
    handleSqlError(err, res);
  }
});

export default router;
