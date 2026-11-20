#!/usr/bin/env node
// Corre las pruebas de integración contra la base de PRUEBAS, nunca contra la de trabajo.
// Candado: se niega si DATABASE_URL_TEST no apunta a una base local (localhost, 127.0.0.1 o ::1)
// cuyo nombre termina en `_test` (un `prisma migrate reset` sobre la base equivocada borraría todo).
// En CI se puede ampliar la lista de hosts con INV_HOSTS_PRUEBA (separados por coma).
import { spawnSync } from "node:child_process";

const porDefecto = "postgresql://inversiones:inversiones_dev@localhost:5438/inversiones_test?schema=public";
const url = process.env.DATABASE_URL_TEST ?? porDefecto;

const hostsPermitidos = new Set(["localhost", "127.0.0.1", "[::1]", ...(process.env.INV_HOSTS_PRUEBA ?? "").split(",").filter(Boolean)]);

let nombreBase;
let host;
try {
  const u = new URL(url);
  nombreBase = decodeURIComponent(u.pathname.replace(/^\//, ""));
  host = u.hostname;
} catch {
  console.error("❌ DATABASE_URL_TEST no es una URL válida.");
  process.exit(1);
}
if (!hostsPermitidos.has(host)) {
  console.error(`❌ La base de pruebas debe ser local (llegó el host «${host}»). No se toca.`);
  process.exit(1);
}
if (!nombreBase.endsWith("_test")) {
  console.error(`❌ La base de pruebas debe terminar en «_test» (llegó «${nombreBase}»). No se toca.`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };
const pasos = [
  ["node_modules/.bin/prisma", ["migrate", "reset", "--force", "--skip-generate", "--skip-seed"]],
  ["node_modules/.bin/vitest", ["run", "--config", "vitest.integracion.config.ts"]],
];
for (const [cmd, args] of pasos) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
