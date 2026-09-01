#!/usr/bin/env node
// ==========================================================================
// verificar-indices-post-migrate.mjs · Producto 006 · BI v2 · Ratchet A-45
//
// Compara pg_indexes REAL contra la lista canónica de índices esperados y
// FALLA (exit 1) si desaparece un índice crítico o cambia de tipo. El
// guardián SOLO observa y reporta — nunca crea, repara ni borra índices.
// Reparar es decisión humana.
//
// Alcance (BD única de bi-db):
//   * Tablas propias del 006: bi_catalogo_* · bi_consulta_log ·
//     bi_cache_semantico (incluye el índice HNSW del embedding vector(768)).
//   * MVs mv_fact_*: se verifican SOLO si existen. Si aún no existen (réplica
//     no activada — las crea scripts/replica-setup/05-mv-fact.sql a mano),
//     degrada con AVISO claro SIN fallar. Si una MV existe pero le falta su
//     índice único → FALLA (estado parcial = algo anda mal).
//   * Las tablas replicadas de PI quedan FUERA del chequeo de huérfanos (sus
//     índices los gobierna PI, no este ratchet).
//
// Uso:
//   DATABASE_URL=... node scripts/verificar-indices-post-migrate.mjs
//   node --env-file=.env scripts/verificar-indices-post-migrate.mjs   (local)
//   ... --json   → salida JSON para consumo por máquina
//
// Requiere: `npx prisma generate` ejecutado antes (cliente @prisma/client).
//
// Exit codes:
//   0 — índices canónicos presentes y de tipo correcto (puede haber avisos)
//   1 — falta un índice crítico o el tipo no coincide
//   2 — error de infraestructura (sin DATABASE_URL · BD inalcanzable · timeout)
//
// DISCIPLINA (A-45): agregar un índice por SQL crudo en una migración OBLIGA
// a declararlo en REQUIRED en el MISMO PR. Cambiar el nombre de un índice
// canónico exige actualizar este archivo en el mismo PR.
// ==========================================================================

// ──────────────────────────────────────────────────────────────────────────
// Lista canónica de índices esperados (fuente única de verdad del ratchet).
// Tipos: 'btree' | 'hnsw' | 'unique'
//   - 'hnsw' : se verifica "using hnsw" en indexdef (pgvector)
//   - 'btree': método por defecto (explícito o implícito en indexdef)
//   - 'unique': PostgreSQL emite "CREATE UNIQUE INDEX ..." para unique
// ──────────────────────────────────────────────────────────────────────────
const REQUIRED = [
  {
    name: "bi_catalogo_tabla_nombreFuente_key",
    table: "bi_catalogo_tabla",
    type: "unique",
    sostiene: "unicidad del nombre fuente en el catálogo (candado 8)",
  },
  {
    name: "bi_catalogo_columna_tablaId_nombreFuente_key",
    table: "bi_catalogo_columna",
    type: "unique",
    sostiene: "una columna fuente por tabla del catálogo",
  },
  {
    name: "bi_catalogo_metrica_nombre_key",
    table: "bi_catalogo_metrica",
    type: "unique",
    sostiene: "unicidad de métricas de negocio del catálogo",
  },
  {
    name: "bi_catalogo_ejemplo_preguntaNL_key",
    table: "bi_catalogo_ejemplo",
    type: "unique",
    sostiene: "unicidad de ejemplos NL→SQL curados",
  },
  {
    name: "bi_consulta_log_usuarioId_creadoEn_idx",
    table: "bi_consulta_log",
    type: "btree",
    sostiene: "traza por consulta ordenada por usuario/fecha (candado 12) — sin él, barrido en el panel de consultas",
  },
  {
    name: "bi_cache_semantico_preguntaNL_key",
    table: "bi_cache_semantico",
    type: "unique",
    sostiene: "unicidad de veredictos humanos en el cache semántico (candado 7)",
  },
  {
    name: "bi_cache_semantico_consultaLogId_key",
    table: "bi_cache_semantico",
    type: "unique",
    sostiene: "relación 1:1 cache↔traza de consulta",
  },
  {
    // Índice vectorial del cache semántico (embedding vector(768)).
    // Se crea por SQL crudo en la migración inicial del catálogo (igual que
    // los HNSW de PI): si su nombre real difiere, el ratchet ACEPTA cualquier
    // índice hnsw sobre la tabla pero AVISA del drift de nombre — y la
    // disciplina A-45 manda alinear el nombre o esta lista en el mismo PR.
    name: "bi_cache_semantico_embeddingPregunta_idx",
    table: "bi_cache_semantico",
    type: "hnsw",
    sostiene: "búsqueda por similitud del cache semántico (candado 7) — sin él, escaneo secuencial de embeddings",
    aceptaCualquierHnswEnTabla: true,
  },
];

