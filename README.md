# GP3R Tirages — Backend API

API REST Node.js / Express qui fait le pont entre le frontend React et la base SQL Server.

## Stack

- Node.js 20+
- Express 4
- `mssql` (driver SQL Server officiel)
- `bcryptjs` + `jsonwebtoken` pour l'authentification
- Déployable sur Vercel (serverless) ou n'importe quel host Node

## Architecture

```
.
├── api/index.js            ← point d'entrée Vercel (1 seule fonction)
├── server.js               ← point d'entrée local (node/npm run dev)
├── src/
│   ├── app.js              ← app Express, monte les routes
│   ├── db.js               ← pool SQL avec cache pour serverless
│   ├── auth.js             ← bcrypt + JWT + middlewares
│   ├── errors.js           ← mapping codes SQL → HTTP
│   └── routes/
│       ├── authRoutes.js   ← /api/auth/*
│       ├── raceRoutes.js   ← /api/races/*
│       ├── meRoutes.js     ← /api/me/*
│       └── adminRoutes.js  ← /api/admin/*
├── package.json
├── vercel.json
└── .env.example
```

Tous les endpoints délèguent la logique aux **procédures stockées** SQL — le backend ne fait que valider, authentifier, et router.

---

## Démarrage local

```bash
npm install
cp .env.example .env
# Éditer .env avec les vraies valeurs (surtout SQL_PASSWORD et JWT_SECRET)
npm run dev
```

L'API tourne sur `http://localhost:3000`. Tester avec :

```bash
curl http://localhost:3000/api/health
```

### Générer un JWT_SECRET sécurisé

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Coller la valeur dans `.env` sous `JWT_SECRET=`.

---

## Variables d'environnement

| Variable | Description | Exemple |
|---|---|---|
| `SQL_SERVER` | Hostname SQL Server | `mssql-205717-0.cloudclusters.net` |
| `SQL_PORT` | Port | `10053` |
| `SQL_DATABASE` | Nom de la base | `GP3R_Tirages` |
| `SQL_USER` | Utilisateur | `Y450` |
| `SQL_PASSWORD` | Mot de passe | (secret) |
| `SQL_TRUST_CERT` | `true` si cert auto-signé | `true` |
| `JWT_SECRET` | Clé pour signer les JWT (64+ chars random) | (secret) |
| `ALLOWED_ORIGINS` | URLs frontend autorisées (comma-separated) | `https://mon-app.vercel.app` |
| `PORT` | (Local seulement) | `3000` |

---

## Déploiement Vercel

