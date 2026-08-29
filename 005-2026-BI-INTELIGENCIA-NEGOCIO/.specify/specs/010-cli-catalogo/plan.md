# PLAN-010 · CLI catálogo BI

## Pre-requisito

SPEC-007 CUMPLE · SPEC-008 CUMPLE (datos sembrados).

## Pasos de implementación

### Paso 1 · Crear `scripts/catalogo-cli.mjs`

Estructura base (ESM, Node.js 22):

```javascript
#!/usr/bin/env node
// catalogo-cli.mjs · CLI de gestión del catálogo BI
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer BI_ADMIN_DATABASE_URL desde variable de entorno o .env.bi.production
function getDatabaseUrl() {
  if (process.env.BI_ADMIN_DATABASE_URL) return process.env.BI_ADMIN_DATABASE_URL;
  try {
    const envPath = resolve(__dirname, "../.env.bi.production");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^BI_ADMIN_DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  throw new Error("BI_ADMIN_DATABASE_URL no encontrada. Exportar la variable o crear .env.bi.production");
}

const prisma = new PrismaClient({ datasources: { db: { url: getDatabaseUrl() } } });
```

### Paso 2 · Implementar los 6 comandos

```javascript
const [, , cmd, ...args] = process.argv;

async function run() {
  switch (cmd) {
    case "list-tablas":   return listTablas();
    case "add-tabla":     return addTabla(args);
    case "add-ejemplo":   return addEjemplo(args);
    case "list-consultas": return listConsultas(args);
    case "aprobar-cache": return aprobarCache(args);
    case "list-metricas": return listMetricas();
    default:
      console.error(`Comando desconocido: ${cmd}`);
      console.error("Comandos: list-tablas | add-tabla | add-ejemplo | list-consultas | aprobar-cache | list-metricas");
      process.exit(1);
  }
}

async function listTablas() {
  const tablas = await prisma.bICatalogoTabla.findMany({ where: { activo: true }, orderBy: { nombreFuente: "asc" } });
  console.table(tablas.map(t => ({ nombreFuente: t.nombreFuente, legible: t.nombreLegible, roles: t.rolesPermitidos.join(",") })));
}

async function addTabla(args) {
  // parse: <nombre> --legible "X" --descripcion "Y" --roles ADMIN,SCHOOL_ADMIN
  const nombre = args[0];
  const legible = getFlag(args, "--legible");
  const descripcion = getFlag(args, "--descripcion");
  const roles = (getFlag(args, "--roles") ?? "").split(",").filter(Boolean);
  if (!nombre || !legible) { console.error("Uso: add-tabla <nombre> --legible <X>"); process.exit(1); }
  const result = await prisma.bICatalogoTabla.upsert({
    where: { nombreFuente: nombre },
    create: { nombreFuente: nombre, nombreLegible: legible, descripcion: descripcion ?? "", rolesPermitidos: roles },
    update: { nombreLegible: legible, descripcion: descripcion ?? "", rolesPermitidos: roles },
  });
  console.log(`OK: tabla ${result.id} (${result.nombreFuente})`);
}

async function addEjemplo(args) {
  const pregunta = getFlag(args, "--pregunta");
  const sql = getFlag(args, "--sql");
  const categoria = getFlag(args, "--categoria") ?? "general";
  if (!pregunta || !sql) { console.error("Uso: add-ejemplo --pregunta <X> --sql <Y>"); process.exit(1); }
  const result = await prisma.bICatalogoEjemplo.upsert({
    where: { preguntaNL: pregunta },
    create: { preguntaNL: pregunta, sql, categoriaConsulta: categoria },
    update: { sql, categoriaConsulta: categoria },
  });
  console.log(`OK: ejemplo ${result.id}`);
}

async function listConsultas(args) {
  const usuario = getFlag(args, "--usuario");
  const dias = parseInt(getFlag(args, "--dias") ?? "7", 10);
  const desde = new Date(Date.now() - dias * 86400_000);
  const consultas = await prisma.bIConsultaLog.findMany({
    where: { ...(usuario && { usuarioId: usuario }), creadoEn: { gte: desde } },
    orderBy: { creadoEn: "desc" },
    take: 50,
  });
  console.table(consultas.map(c => ({ id: c.id.slice(0, 8), usuario: c.usuarioId, pregunta: c.preguntaNL.slice(0, 60), estado: c.estado })));
}

async function aprobarCache(args) {
  const consultaId = args[0];
  if (!consultaId) { console.error("Uso: aprobar-cache <consulta_id>"); process.exit(1); }
  const consulta = await prisma.bIConsultaLog.findUniqueOrThrow({ where: { id: consultaId } });
  await prisma.bICacheSemantico.upsert({
    where: { preguntaNL: consulta.preguntaNL },
    create: { preguntaNL: consulta.preguntaNL, sqlAprobado: consulta.sqlGenerado ?? "", aprobadoPor: "CLI", consultaLogId: consulta.id },
    update: { sqlAprobado: consulta.sqlGenerado ?? "", aprobadoPor: "CLI" },
  });
  console.log(`OK: consulta ${consultaId.slice(0, 8)} movida a cache semántico`);
}

async function listMetricas() {
  const metricas = await prisma.bICatalogoMetrica.findMany({ orderBy: { categoria: "asc" } });
  console.table(metricas.map(m => ({ nombre: m.nombre, legible: m.nombreLegible, categoria: m.categoria })));
}

function getFlag(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

run().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
```

### Paso 3 · Dar permisos de ejecución

```bash
chmod +x scripts/catalogo-cli.mjs
```

### Paso 4 · Tests unitarios en `tests/unit/catalogo-cli.test.ts`

Usar vitest (ya en devDependencies según package.json del repo). Mock de Prisma con `vi.mock("@prisma/client")`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    bICatalogoTabla: {
      findMany: vi.fn().mockResolvedValue([{ id: "1", nombreFuente: "Reporte", nombreLegible: "Reportes", rolesPermitidos: ["ADMIN"], activo: true }]),
      upsert: vi.fn().mockResolvedValue({ id: "1", nombreFuente: "Reporte" }),
    },
    bICatalogoEjemplo: { upsert: vi.fn().mockResolvedValue({ id: "2" }) },
    bIConsultaLog: {
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "abc", preguntaNL: "¿Cuántos reportes hoy?", sqlGenerado: "SELECT count(*) FROM Reporte" }),
    },
    bICacheSemantico: { upsert: vi.fn().mockResolvedValue({ id: "3" }) },
    $disconnect: vi.fn(),
  })),
}));

describe("catalogo-cli", () => {
  it("list-tablas retorna array con nombreFuente", async () => {
    // import module · llamar función · verificar output
  });
  it("add-tabla hace upsert con los campos correctos", async () => { ... });
  it("list-consultas filtra por usuario y dias", async () => { ... });
  it("aprobar-cache mueve a bi_cache_semantico", async () => { ... });
});
```

### Paso 5 · Crear `scripts/README.md`

Documentación de todos los comandos con ejemplos de uso para Fábrica BI-2.

---

## Árbol de archivos resultante

```
scripts/
├── catalogo-cli.mjs           (NUEVO · 6 comandos CLI)
└── README.md                  (NUEVO · documentación)
tests/unit/
└── catalogo-cli.test.ts       (NUEVO · 4 tests)
```

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
