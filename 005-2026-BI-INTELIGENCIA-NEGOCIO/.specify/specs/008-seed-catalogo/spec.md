# SPEC-008 · Seed idempotente catálogo BI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 008 |
| **Nombre** | seed-catalogo |
| **Origen** | BI · INSTRUCTIVO-006 · F3C 2026-08-28 COT |
| **Brief** | BI · A-04 §3.2 |
| **Estado** | ⏳ spec+plan listo · implementación pendiente (REVISO) |
| **Depende de** | SPEC-007 CUMPLE (schema Prisma existe) |

---

## Objetivo

Crear `prisma/seed-catalogo.ts` que pueble el catálogo BI con datos curados y verificados contra el schema PI (candado 15). El seed es idempotente: `upsert({..., update: {}})` — se puede correr N veces sin cambios en la 2ª pasada.

---

## Alcance

### Datos a sembrar

| Tabla | Registros mínimos | Fuente |
|---|---|---|
| `bi_catalogo_tabla` | 15 tablas OPERATIVAS (D-20) | Schema PI verificado |
| `bi_catalogo_columna` | ≥80 columnas relevantes | Campos clave de cada tabla PI |
| `bi_catalogo_metrica` | 15 métricas de negocio | BRIEF-A-04 §3.2 |
| `bi_catalogo_ejemplo` | 30 ejemplos NL→SQL | BRIEF-A-04 §3.2 |

### 15 tablas a sembrar (D-20 · verificadas candado 15 2026-08-28)

```
Reporte · ClasificacionIA · ClasificacionRubricaVoto · CorreccionAdmin ·
EmbeddingReporte · TransicionReporte · SolicitudComite · FuenteReporte ·
Subscription · BillingCycle · Plan · Tenant ·
Colegio · Curso · Alumno · IdentificadorAlumno ·
AlertaColegio · AlertaSuscripcion · Plataforma ·
Pais · Departamento · Ciudad · AuditLog
```

> Nota: son 23 tablas en la PUBLICATION (D-20) pero el seed cubre las 15 más relevantes para consultas BI.

### Patrón de seed (candado seed)

```typescript
await prisma.bICatalogoTabla.upsert({
  where: { nombreFuente: "Reporte" },
  create: {
    nombreFuente: "Reporte",
    nombreLegible: "Reportes de riesgo",
    descripcion: "...",
    rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"],
  },
  update: {},  // NO sobreescribe valores customizados por operador
});
```

### Test de idempotencia (obligatorio)

```typescript
// correr seed 2 veces · contar filas antes y después · aserta cero cambios
const antes = await prisma.bICatalogoTabla.count();
await runSeed();
const despues = await prisma.bICatalogoTabla.count();
assert(antes === despues);
```

### Comando de ejecución

```bash
npx prisma db seed
```

Requiere en `package.json`:
```json
"prisma": { "seed": "tsx prisma/seed-catalogo.ts" }
```

---

## Fuera de alcance

- Schema Prisma (SPEC-007)
- Vistas materializadas (SPEC-009)
- CLI (SPEC-010)

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 8 · Catálogo como DATO en BD | Este seed es la primera población del catálogo |
| 15 · Verificar en fuente | Nombres de tablas y columnas PI verificados con grep + lectura schema |
| Seed idempotente `update:{}` | AGENTS.md regla dura |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan · REVISO pendiente |
