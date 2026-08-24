# Research: SPEC-227 — Historial de recomendaciones y métricas de tuning

## 1. Contexto del problema

El motor de reglas (SPEC-221) genera `Recomendacion` continuamente, pero sin una vista de historial el ADMIN no puede auditar qué sugirió el sistema ni calibrar las reglas. El brief §10.4 lo define: historial filtrable + métricas de tuning (tasa de aplicación, tasa de ignorada, tiempo promedio de resolución). El instructivo 002-PI-128 añade filtros por cliente y export CSV opcional sin PII.

## 2. Hallazgos contra el código real

### 2.1 Los modelos de dominio aún NO existen en el schema

- `prisma/schema.prisma` no contiene `ReglaRecomendacion` ni `Recomendacion` (búsqueda de `model (Recomendacion|ReglaRecomendacion|...)` solo encuentra `ParametroSistema:592`, `AuditLog:613`, `SesionLog:640`, `Plan:677`, `Suscripcion:723`).
- **Conclusión**: SPEC-227 documenta solo lectura sobre los modelos que SPEC-221 creará en la misma rama (definidos en brief §5.3/§5.4 con índices `[activa, prioridad]` y `[estado, prioridad, generadaEn]`, `[sujetoId]`). Esta spec no propone migraciones.
- `SesionLog` (`prisma/schema.prisma:640-662`) confirma el patrón del módulo análisis: `@db.Timestamptz(6)`, `@@map` snake_case, índices descendentes por fecha.

### 2.2 Patrón de rutas admin de lectura + export

- `src/app/api/admin/ia/simulaciones/[id]/export/route.ts:33-55`: `verifyAuth(RolUsuario.ADMIN)` → `assertModulo(user, "ia_simulaciones")` → Zod → `checkRateLimit(request, "admin_read", { identifier: user.id })` → delega al DAL (`IaSimulacionesService.prepararExport`, `src/lib/dal/services/ia-simulaciones.ts`).
- El mismo archivo (`:15-31`) tiene el helper `toCsv` con escape de comillas/comas/saltos: se replica el patrón en el DAL de esta spec.
- `export const dynamic = "force-dynamic"` en rutas admin (`:10-11`): se mantiene.

### 2.3 Control de acceso por módulos

- `src/lib/permisos-modulos.ts:61` `assertModulo(user, clave)` lanza si el rol no tiene el módulo; `:34` `modulosPermitidosParaRol` alimenta la navegación.
- Catálogo sembrado en `prisma/seed-modulos-grants.ts` (upsert por `clave`, backfill de grants; invocado desde `prisma/seed.ts:2196` vía `syncModulosYGrants`). Claves existentes en uso: `estadisticas`, `ia_simulaciones`, `operadores`, `anti_abuso`, etc.
- Layout admin (`src/app/dashboard/admin/layout.tsx:9-24`) permite `ADMIN`/`OPERADOR`/`COMITE_VALIDACION` al panel y filtra nav por módulos (`:36-40`); por eso la protección fina es el módulo `analisis_recomendaciones` otorgado solo a `ADMIN`, no el rol del layout.
- `AdminNav.tsx:14` mapea rutas a iconos; se añade la entrada de análisis siguiendo ese patrón.

### 2.4 Errores, paginación y parámetros

- `AppError` + `ERROR_CODES` en `src/lib/errors.ts` (usado en `export/route.ts:40-41` con 400); códigos canónicos 400/401/403/404/409/413/429/500 según constitución §3.4. El tope de export usa `413`.
- Paginación estándar constitución §4.3 (`page`/`pageSize`, default 25, máx 100, `{ items, pagination }`).
- `ParametroSistema` (`prisma/schema.prisma:592-611`): `clave` única, `valor` string, `tipo`/`categoria`; seed idempotente por upsert (patrón ya usado para `padre.expediente.*` en SPEC-236).

### 2.5 Zona horaria

- Decisión D-69 (brief §2): cortes en día calendario Bogotá. El repo ya usa `date-fns-tz` (patrón documentado en SPEC-236, worker con `TZ=America/Bogota`). Se reutiliza para convertir `desde`/`hasta` a UTC.

## 3. Opciones consideradas

### 3.1 Métricas: agregación SQL vs. cómputo en memoria

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Traer filas y calcular en JS | Simple | No escala; rompe con 10k+ filas | No |
| `groupBy` + `$queryRaw` para promedio de intervalos | Escala, una sola pasada | Raw SQL acotado | Sí |
| Vista materializada | Rápida | Complejidad innecesaria para el volumen | No |

### 3.2 Pseudonimización del sujeto en CSV

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Omitir sujeto | Máxima privacidad | El ADMIN no puede correlacionar filas del mismo cliente | No |
| Hash con sal (SHA-256 truncado) | Correlacionable entre exports, irreversible | Requiere sal de entorno | Sí |
| Cifrado reversible AES-GCM | Recuperable | Export se vuelve dato sensible | No |

### 3.3 ¿Exportar título/descripción?

- La plantilla de la regla puede renderizar datos del cliente (`"Llama a {{colegio}}"`). Exportar el título violaría el candado "Sin PII cliente en export CSV". **Decisión**: CSV solo con metadatos; la tabla in-app sí muestra el título (contexto ADMIN autenticado, igual que otras vistas admin).

### 3.4 Ruta de la vista

- El brief §10.4 dice `/admin/analisis/recomendaciones`; el instructivo 002-PI-128 fija `/dashboard/admin/analisis/recomendaciones`. **Decisión**: instructivo (fuente primaria de alcance). El brief §2 sugiere tabs dentro de estadísticas para el panel principal (SPEC-222), pero esta vista es una página propia, consistente con el mapa de cola §15.

## 4. Referencias

- Instructivo: `INSTRUCTIVO-002-PI-128-HISTORIAL-RECOMENDACIONES.md` (alcance, candados, gate local I-101).
- Brief: `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §3 (terminología), §4 (visual), §5.3/§5.4 (modelos), §10.4 (historial), §14 (cumplimiento), §15 (mapa de SPECs: SPEC-227 depende de SPEC-221).
- Código: `src/app/api/admin/ia/simulaciones/[id]/export/route.ts`, `src/lib/permisos-modulos.ts`, `src/app/dashboard/admin/layout.tsx`, `prisma/schema.prisma:592-662`, `prisma/seed-modulos-grants.ts`.
- Constitución: `.specify/memory/constitution.md` §3.4 (errores), §4.3 (paginación), §6 (seguridad), §1.6 (Ley 1581).

## 5. Preguntas abiertas (para compuerta de ZEUS)

1. **Módulo padre en el catálogo**: si SPEC-222 registra un módulo `analisis` padre, `analisis_recomendaciones` cuelga de él; si no, queda de primer nivel. Se resuelve al implementar según el estado real del catálogo en la rama.
2. **Título en tabla**: si ZEUS considera que hasta la tabla debe ocultar el título renderizado (puede contener nombre del colegio), se cambia la columna por `regla.nombre` + categoría sin tocar el contrato del CSV.
