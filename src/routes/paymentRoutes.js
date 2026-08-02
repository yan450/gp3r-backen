// =============================================================================
// /api/payments/* — Panier utilisateur + déclarations de paiement
// =============================================================================

import { Router } from "express";
import { sql, getPool } from "../db.js";
import { authMiddleware } from "../auth.js";
import { handleSqlError } from "../errors.js";

const router = Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// GET /api/payments/cart — mon panier + solde + historique
// -----------------------------------------------------------------------------
router.get("/cart", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, req.user.userId)
      .execute("dbo.sp_GetUserCart");

    const summary = result.recordsets[0]?.[0] || null;
    const entries = result.recordsets[1] || [];
    const history = result.recordsets[2] || [];

    // Adresse Interac configurée côté serveur (variable d'environnement)
    // Valeur par défaut si la variable n'est pas définie
    const interacEmail = process.env.INTERAC_EMAIL || "yanfrenette@gmail.com";
    const interacName = process.env.INTERAC_NAME || "Yan Frenette";
    const interacPassword = process.env.INTERAC_PASSWORD || "";

    res.json({
      summary,
      entries,
      history,
      interac: {
        email: interacEmail,
        name: interacName,
        securityPassword: interacPassword,
      },
    });
  } catch (err) {
    handleSqlError(err, res);
  }
});

// -----------------------------------------------------------------------------
// POST /api/payments/declare — je déclare avoir viré l'Interac
// -----------------------------------------------------------------------------
router.post("/declare", async (req, res) => {
  try {
    const { reference, note } = req.body || {};
    const pool = await getPool();
    const reqst = pool.request();
    reqst.input("UserId", sql.UniqueIdentifier, req.user.userId);
    reqst.input("Reference", sql.NVarChar(200), reference || null);
    reqst.input("Note", sql.NVarChar(500), note || null);
    reqst.output("PaymentId", sql.UniqueIdentifier);
    const result = await reqst.execute("dbo.sp_DeclarePayment");
    res.status(201).json({
      paymentId: result.output.PaymentId,
      amount: result.recordset?.[0]?.Amount ?? 0,
    });
  } catch (err) {
    handleSqlError(err, res);
  }
});

export default router;
