# RESEARCH-007 · Schema Prisma BI

## D-21 · Schema `public` con prefijo `bi_` (no schema separado)

**Alternativas evaluadas:**

| Opción | Pro | Contra | Decisión |
|---|---|---|---|
| Schema PostgreSQL `bi_catalogo` separado + Prisma `multiSchema` | Aislamiento máximo | Preview feature inestable en Prisma 6 · requiere `"previewFeatures": ["multiSchema"]` · riesgo de bugs en migration engine | ❌ Descartada |
| Schema `public` con prefijo `bi_` en tabla vía `@@map` | Stable · zero riesgo Prisma | Naming convention manual · requiere disciplina en @@map | ✅ **Adoptada** |

---

## Schema PI verificado (candado 15 · 2026-08-28)

Campos verificados contra `schema.prisma` del repo PI (rama main):

| Modelo PI | Campo | Tipo Prisma | Nota |
|---|---|---|---|
| Reporte | creadoEn | DateTime | @default(now()) |
| Reporte | prioridadAlta | Boolean | @default(false) |
| Reporte | esRafaga | Boolean | @default(false) |
| Reporte | esAnonimo | Boolean | @default(false) |
| Reporte | eliminado | Boolean | @default(false) |
| Reporte | pais | String | Non-null |
| Reporte | ciudad | String | Non-null |
| Reporte | estado | EstadoReporte | Enum |
| ClasificacionIA | latenciaMs | Int | |
| ClasificacionIA | confianza | Float | |
| ClasificacionIA | categoria | CategoriaConducta | Enum · nullable? |
| ClasificacionIA | modeloUsado | String | |
| BillingCycle | monto | Float | |
| BillingCycle | periodoInicio | DateTime | |
| BillingCycle | estado | String | |
| Plan | precio | Float | |
| Plan | nombre | String | |
| Subscription | tenantId | String | |
| Subscription | planId | String | |
| TransicionReporte | estadoAnterior | EstadoReporte | |
| TransicionReporte | estadoNuevo | EstadoReporte | |
| TransicionReporte | responsableTipo | ResponsableTransicion | Enum |
| TransicionReporte | creadoEn | DateTime | |
| ClasificacionRubricaVoto | → @@map("clasificacion_rubrica_votos") | | @@map corregido SPEC-002 |

---

## Modelos Prisma BI — esquema completo

### BICatalogoTabla

```prisma
model BICatalogoTabla {
  id              String   @id @default(cuid())
  nombreFuente    String   @unique
  nombreLegible   String
  descripcion     String   @default("")
  rolesPermitidos String[]
  activo          Boolean  @default(true)
  creadoEn        DateTime @default(now())
  actualizadoEn   DateTime @updatedAt

  columnas  BICatalogoColumna[]
  metricas  BICatalogoMetrica[]
  ejemplos  BICatalogoEjemplo[]

  @@map("bi_catalogo_tabla")
}
```

### BICatalogoColumna

```prisma
model BICatalogoColumna {
  id            String   @id @default(cuid())
  tablaId       String
  nombreFuente  String
  nombreLegible String
  descripcion   String   @default("")
  tipo          String
  sinonimos     String[] @default([])
  excluida      Boolean  @default(false)
  creadoEn      DateTime @default(now())

  tabla BICatalogoTabla @relation(fields: [tablaId], references: [id])

  @@unique([tablaId, nombreFuente])
  @@map("bi_catalogo_columna")
}
```

### BICatalogoMetrica

```prisma
model BICatalogoMetrica {
  id            String   @id @default(cuid())
  tablaId       String?
  nombre        String   @unique
  nombreLegible String
  descripcion   String   @default("")
  formulaSQL    String
  categoria     String   @default("general")
  activa        Boolean  @default(true)
  creadoEn      DateTime @default(now())

  tabla BICatalogoTabla? @relation(fields: [tablaId], references: [id])

  @@map("bi_catalogo_metrica")
}
```

### BICatalogoEjemplo

```prisma
model BICatalogoEjemplo {
  id               String   @id @default(cuid())
  tablaId          String?
  preguntaNL       String   @unique
  sql              String
  categoriaConsulta String  @default("general")
  verificado       Boolean  @default(true)
  creadoEn         DateTime @default(now())

  tabla BICatalogoTabla? @relation(fields: [tablaId], references: [id])

  @@map("bi_catalogo_ejemplo")
}
```

### BIConsultaLog

```prisma
model BIConsultaLog {
  id            String   @id @default(cuid())
  usuarioId     String
  preguntaNL    String
  sqlGenerado   String?
  estado        String   @default("pendiente")
  latenciaMs    Int?
  fuenteCache   Boolean  @default(false)
  error         String?
  creadoEn      DateTime @default(now())

  cacheEntrada BICacheSemantico?

  @@map("bi_consulta_log")
}
```

### BICacheSemantico

```prisma
model BICacheSemantico {
  id                String    @id @default(cuid())
  preguntaNL        String    @unique
  sqlAprobado       String
  aprobadoPor       String    @default("human")
  consultaLogId     String?   @unique
  embeddingPregunta Unsupported("vector(768)")?
  creadoEn          DateTime  @default(now())
  actualizadoEn     DateTime  @updatedAt

  consultaLog BIConsultaLog? @relation(fields: [consultaLogId], references: [id])

  @@map("bi_cache_semantico")
}
```

---

## Candado 19 · bi_admin sin stdout de password

El script de creación de `bi_admin` en BD usa placeholder `<password_bi_admin>`. Jelkin sustituye el placeholder con el password del gestor de contraseñas **localmente** antes de correr en psql. El script nunca sale al chat ni al log de SSH.

---

## Candado 22 · pgvector disponible en pgvector/pgvector:pg16

La imagen `pgvector/pgvector:pg16` incluye la extensión `vector` pre-compilada. `CREATE EXTENSION IF NOT EXISTS vector;` al inicio de la migración es idempotente y suficiente. No se requiere instalar nada adicional.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
