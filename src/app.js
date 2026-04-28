// =============================================================================
// app.js — Application Express. Exportée pour usage local (server.js) et
// serverless (api/index.js).
// =============================================================================

import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import raceRoutes from "./routes/raceRoutes.js";
import meRoutes from "./routes/meRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// --- CORS ---
const allowed = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowed.includes("*") ? true : allowed,
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// --- Body parsing ---
app.use(express.json({ limit: "1mb" }));

// --- Routes ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/races", raceRoutes);
app.use("/api/me", meRoutes);
app.use("/api/admin", adminRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Endpoint ${req.method} ${req.path} introuvable.` },
  });
});

// --- Filet de sécurité erreurs ---
app.use((err, req, res, _next) => {
  console.error("[unhandled]", err);
  if (res.headersSent) return;
  res.status(500).json({
    error: { code: "SERVER_ERROR", message: "Erreur serveur." },
  });
});

export default app;
