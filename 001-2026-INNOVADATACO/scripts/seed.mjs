#!/usr/bin/env node
/**
 * Seed de catálogos base (spec 004, I-006).
 *
 * Deja la base utilizable tras un arranque limpio: sin estos datos, licitaciones no
 * tiene entidades ni estados y configuración no tiene modelos.
 *
 * IDEMPOTENTE Y NO DESTRUCTIVO (FR-008/FR-009): se ejecuta las veces que haga falta
 * sin duplicar ni pisar la configuración del usuario. En particular NO usa
 * `deleteMany()` — el `scripts/seedApis.mjs` anterior sí lo hacía, y eso borraba en
 * cada ejecución los ajustes hechos desde la interfaz (una API desactivada, por
 * ejemplo).
 *
 * Uso: npm run seed
 */

import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../.env.local") });
loadEnv({ path: join(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * Estados de licitación: son EXACTAMENTE las claves que la interfaz ya reconoce y
 * colorea (`LicitacionesTab.tsx` y `LicitacionCard.tsx`). Sembrar otras dejaría
 * estados sin color; sembrar menos dejaría código muerto.
 */
const ESTADOS = [
  { key: "en-proceso", nombreOficial: "En proceso" },
  { key: "abierta", nombreOficial: "Abierta" },
  { key: "cerrada", nombreOficial: "Cerrada" },
  { key: "adjudicada", nombreOficial: "Adjudicada" },
  { key: "cancelada", nombreOficial: "Cancelada" },
];

// Tipos de oportunidad (spec 006, FR-005). Catálogo configurable: el CEO puede
// añadir más desde el módulo. Las banderas exige* fijan la obligatoriedad de
// numero/fechaApertura por tipo (§0.7), sin nombres cableados en el código.
const TIPOS_OPORTUNIDAD = [
  { key: "licitacion-publica", nombreOficial: "Licitación pública", exigeNumero: true, exigeFechaApertura: true },
  { key: "concurso-meritos", nombreOficial: "Concurso de méritos", exigeNumero: false, exigeFechaApertura: false },
  { key: "contratacion-directa", nombreOficial: "Contratación directa", exigeNumero: false, exigeFechaApertura: false },
];

/** Modelo de referencia. Se siembra INACTIVO: activarlo es decisión del operador. */
const MODELO_REFERENCIA = {
  name: "Nomic Embed Text (local)",
  provider: "ollama",
  scope: "local",
  modelPath: "nomic-embed-text",
  // Vacío a propósito: así aplica la precedencia del backend (FR-010 de la spec 001).
  baseUrl: null,
  active: false,
  config: JSON.stringify({ temperature: 0.2, top_p: 0.9, max_tokens: 1024 }, null, 2),
};

/** Convierte "Ministerio de Hacienda y Crédito Público" -> "ministerio-de-hacienda-y-credito-publico". */
function aSlug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const resumen = { creados: 0, omitidos: 0 };

function registrar(catalogo, clave, creado) {
  resumen[creado ? "creados" : "omitidos"] += 1;
  console.log(`   ${creado ? "+" : "="} ${catalogo}: ${clave}${creado ? "" : " (ya existía)"}`);
}

/** Upsert que no pisa lo existente: si el registro está, se deja intacto. */
async function sembrarPorClave(modelo, catalogo, registros) {
  console.log(`\n${catalogo}`);
  for (const registro of registros) {
    const existente = await modelo.findUnique({ where: { key: registro.key } });
    if (existente) {
      registrar(catalogo, registro.key, false);
      continue;
    }
    await modelo.create({ data: registro });
    registrar(catalogo, registro.key, true);
  }
}

async function sembrarEstados() {
  await sembrarPorClave(prisma.licitacionStatus, "LicitacionStatus", ESTADOS);
}

async function sembrarTiposOportunidad() {
  await sembrarPorClave(prisma.tipoOportunidad, "TipoOportunidad", TIPOS_OPORTUNIDAD);
}

async function sembrarEntidades() {
  const { ENTIDADES_COLOMBIA } = await import("../src/lib/entidadesColombia.ts");
  const entidades = ENTIDADES_COLOMBIA.map((nombreOficial) => ({
    key: aSlug(nombreOficial),
    nombreOficial,
  }));
  await sembrarPorClave(prisma.entidadLicitacion, "EntidadLicitacion", entidades);
}

async function sembrarApis() {
  const { APIS } = await import("./catalogoApis.mjs");
  console.log("\nAgentApi");
  for (const api of APIS) {
    const existente = await prisma.agentApi.findUnique({ where: { key: api.key } });
    if (existente) {
      registrar("AgentApi", api.key, false);
      continue;
    }
    await prisma.agentApi.create({ data: api });
    registrar("AgentApi", api.key, true);
  }
}

async function sembrarModelo() {
  console.log("\nAiModel");
  // AiModel no tiene clave natural única a propósito (research D-03): es configuración
  // de usuario, y dos entradas del mismo modelo con parámetros distintos son legítimas.
  const existente = await prisma.aiModel.findFirst({
    where: { provider: MODELO_REFERENCIA.provider, modelPath: MODELO_REFERENCIA.modelPath },
  });
  if (existente) {
    registrar("AiModel", MODELO_REFERENCIA.modelPath, false);
    return;
  }
  await prisma.aiModel.create({ data: MODELO_REFERENCIA });
  registrar("AiModel", MODELO_REFERENCIA.modelPath, true);
}

async function verificarMigraciones() {
  try {
    await prisma.licitacionStatus.count();
    await prisma.tipoOportunidad.count();
    await prisma.entidadLicitacion.count();
    await prisma.agentApi.count();
    await prisma.aiModel.count();
  } catch (err) {
    throw new Error(
      "La base no está migrada (o no es accesible). Ejecuta primero: npx prisma migrate deploy\n" +
        `Detalle: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function main() {
  console.log("Seed de catálogos base (idempotente, no destructivo)");
  await verificarMigraciones();

  await sembrarEstados();
  await sembrarTiposOportunidad();
  await sembrarEntidades();
  await sembrarApis();
  await sembrarModelo();

  console.log(
    `\nResumen: ${resumen.creados} creados · ${resumen.omitidos} omitidos por ya existir.`,
  );
  if (resumen.creados === 0) console.log("La base ya estaba sembrada: nada que hacer.");
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
