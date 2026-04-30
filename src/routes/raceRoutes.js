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
// Si NumbersRevealed = 0 et que l'utilisateur n'est pas admin, on cache les
// holders qui ne sont pas l'utilisateur lui-même (feature 1).
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

    const race = result.recordsets[0][0];
    let grid = result.recordsets[1] || [];
    let participants = result.recordsets[2] || [];

    // La vue retourne les holders en JSON string — on parse ici
    grid = grid.map((cell) => {
      let holders = [];
      if (cell.HoldersJson) {
        try {
          holders = JSON.parse(cell.HoldersJson);
        } catch {
          holders = [];
        }
      }
      return { ...cell, Holders: holders, HoldersJson: undefined };
    });

    // Masquage si NumbersRevealed = false et user non admin
    const shouldHide = !race.NumbersRevealed && !req.user.isAdmin;
    if (shouldHide) {
      const myUserId = String(req.user.userId).toLowerCase();

      // Sur la grille : on garde seulement les holders qui sont l'utilisateur courant
      grid = grid.map((cell) => ({
        ...cell,
        Holders: (cell.Holders || []).filter(
          (h) => String(h.HolderUserId).toLowerCase() === myUserId
        ),
      }));

      // Sur la liste participants : on ne garde que ses propres entrées
      participants = participants.filter(
        (p) => String(p.UserId).toLowerCase() === myUserId
      );
    }

    res.json({ race, grid, participants });
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