1. Push le projet sur GitHub
2. Sur [vercel.com](https://vercel.com) → **Add New… → Project** → importer le repo
3. **Framework preset** : `Other`
4. **Build & Output Settings** : laisser par défaut (Vercel détecte `api/`)
5. **Environment Variables** : ajouter chacune des variables ci-dessus
6. **Deploy**

L'API sera disponible à `https://<projet>.vercel.app/api/*`.

> 💡 Configurer `ALLOWED_ORIGINS` avec l'URL exacte du frontend une fois déployé, sinon les requêtes seront bloquées par CORS.

---

## API Reference

Toutes les réponses sont en JSON. Les requêtes authentifiées doivent inclure le header :

```
Authorization: Bearer <token>
```

### Authentification

#### `POST /api/auth/register`
Crée un compte. Le **premier compte créé** devient automatiquement administrateur.
```json
// Body
{ "username": "alice", "password": "secret123", "email": "alice@x.com" }
// Réponse 201
{ "token": "eyJ...", "user": { "userId": "...", "username": "alice", "isAdmin": true } }
```

#### `POST /api/auth/login`
```json
{ "username": "alice", "password": "secret123" }
// → { token, user }
```

#### `GET /api/auth/me`
Retourne l'utilisateur courant (depuis le JWT). 🔒 *Auth requise*

### Mes données

#### `GET /api/me`
Profil courant. 🔒

#### `GET /api/me/races`
Toutes les courses où j'ai pigé un numéro (avec drapeau `DidIWin`). 🔒

### Courses

#### `GET /api/races`
Liste des courses. Les admins voient aussi les brouillons. 🔒

#### `GET /api/races/:id`
Détails complets : 🔒
```json
{
  "race": { /* infos + cagnotte calculée */ },
  "grid": [ /* toutes les voitures + détenteur */ ],
  "participants": [ /* qui a pigé quoi */ ]
}
```

#### `POST /api/races/:id/join`
Pige un numéro aléatoire (atomique côté SQL). 🔒
```json
// Body (optionnel)
{ "paymentMethod": "stripe", "paymentReference": "pi_..." }
// Réponse 201
{ "entry": { "EntryId": "...", "CarNumber": "44", "DriverName": "Lewis Hamilton", "AmountPaid": 10 } }
```

### Admin (🔒 + admin requis)

#### `POST /api/admin/races`
```json
{ "name": "GP3R 2026", "raceDate": "2026-08-08", "entryFee": 10, "description": "..." }
// → { "raceId": "..." }
```

#### `PUT /api/admin/races/:id`
Mêmes champs que ci-dessus.

#### `PATCH /api/admin/races/:id/status`
```json
{ "status": "open" }   // draft | open | closed | finished
```

#### `DELETE /api/admin/races/:id`

#### `POST /api/admin/races/:id/cars`
```json
{ "carNumber": "44", "driverName": "Lewis Hamilton" }
```

#### `POST /api/admin/races/:id/cars/bulk`
```json
{
  "cars": [
    { "carNumber": "1",  "driverName": "Verstappen" },
    { "carNumber": "44", "driverName": "Hamilton" }
  ]
}
// → { "insertedCount": 2 }
```

#### `DELETE /api/admin/cars/:carId`

#### `POST /api/admin/races/:id/winner`
```json
{ "carNumber": "44" }
// → { "winner": { "WinnerUsername": "alice", "Pot": 250.00, ... } }
```

#### `GET /api/admin/users`

#### `POST /api/admin/users/:id/promote`

---

## Format d'erreur

```json
{ "error": { "code": "ALREADY_JOINED", "message": "Vous avez déjà participé à cette course." } }
```

| Code | Status | Signification |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Token manquant |
| `AUTH_INVALID` | 401 | Token invalide ou expiré |
| `INVALID_CREDENTIALS` | 401 | Username/password faux |
| `FORBIDDEN` | 403 | Pas admin |
| `NOT_ADMIN` | 403 | Pas admin (depuis SQL) |
| `RACE_NOT_FOUND` | 404 | Course introuvable |
| `USERNAME_TAKEN` | 409 | Username déjà pris |
| `RACE_NOT_OPEN` | 409 | Course pas ouverte aux inscriptions |
| `ALREADY_JOINED` | 409 | Déjà inscrit à cette course |
| `RACE_LOCKED` | 409 | Course fermée/terminée |
| `CAR_TAKEN` | 409 | Voiture déjà pigée |
| `FEE_LOCKED` | 409 | Mise verrouillée (participants existent) |
| `NO_NUMBERS` | 410 | Plus de numéros disponibles |

---

## Sécurité — checklist production

- [ ] **Pivoter le mot de passe SQL** une fois le développement complété
- [ ] Créer un **utilisateur SQL applicatif** avec uniquement les permissions `EXECUTE` sur les procédures (pas `db_owner`)
- [ ] Activer l'**IP allowlist** sur CloudClusters pour accepter uniquement les IPs Vercel
- [ ] Restreindre `ALLOWED_ORIGINS` à l'URL exacte du frontend (jamais `*` en prod)
- [ ] Vérifier que `JWT_SECRET` fait 64+ caractères aléatoires
- [ ] Augmenter `BCRYPT_ROUNDS` à 14 si la latence le permet (actuellement 12)
- [ ] Surveiller le rate limit sur `/auth/*` (30 req / 15 min par IP par défaut)

## Bonus — créer un user SQL applicatif

```sql
USE GP3R_Tirages;
CREATE LOGIN gp3r_app WITH PASSWORD = 'STRONG_PASSWORD_HERE';
CREATE USER gp3r_app FOR LOGIN gp3r_app;

-- Donner uniquement EXECUTE sur les procs et SELECT sur les vues
GRANT EXECUTE ON SCHEMA::dbo TO gp3r_app;
GRANT SELECT ON dbo.vw_RaceSummary TO gp3r_app;
GRANT SELECT ON dbo.vw_RaceGrid TO gp3r_app;
GRANT SELECT ON dbo.vw_RaceParticipants TO gp3r_app;
GRANT SELECT ON dbo.Users TO gp3r_app;  -- pour la requête admin/users
```

Puis utiliser `gp3r_app` au lieu de `Y450` dans `.env` — tu réduis énormément la surface d'attaque en cas de fuite du mot de passe.
