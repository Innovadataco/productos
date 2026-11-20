#!/usr/bin/env node
// Corre las pruebas de integración contra la base de PRUEBAS, nunca contra la de trabajo.
// Candado: si DATABASE_URL_TEST no apunta a una base cuyo nombre termina en `_test`, se niega
// (un `prisma migrate reset` sobre la base equivocada borraría todo).
import { spawnSync } from "node:child_process";

const porDefecto = "postgresql://inversiones:inversiones_dev@localhost:5438/inversiones_test?schema=public";
const url = process.env.DATABASE_URL_TEST ?? porDefecto;

let nombreBase;
try {
  nombreBase = new URL(url).pathname.replace(/^\//, "");
} catch {
  console.error("❌ DATABASE_URL_TEST no es una URL válida.");
  process.exit(1);
}
if (!nombreBase.endsWith("_test")) {
  console.error(`❌ La base de pruebas debe terminar en «_test» (llegó «${nombreBase}»). No se toca.`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };
const pasos = [
  ["npx", ["prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"]],
  ["npx", ["vitest", "run", "--config", "vitest.integracion.config.ts"]],
];
for (const [cmd, args] of pasos) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
