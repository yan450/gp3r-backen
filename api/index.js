// =============================================================================
// Point d'entrée Vercel. Le rewrite dans vercel.json envoie tous les /api/*
// vers cette fonction, qui exporte simplement l'app Express.
// =============================================================================
import app from "../src/app.js";
export default app;
