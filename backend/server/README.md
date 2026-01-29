Servidor (Node.js + Express)

Resumen tecnico
- Runtime: Node.js + Express
- Seguridad: Helmet (CSP), CORS configurable, HPP, xss-clean, compresion
- Base de datos: SQLite (better-sqlite3 via backend/server/db/pg.js)
- Autenticacion: JWT (access/refresh), lista negra en memoria para revocacion, persistencia de refresh tokens en DB
- Limitacion de tasa: rate-limits globales y por ruta de login

Estructura
- index.js: configuracion de app (CSP, CORS, middlewares), carga de rutas bajo `/api`, arranque del servidor.
- routes/: definicion de endpoints (auth, productos, categorias, clientes, etc.).
- controllers/: logica de entrada/salida HTTP; delega a repositorios.
- db/pg.js: pool de conexion y helpers de transacciones.
- db/repositories/: consultas SQL por dominio (usuarios, productos, categorias, clientes, tokens, etc.).
- middlewares/: autenticacion JWT, control de roles, seguridad y rate-limits.
- utils/: helpers varios (mailer para 2FA, si corresponde).

Base de datos
- Esquema base en `backend/database/migrations_sqlite/V1__init.sql` (usuarios, roles, productos, categorias, inventario, ventas, pagos, etc.).
- Semillas basicas en `backend/database/seed.sql` (roles) y migraciones en `backend/database/migrations_sqlite`.

Autenticacion y autorizacion
- Login: `POST /api/login` valida credenciales y entrega access/refresh tokens.
- Refresh: `POST /api/refresh-token` valida refresh token persistido y entrega nuevo access token.
- Logout: `POST /api/logout` (revoca refresh y agrega access a blacklist en memoria).
- Autorizacion por rol: middleware `requireRole([...])` aplicado en rutas criticas (p. ej. categorias, productos, usuarios).

Endpoints principales (resumen)
- `GET /api/productos` (publico lectura), `POST/PUT/DELETE /api/productos` (admin/gerente).
- `GET /api/categorias` (publico lectura), `POST/PUT/DELETE /api/categorias` (admin/gerente; delete admin).
- `GET /api/clientes` (autenticado), `POST/PUT /api/clientes` (admin/gerente/vendedor).
- `POST /api/login`, `POST /api/refresh-token`, `POST /api/logout`.

Variables de entorno (no incluir valores en el repositorio)
- JWT/seguridad: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_ALG`, `JWT_ISSUER`, `JWT_AUDIENCE`.
- CORS/CSP: `CORS_ALLOWED_ORIGINS`, `PUBLIC_ORIGIN`, `TRUST_PROXY`, `FORCE_HTTPS`.
- SQLite: `SQLITE_PATH` (opcional).
- SMTP (opcional 2FA): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`.

Puesta en marcha local
1) (Opcional) Definir `SQLITE_PATH` para el archivo SQLite.
2) Aplicar migraciones:
   - `cd backend/server`
   - `npm run migrate`
3) Semillas (opcional): ejecutar `backend/database/seed.sql` con un cliente SQLite.
4) Instalar y ejecutar:
   - `cd backend/server`
   - `npm install`
   - `npm run dev`

Consideraciones
- El servidor asume que el frontend de desarrollo (Vite) hace proxy de `/api` a `127.0.0.1:3000`.
- `.gitignore` excluye `.env` y artefactos de compilacion/coverage.
