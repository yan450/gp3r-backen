// =============================================================================
// errors.js — Convertit les codes THROW de SQL Server (50100, 50200, ...)
// en réponses HTTP cohérentes avec un message en français.
// =============================================================================

const SQL_ERROR_MAP = {
  // Utilisateurs
  50100: { status: 409, code: "USERNAME_TAKEN" },
  50110: { status: 403, code: "NOT_ADMIN" },

  // Courses
  50200: { status: 403, code: "NOT_ADMIN" },
  50210: { status: 409, code: "FEE_LOCKED" },
  50220: { status: 400, code: "INVALID_STATUS" },
  50221: { status: 404, code: "RACE_NOT_FOUND" },
  50222: { status: 409, code: "NO_CARS" },
  50223: { status: 409, code: "RACE_FINISHED" },

  // Voitures
  50300: { status: 409, code: "RACE_LOCKED" },
  50310: { status: 409, code: "CAR_TAKEN" },

  // Tirage / participations
  50400: { status: 404, code: "RACE_NOT_FOUND" },
  50401: { status: 409, code: "RACE_NOT_OPEN" },
  50402: { status: 409, code: "ALREADY_JOINED" },
  50403: { status: 410, code: "NO_NUMBERS" },

  // Gagnant
  50500: { status: 404, code: "RACE_NOT_FOUND" },
  50501: { status: 400, code: "INVALID_NUMBER" },
};

export function handleSqlError(err, res) {
  // mssql expose le numéro de THROW dans err.number
  const sqlNum = err?.number;
  const mapped = sqlNum && SQL_ERROR_MAP[sqlNum];

  if (mapped) {
    return res.status(mapped.status).json({
      error: {
        code: mapped.code,
        message: cleanMessage(err.message),
      },
    });
  }

  // Erreurs SQL non mappées : violation de contrainte unique, etc.
  if (sqlNum === 2627 || sqlNum === 2601) {
    return res.status(409).json({
      error: { code: "DUPLICATE", message: "Cette donnée existe déjà." },
    });
  }
  if (sqlNum === 547) {
    return res.status(409).json({
      error: {
        code: "FK_CONSTRAINT",
        message: "Référence invalide vers une autre entité.",
      },
    });
  }

  // Fallback : log et renvoie 500 sans fuiter l'erreur exacte
  console.error("Erreur non gérée:", err);
  return res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: "Une erreur serveur est survenue.",
    },
  });
}

function cleanMessage(msg) {
  if (!msg) return "Erreur inconnue.";
  // Enlève les préfixes ajoutés par le driver
  return msg.replace(/^Error:\s*/i, "").trim();
}
