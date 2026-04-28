// =============================================================================
// db.js — Pool de connexion SQL Server (mis en cache pour les invocations
// "warm" en serverless ; recréé sur cold start)
// =============================================================================

import sql from "mssql";

function buildConfig() {
  const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Variables d'environnement SQL manquantes : ${missing.join(", ")}`
    );
  }

  return {
    server: process.env.SQL_SERVER,
    port: parseInt(process.env.SQL_PORT || "1433", 10),
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    requestTimeout: 30_000,
    connectionTimeout: 15_000,
  };
}

let poolPromise = null;

export async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(buildConfig()).catch((err) => {
      // Reset on failure pour permettre une nouvelle tentative au prochain appel
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// Helper pratique : crée une nouvelle Request rattachée au pool
export async function newRequest() {
  const pool = await getPool();
  return pool.request();
}

export { sql };
