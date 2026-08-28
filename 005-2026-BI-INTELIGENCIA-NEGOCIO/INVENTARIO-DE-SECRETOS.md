# INVENTARIO DE SECRETOS · BI

> Este archivo lista SOLO los NOMBRES de las variables sensibles del proyecto BI.
> **Los valores NUNCA aparecen aquí.** Viven en `.env.bi.production` en el VPS (fuera de git).
> Para cada variable consultar al propietario (Jelkin) o el gestor de contraseñas IDC.

| Variable | Descripción | Dónde se usa |
|---|---|---|
| `JWT_SECRET` | Secreto compartido con PI · emite y valida tokens de sesión | compose: bi-next · src/lib/auth/jwt.ts |
| `SUPERSET_DB_PASSWORD` | Contraseña del usuario `superset` en bi-superset-db | compose: bi-superset · bi-superset-db |
| `SUPERSET_SECRET_KEY` | Clave de cifrado de Superset (mínimo 32 chars) | compose: bi-superset |
| `SUPERSET_ADMIN_PASSWORD` | Contraseña del usuario admin del panel Superset | compose: bi-superset (init) |
| `REPLICA_DB_PASSWORD` | Contraseña del usuario `bi_reader` en bi-db-replica | compose: bi-db-replica · bi-vanna |
| `PI_REPLICA_PASSWORD` | Contraseña del usuario `bi_replica` en pi-db (rol de replicación) | SQL: `01-pi-db-crear-usuario-replica.sql` · Jelkin ejecuta |
| `BI_ADMIN_DATABASE_URL` | URL completa de conexión de `bi_admin` (write en `bi_catalogo_*` · SPEC-007) | Prisma migrate/seed · `scripts/catalogo-cli.mjs` |
| `BI_ADMIN_PASSWORD` | Contraseña del usuario `bi_admin` en `bi-db-replica` (SPEC-007) | INSTRUCTIVO Paso C-5b · CREATE USER bi_admin |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (generado por @BotFather) | compose: bi-telegram |
| `TELEGRAM_AUTHORIZED_CHATS` | IDs de chats autorizados (chat_id de Jelkin) | compose: bi-telegram |

---

> **Regla dura:** ninguna de estas variables aparece en commits, logs, chat, ni documentos.
> Origen: candado §4 constitution.md + regla I-22/I-142/I-144 de PI.
> F3C: 2026-08-28 · Autor: bi-dev-2