// MVs mv_fact_* · NO van en migración Prisma (T4): las crea a mano
// scripts/replica-setup/05-mv-fact.sql cuando la réplica está activa.
// Si la MV no existe → aviso y se omite (degradación sin fallo).
// Si la MV existe → su índice único es OBLIGATORIO (habilita REFRESH
// CONCURRENTLY · D-26).
const MVS_ESPERADAS = [
  { mv: "mv_fact_reporte_diario", indice: "idx_mv_fact_reporte_diario_uniq" },
  { mv: "mv_fact_motor_ia_diario", indice: "idx_mv_fact_motor_ia_diario_uniq" },
  { mv: "mv_fact_operativo", indice: "idx_mv_fact_operativo_uniq" },
  { mv: "mv_fact_comercial_mensual", indice: "idx_mv_fact_comercial_mensual_uniq" },
  { mv: "mv_fact_salud_sistema", indice: "idx_mv_fact_salud_sistema_uniq" },
];

// ──────────────────────────────────────────────────────────────────────────
// Verificación principal
// ──────────────────────────────────────────────────────────────────────────
function tipoCorrecto(req, indexdef) {
  const def = indexdef.toLowerCase();
  if (req.type === "hnsw") {
    return { ok: def.includes("using hnsw"), found: def.match(/using (\w+)/)?.[1] ?? "desconocido" };
  }
  if (req.type === "btree") {
    const ok = def.includes("using btree") || !def.includes("using ");
    return { ok, found: def.match(/using (\w+)/)?.[1] ?? "btree (implícito)" };
  }
  // unique
  const ok = def.startsWith("create unique index");
  return { ok, found: ok ? "unique" : "no-unique" };
}

