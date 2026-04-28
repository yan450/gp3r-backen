// =============================================================================
// server.js — Démarrage local (node server.js ou npm run dev).
// Ignoré par Vercel (qui utilise api/index.js comme point d'entrée).
// =============================================================================

import "dotenv/config";
import app from "./src/app.js";

const port = parseInt(process.env.PORT || "3000", 10);

app.listen(port, () => {
  console.log("─────────────────────────────────────────────");
  console.log("  GP3R Tirages — API");
  console.log(`  Écoute sur http://localhost:${port}`);
  console.log(`  Healthcheck: http://localhost:${port}/api/health`);
  console.log("─────────────────────────────────────────────");
});
