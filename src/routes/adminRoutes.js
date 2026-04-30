// =============================================================================
// /api/admin/* — Actions réservées aux administrateurs
// =============================================================================

import { Router } from "express";
import { sql, getPool } from "../db.js";
import { authMiddleware, adminMiddleware } from "../auth.js";
import { handleSqlError } from "../errors.js";

const router = Router();
router.use(authMiddleware, adminMiddleware);

/* ============================ COURSES ====================================== */

// POST /api/admin/races — créer
router.post("/races", async (req, res) => {
  try {
    const { name, description, raceDate, entryFee } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "name requis." } });
    }
    const pool = await getPool();
    const reqst = pool.request();
    reqst.input("CreatedByUserId", sql.UniqueIdentifier, req.user.userId);
    reqst.input("Name", sql.NVarChar(200), name.trim());
    reqst.input("Description", sql.NVarChar(sql.MAX), description || null);
    reqst.input("RaceDate", sql.Date, raceDate || null);
    reqst.input("EntryFee", sql.Decimal(10, 2), Number(entryFee) || 0);
    reqst.output("RaceId", sql.UniqueIdentifier);
    const result = await reqst.execute("dbo.sp_CreateRace");
    res.status(201).json({ raceId: result.output.RaceId });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// PUT /api/admin/races/:id — mettre à jour
router.put("/races/:id", async (req, res) => {
  try {
    const { name, description, raceDate, entryFee } = req.body || {};
    if (!name) {
      return res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "name requis." } });
    }
    const pool = await getPool();
    await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("Name", sql.NVarChar(200), name.trim())
      .input("Description", sql.NVarChar(sql.MAX), description || null)
      .input("RaceDate", sql.Date, raceDate || null)
      .input("EntryFee", sql.Decimal(10, 2), Number(entryFee) || 0)
      .execute("dbo.sp_UpdateRace");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// PATCH /api/admin/races/:id/status — changer le statut
router.patch("/races/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["draft", "open", "closed", "finished"].includes(status)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "status invalide." },
      });
    }
    const pool = await getPool();
    await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("NewStatus", sql.NVarChar(20), status)
      .execute("dbo.sp_ChangeRaceStatus");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// DELETE /api/admin/races/:id
router.delete("/races/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .execute("dbo.sp_DeleteRace");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// POST /api/admin/races/:id/winner — déclarer le gagnant
router.post("/races/:id/winner", async (req, res) => {
  try {
    const { carNumber } = req.body || {};
    if (!carNumber) {
      return res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "carNumber requis." } });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("WinningCarNumber", sql.NVarChar(20), String(carNumber))
      .execute("dbo.sp_DeclareWinner");
    res.json({ winners: result.recordset });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// POST /api/admin/races/:id/reveal — révéler/cacher les numéros (feature 1)
router.post("/races/:id/reveal", async (req, res) => {
  try {
    const { reveal } = req.body || {};
    const pool = await getPool();
    await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("Reveal", sql.Bit, reveal ? 1 : 0)
      .execute("dbo.sp_RevealNumbers");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// PATCH /api/admin/cars/:carId/position — mettre à jour position de départ (feature 2)
router.patch("/cars/:carId/position", async (req, res) => {
  try {
    const { startPosition } = req.body || {};
    const pos =
      startPosition === null || startPosition === "" || startPosition === undefined
        ? null
        : Number(startPosition);
    if (pos !== null && (isNaN(pos) || pos < 0)) {
      return res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "startPosition invalide." } });
    }
    const pool = await getPool();
    await pool
      .request()
      .input("CarId", sql.UniqueIdentifier, req.params.carId)
      .input("StartPosition", sql.Int, pos)
      .execute("dbo.sp_UpdateCarPosition");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

/* ============================== VOITURES =================================== */

// POST /api/admin/races/:id/cars — ajouter une voiture
router.post("/races/:id/cars", async (req, res) => {
  try {
    const { carNumber, driverName, startPosition } = req.body || {};
    if (!carNumber) {
      return res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "carNumber requis." } });
    }
    const pos =
      startPosition === null || startPosition === "" || startPosition === undefined
        ? null
        : Number(startPosition);
    const pool = await getPool();
    const reqst = pool.request();
    reqst.input("RaceId", sql.UniqueIdentifier, req.params.id);
    reqst.input("CarNumber", sql.NVarChar(20), String(carNumber).trim());
    reqst.input("DriverName", sql.NVarChar(200), driverName || null);
    reqst.input("StartPosition", sql.Int, pos);
    reqst.output("CarId", sql.UniqueIdentifier);
    const result = await reqst.execute("dbo.sp_AddCar");
    res.status(201).json({ carId: result.output.CarId });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// POST /api/admin/races/:id/cars/bulk — ajout en lot via TVP
router.post("/races/:id/cars/bulk", async (req, res) => {
  try {
    const { cars } = req.body || {};
    if (!Array.isArray(cars) || cars.length === 0) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "cars (tableau non vide) requis.",
        },
      });
    }

    const tvp = new sql.Table("dbo.CarListType");
    tvp.columns.add("CarNumber", sql.NVarChar(20), { nullable: false });
    tvp.columns.add("DriverName", sql.NVarChar(200), { nullable: true });
    tvp.columns.add("StartPosition", sql.Int, { nullable: true });

    const seen = new Set();
    for (const c of cars) {
      if (!c || !c.carNumber) continue;
      const num = String(c.carNumber).trim();
      if (!num || seen.has(num)) continue;
      seen.add(num);
      const pos =
        c.startPosition === null ||
        c.startPosition === "" ||
        c.startPosition === undefined
          ? null
          : Number(c.startPosition);
      tvp.rows.add(
        num,
        c.driverName ? String(c.driverName).trim() : null,
        pos
      );
    }

    if (tvp.rows.length === 0) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Aucune voiture valide." },
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("RaceId", sql.UniqueIdentifier, req.params.id)
      .input("Cars", tvp)
      .execute("dbo.sp_AddCarsBulk");

    res.status(201).json({
      insertedCount: result.recordset?.[0]?.InsertedCount ?? 0,
    });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// DELETE /api/admin/cars/:carId
router.delete("/cars/:carId", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("CarId", sql.UniqueIdentifier, req.params.carId)
      .execute("dbo.sp_RemoveCar");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

/* ============================== UTILISATEURS =============================== */

// GET /api/admin/users — liste tous les utilisateurs
router.get("/users", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT UserId, Username, Email, IsAdmin, IsActive, CreatedAt
      FROM dbo.Users
      ORDER BY CreatedAt DESC
    `);
    res.json({ users: result.recordset });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// POST /api/admin/users/:id/promote — promouvoir admin
router.post("/users/:id/promote", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("PromoterUserId", sql.UniqueIdentifier, req.user.userId)
      .input("TargetUserId", sql.UniqueIdentifier, req.params.id)
      .execute("dbo.sp_PromoteToAdmin");
    res.json({ ok: true });
  } catch (err) {
    handleSqlError(err, res);
  }
});

export default router;