async function verificar(prisma) {
  const inicio = Date.now();
  const warnings = [];
  const missing = [];
  const wrongType = [];

  // Índices reales del schema public (incluye índices de MVs; pg_indexes las
  // reporta con tablename = nombre de la MV).
  const rows = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  const byName = new Map(rows.map((r) => [r.indexname, r]));
  // Índices aceptados vía fallback anti-drift: no deben salir como huérfanos.
  const driftAceptados = new Set();

  // ── 1. Índices canónicos de tablas propias ──────────────────────────────
  for (const req of REQUIRED) {
    let row = byName.get(req.name);

    if (!row && req.aceptaCualquierHnswEnTabla) {
      // Fallback anti-drift: aceptar cualquier HNSW real sobre la tabla,
      // avisando que el nombre no es el canónico.
      const candidato = rows.find(
        (r) => r.tablename === req.table && r.indexdef.toLowerCase().includes("using hnsw")
      );
      if (candidato) {
        warnings.push(
          `DRIFT DE NOMBRE: el índice HNSW de ${req.table} se llama "${candidato.indexname}" y el canónico es "${req.name}" — alinear nombre o lista REQUIRED en el mismo PR (A-45)`
        );
        driftAceptados.add(candidato.indexname);
        row = candidato;
      }
    }

    if (!row) {
      missing.push(req);
      continue;
    }
    const { ok, found } = tipoCorrecto(req, row.indexdef);
    if (!ok) {
      wrongType.push({ req, found });
    }
  }

  // ── 2. MVs mv_fact_* · degradación con aviso si la réplica no está activa ─
  const mvs = await prisma.$queryRaw`
    SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'
  `;
  const mvsPresentes = new Set(mvs.map((m) => m.matviewname));

  let mvsOmitidas = 0;
  for (const { mv, indice } of MVS_ESPERADAS) {
    if (!mvsPresentes.has(mv)) {
      mvsOmitidas += 1;
      continue;
    }
    const row = byName.get(indice);
    if (!row) {
      missing.push({
        name: indice,
        table: mv,
        type: "unique",
        sostiene: "REFRESH CONCURRENTLY de la MV (D-26) — sin índice único no es posible",
      });
      continue;
    }
    const { ok, found } = tipoCorrecto({ type: "unique" }, row.indexdef);
    if (!ok) {
      wrongType.push({
        req: { name: indice, table: mv, type: "unique", sostiene: "REFRESH CONCURRENTLY de la MV (D-26)" },
        found,
      });
    }
  }
  if (mvsOmitidas > 0) {
    warnings.push(
      `MVs no verificadas: ${mvsOmitidas}/5 mv_fact_* no existen aún — normal si la réplica no se activó (las crea scripts/replica-setup/05-mv-fact.sql · NUNCA la migración Prisma, T4). Este aviso NO falla el ratchet.`
    );
  }

  // ── 3. Huérfanos SOLO en superficie propia (bi_* · mv_fact_*) ────────────
  // Las tablas replicadas de PI tienen sus propios índices (los gobierna PI):
  // quedan fuera de este chequeo a propósito.
  const declarados = new Set([
    ...REQUIRED.map((r) => r.name),
    ...MVS_ESPERADAS.map((m) => m.indice),
  ]);
  const orphans = rows
    .filter(
      (r) =>
        (r.tablename.startsWith("bi_") || r.tablename.startsWith("mv_fact_")) &&
        !declarados.has(r.indexname) &&
        !driftAceptados.has(r.indexname) &&
        !r.indexname.endsWith("_pkey") &&
        !r.indexname.endsWith("_key") &&
        !r.indexname.endsWith("_fkey")
    )
    .map((r) => `${r.indexname} (tabla ${r.tablename})`);

  return {
    ok: missing.length === 0 && wrongType.length === 0,
    missing: missing.map((m) => m.name),
    wrongType: wrongType.map((w) => ({ name: w.req.name, expected: w.req.type, found: w.found })),
    warnings,
    orphans,
    mvsVerificadas: MVS_ESPERADAS.length - mvsOmitidas,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - inicio,
    _detalle: { missingFull: missing, wrongTypeFull: wrongType },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Salida humana
// ──────────────────────────────────────────────────────────────────────────
function imprimir(res) {
  for (const req of res._detalle.missingFull) {
    console.error(`[INDICES] FALTA: ${req.name} (tabla ${req.table}) — ${req.sostiene}`);
  }
  for (const { req, found } of res._detalle.wrongTypeFull) {
    console.error(
      `[INDICES] TIPO INCORRECTO: ${req.name} (tabla ${req.table}) — esperado=${req.type} encontrado=${found} — ${req.sostiene}`
    );
  }
  for (const w of res.warnings) {
    console.warn(`[INDICES] AVISO: ${w}`);
  }
  for (const o of res.orphans) {
    console.warn(`[INDICES] HUÉRFANO: ${o} — no está en la lista canónica; declararlo si es intencional (A-45)`);
  }
  if (res.ok) {
    console.log(
      `[INDICES] OK: ${REQUIRED.length} índices de tablas propias verificados · ${res.mvsVerificadas}/5 MVs verificadas · ${res.durationMs}ms`
    );
  } else {
    console.error(
      `[INDICES] FALLO: ${res.missing.length} índice(s) faltante(s) · ${res.wrongType.length} tipo(s) incorrecto(s). ` +
        `¿Corrió "prisma migrate deploy"? ¿Alguien borró un índice? Ratchet A-45: el pipeline NO pasa.`
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Entrypoint
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const jsonMode = process.argv.includes("--json");

  if (!process.env.DATABASE_URL) {
    console.error(
      "[INDICES] FALLO DE USO: falta DATABASE_URL en el entorno (postgresql://bi_admin:...@<host>:5432/<bd>). Sin BD no hay ratchet."
    );
    process.exit(2);
  }

  let PrismaClient;
  try {
    const pkg = await import("@prisma/client");
    PrismaClient = pkg.PrismaClient ?? pkg.default?.PrismaClient;
    if (!PrismaClient) throw new Error("PrismaClient no exportado");
  } catch (err) {
    console.error(
      `[INDICES] Error cargando @prisma/client: ${err.message ?? err}. ¿Ejecutaste "npx prisma generate" antes?`
    );
    process.exit(2);
  }

  // Watchdog: el guardián nunca cuelga CI ni deploy.
  const watchdog = setTimeout(() => {
    console.error("[INDICES] TIMEOUT: el chequeo tardó más de 10s — revisar conectividad a bi-db");
    process.exit(2);
  }, 10_000);
  watchdog.unref();

  const prisma = new PrismaClient();
  try {
    const res = await verificar(prisma);
    clearTimeout(watchdog);
    if (jsonMode) {
      const { _detalle, ...salida } = res;
      console.log(JSON.stringify(salida));
    } else {
      imprimir(res);
    }
    process.exitCode = res.ok ? 0 : 1;
  } catch (err) {
    clearTimeout(watchdog);
    if (jsonMode) {
      console.log(JSON.stringify({ ok: false, error: String(err.message ?? err) }));
    } else {
      console.error(`[INDICES] Error de infraestructura: ${err.message ?? err}`);
    }
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
