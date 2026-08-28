#!/usr/bin/env node
// scripts/catalogo-cli.mjs · CLI de gestion del catalogo BI
// SPEC-010 · F3C 2026-08-28 · Autor: bi-dev-2
// Uso: node scripts/catalogo-cli.mjs <comando> [args]

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getDatabaseUrl() {
  if (process.env.BI_ADMIN_DATABASE_URL) return process.env.BI_ADMIN_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(__dirname, "../.env.bi.production");
  try {
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^BI_ADMIN_DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  throw new Error(
    "BI_ADMIN_DATABASE_URL no encontrada. Exportar variable de entorno o crear .env.bi.production"
  );
}

export function getFlag(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

export async function listTablas(prisma) {
  const tablas = await prisma.bICatalogoTabla.findMany({
    where: { activo: true },
    orderBy: { nombreFuente: "asc" },
  });
  console.table(
    tablas.map((t) => ({
      nombreFuente: t.nombreFuente,
      legible: t.nombreLegible,
      roles: t.rolesPermitidos.join(","),
    }))
  );
  return tablas;
}

export async function addTabla(prisma, args) {
  const nombre = args[0];
  const legible = getFlag(args, "--legible");
  const descripcion = getFlag(args, "--descripcion") ?? "";
  const roles = (getFlag(args, "--roles") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!nombre || !legible) {
    console.error('Uso: add-tabla <nombre> --legible "X" [--descripcion "Y"] [--roles ADMIN,SCHOOL_ADMIN]');
    process.exit(1);
  }
  const result = await prisma.bICatalogoTabla.upsert({
    where: { nombreFuente: nombre },
    create: { nombreFuente: nombre, nombreLegible: legible, descripcion, rolesPermitidos: roles },
    update: { nombreLegible: legible, descripcion, rolesPermitidos: roles },
  });
  console.log(`OK: tabla ${result.id} (${result.nombreFuente})`);
  return result;
}

export async function addEjemplo(prisma, args) {
  const pregunta = getFlag(args, "--pregunta");
  const sql = getFlag(args, "--sql");
  const categoria = getFlag(args, "--categoria") ?? "general";
  if (!pregunta || !sql) {
    console.error('Uso: add-ejemplo --pregunta "X" --sql "Y" [--categoria general]');
    process.exit(1);
  }
  const result = await prisma.bICatalogoEjemplo.upsert({
    where: { preguntaNL: pregunta },
    create: { preguntaNL: pregunta, sql, categoriaConsulta: categoria },
    update: { sql, categoriaConsulta: categoria },
  });
  console.log(`OK: ejemplo ${result.id}`);
  return result;
}

export async function listConsultas(prisma, args) {
  const usuario = getFlag(args, "--usuario");
  const dias = parseInt(getFlag(args, "--dias") ?? "7", 10);
  const desde = new Date(Date.now() - dias * 86_400_000);
  const consultas = await prisma.bIConsultaLog.findMany({
    where: {
      ...(usuario ? { usuarioId: usuario } : {}),
      creadoEn: { gte: desde },
    },
    orderBy: { creadoEn: "desc" },
    take: 50,
  });
  console.table(
    consultas.map((c) => ({
      id: c.id.slice(0, 8),
      usuario: c.usuarioId,
      pregunta: c.preguntaNL.slice(0, 60),
      estado: c.estado,
      creadoEn: c.creadoEn.toISOString().slice(0, 19),
    }))
  );
  return consultas;
}

export async function aprobarCache(prisma, args) {
  const consultaId = args[0];
  if (!consultaId) {
    console.error("Uso: aprobar-cache <consulta_id>");
    process.exit(1);
  }
  const consulta = await prisma.bIConsultaLog.findUniqueOrThrow({
    where: { id: consultaId },
  });
  if (!consulta.sqlGenerado) {
    console.error(`consulta ${consultaId} no tiene sqlGenerado · no se puede aprobar`);
    process.exit(1);
  }
  const result = await prisma.bICacheSemantico.upsert({
    where: { preguntaNL: consulta.preguntaNL },
    create: {
      preguntaNL: consulta.preguntaNL,
      sqlAprobado: consulta.sqlGenerado,
      aprobadoPor: "CLI",
      consultaLogId: consulta.id,
    },
    update: {
      sqlAprobado: consulta.sqlGenerado,
      aprobadoPor: "CLI",
    },
  });
  console.log(`OK: consulta ${consultaId.slice(0, 8)} aprobada en cache ${result.id}`);
  return result;
}

export async function listMetricas(prisma) {
  const metricas = await prisma.bICatalogoMetrica.findMany({
    where: { activa: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  console.table(
    metricas.map((m) => ({
      nombre: m.nombre,
      legible: m.nombreLegible,
      categoria: m.categoria,
    }))
  );
  return metricas;
}

export const COMMANDS = {
  "list-tablas": (prisma) => listTablas(prisma),
  "add-tabla": (prisma, args) => addTabla(prisma, args),
  "add-ejemplo": (prisma, args) => addEjemplo(prisma, args),
  "list-consultas": (prisma, args) => listConsultas(prisma, args),
  "aprobar-cache": (prisma, args) => aprobarCache(prisma, args),
  "list-metricas": (prisma) => listMetricas(prisma),
};

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (!cmd || !COMMANDS[cmd]) {
    console.error(`Comandos disponibles: ${Object.keys(COMMANDS).join(" | ")}`);
    process.exit(1);
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
  });
  try {
    await COMMANDS[cmd](prisma, args);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo ejecutar main() cuando se corre como script (no cuando se importa desde tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
