/**
 * FIX-CI (002-PI-056): crea el schema de pg-boss en una BD fresca (idempotente).
 * `prisma migrate deploy` no lo cubre: las tablas `pgboss.*` las crea el propio
 * pg-boss en su primer `start()`. Sin ellas, los tests/paths que consultan
 * `pgboss.job` (cola, reconciliación) fallan con 42P01 en BDs nuevas (CI).
 * Uso: DATABASE_URL=... node scripts/ensure-pgboss.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PgBoss } = require("pg-boss"); // CJS: named export (v10+)

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[PGBOSS] DATABASE_URL requerida");
    process.exit(1);
}

const boss = new PgBoss(DATABASE_URL);
await boss.start(); // crea/migra el schema pgboss (idempotente)
await boss.stop();
console.log("[PGBOSS] Schema listo");
