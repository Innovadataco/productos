# Implementation Plan: SPEC-173 — Módulo Colegio: restructura nav por rol + fixes H01-H06

**Branch**: `work/002-pi-071` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

---

## Summary

Dos bloques en una rama, push único al final del batch nocturno:

1. **Bloque A — Nav por rol**: rector con 8 items exactos (nodo "Usuarios" expandible nuevo), comité de convivencia con menú propio de 3 items (home nueva + estadísticas nuevas + casos existente). Admin del comité se mueve de `/comite` a `/comite/integrantes`. Proxy y `homeForRole` actualizados.
2. **Bloque B — Fixes H01-H06**: escalar individual con modal de motivo (el botón hoy hace POST sin body contra un schema que exige `motivo` → 400 siempre); batch sin escalada; `materiaId` acepta UUID+CUID; dropdown de plataformas robusto; `alertasPorTipoSujeto` en estadísticas; onboarding completado con resumen; barra de acciones del listado reducida a 3 individuales + 1 batch con chips con tooltip.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10, React 19, Prisma 5.22.0, Tailwind 3.4, Zod |
| **Storage** | PostgreSQL 16 (sin cambios de schema Prisma) |
| **Testing** | Vitest (projects unit/integration) + tests de API existentes |
| **Arquitectura** | Cambian rutas/nav/proxy → regenerar `docs/architecture/` y dejar `arch:check` verde |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.3 Presunción de inocencia | ✅ Pass | Lenguaje descriptivo; chips/tooltips sin veredictos |
| §1.6 Privacidad | ✅ Pass | Home/estadísticas del comité solo agregados; sin contenido de reporte ni denunciante (FR-019) |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; filtros Prisma tipados |
| §4.1 Tenant-first | ✅ Pass | Todo conteo filtra por `colegioId` |
| I-49 Migraciones aditivas | ✅ Pass | Cero migraciones; solo Zod + DTO + UI |
| AuditLog | ✅ Pass | Escalar/resolver ya auditan; se mantiene |

---

## Hallazgos de la exploración (fuente verificada)

1. **Nav actual**: `COLEGIO_NAV_ITEMS` (12 items) filtrado por `ColegioSideNav.tsx:17-19` con doble condición: módulo ∈ grants (BD) ∧ predicado proxy (`esDestinoPermitidoPorRol`, `proxy.ts:131`).
2. **No existe patrón expandible**: `AdminNav.tsx` es plano; el "Usuarios expandible" de SPEC-129 fue reemplazado. El nodo expandible de "Usuarios" se construye nuevo en `ColegioSideNav` (estado local + `aria-expanded`, patrón de `src/components/ui/Accordion.tsx`).
3. **Comité hoy**: solo ve "Casos del comité" (grant `colegios_comite_bandeja`, `seed-modulos-grants.ts:49`); `homeForRole` lo manda a `/comite/casos` (`proxy.ts:192-201`).
4. **H01 raíz**: botón "Escalar" individual hace `POST /escalar` **sin body** (`AlertasColegioPageClient.tsx:176-199`) pero `escalarAlertaSchema` exige `motivo` min 1 (`schemas/index.ts:410-412`) → 400 siempre. El batch (`POST /api/colegio/alertas`, `alertaBatchSchema` línea 358) acepta `escalada` y solo cambia estado sin crear `SolicitudComite` (`alertas.ts:431-481`) → comportamiento roto/500.
5. **H02 raíz**: `cursoMateriaBodySchema.materiaId` = `cuidIdSchema` (`schemas/index.ts:224`); la migración `20260812052407` sembró `Materia` con `gen_random_uuid()` y la app crea nuevas con `@default(cuid())` → ids mixtos en prod.
6. **H03 raíz probable**: el fetch a `/api/plataformas` SÍ existe e incondicional (`ProfesorDetallePageClient.tsx:57-60`) pero con `catch(() => {})` silencioso y shape `data.plataformas || []` — un fallo de red o shape distinta deja el select vacío sin rastro.
7. **H04**: `EstadisticasInteligenciaColegio` (`inteligencia.ts:48-63`) no tiene conteos por `tipoSujeto`; hay que añadir método al `AlertaColegioRepository` (groupBy) y exponerlo en el DTO/endpoint/vista.
8. **H05**: `onboarding/page.tsx` renderiza `<OnboardingModal forceOpen />`; con `estado === "completado"` solo lista pasos + "Reactivar onboarding" (`OnboardingModal.tsx:104-173`). La página necesita rama de resumen.
9. **H06**: acciones actuales por tarjeta (líneas 484-533): Ver seguimiento, Marcar vista, Marcar gestionada, Escalar, Asignar/Reasignar. Batch (líneas 341-370): Marcar vista, Marcar gestionada, Escalar, Cerrar, Asignar, Desasignar. No hay test del componente.
10. **Proxy comité**: `COMITE_CONVIVENCIA_ROUTES = ["/dashboard/colegio/comite", ...]` (línea 41) daría acceso al comité también a `/comite/integrantes` (admin del rector) → hay que excluir ese subárbol en el predicado del comité.
11. **Módulos**: no existen claves para home/estadísticas del comité → se reusa `colegios_comite_bandeja` para los 3 items del comité (igual que `COMITE_NAV_TABS` reusa claves). Rector: "Casos comité" usa `colegios_comite_bandeja`; "Usuarios > Comité de convivencia" usa `colegios_comite`.
12. **Iconos**: `ColegioSideNav` cae al icono default para rutas sin entrada en `ICONS` → añadir iconos para las rutas nuevas.
13. **arch:check**: aserción B evalúa cada href pintado contra el proxy por rol; tras cambiar nav/proxy/rutas hay que regenerar `docs/architecture/` (`npx tsx scripts/arch/generar-pantallas.ts` y generadores afectados).

---

## Project Structure

### Documentation (this feature)

```text
specs/173-restructura-nav-colegio/
├── spec.md
├── plan.md
├── data-model.md            # sin cambios Prisma; documenta DTOs
├── quickstart.md            # validación manual H01-H06 + nav
├── checklists/requirements.md
└── tasks.md                 # tras compuerta §4
```

### Source Code — Bloque A (nav)

```text
src/lib/nav-items.ts                          # MOD: COLEGIO_NAV_ITEMS 8 items + COMITE_COLEGIO_NAV_ITEMS (3)
src/components/modules/colegio/
    ColegioSideNav.tsx                        # MOD: nodo "Usuarios" expandible + iconos nuevos + rama por rol
src/lib/proxy.ts                              # MOD: homeForRole comité → /comite; exclusión /comite/integrantes para COMITE_CONVIVENCIA
src/app/dashboard/colegio/comite/
    page.tsx                                  # MOD: rector → redirect /comite/integrantes; comité → home nueva
    integrantes/page.tsx                      # NUEVO: mueve admin actual (ComiteCuentaCard + IntegrantesList)
    estadisticas/page.tsx                     # NUEVO: estadísticas del comité (agregadas)
src/components/modules/colegio/comite/
    ComiteHome.tsx                            # NUEVO: resumen casos abiertos, mis pendientes, SLA
    ComiteEstadisticas.tsx                    # NUEVO: casos por estado, TMR, categorías más escaladas
src/app/api/colegio/comite/estadisticas/route.ts   # NUEVO: agregados (sin PII, tenant-first)
```

### Source Code — Bloque B (fixes)

```text
src/lib/schemas/index.ts                      # MOD: alertaBatchSchema sin "escalada"; materiaId UUID|CUID
src/app/api/colegio/alertas/route.ts          # MOD: batch rechaza escalada (400) — vía schema
src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx
                                              # MOD: 3 acciones individuales + 1 batch; modales motivo/bitácora; tooltips chips
src/components/modules/colegio/alertas/
    EscalarAlertaModal.tsx                    # NUEVO: modal motivo obligatorio
    ResolverAlertaModal.tsx                   # NUEVO: modal bitácora → SeguimientoCaso (reusa SPEC-159)
src/app/api/colegio/alertas/[id]/resolver/route.ts  # NUEVO (o reusar endpoint de notas si ya cubre): gestionada + nota
src/lib/colegio/inteligencia.ts               # MOD: + alertasPorTipoSujeto en DTO
src/lib/dal/repositories/alerta-colegio.ts    # MOD: + contarPorTipoSujeto (groupBy)
src/app/dashboard/colegio/estadisticas/       # MOD: sección desglose tipoSujeto en la vista
src/app/dashboard/colegio/profesores/[id]/ProfesorDetallePageClient.tsx
                                              # MOD: fetch plataformas con manejo de error + shape verificada
src/app/dashboard/colegio/onboarding/page.tsx # MOD: rama completado → resumen + CTA
src/app/api/colegio/onboarding/route.ts       # MOD: payload + resumen de conteos cuando completado
```

### Tests

```text
src/lib/nav-items.test.ts                     # AUTO (estructural) + casos nuevos si aplica
src/lib/proxy.test.ts                         # MOD: + cobertura COMITE_CONVIVENCIA (home, integrantes 403, estadísticas)
src/app/api/colegio/alertas/route.test.ts     # MOD: batch escalada → 400
src/app/api/colegio/alertas/[id]/escalar/route.test.ts  # MOD: motivo obligatorio (ya existe base)
src/app/api/colegio/alertas/[id]/resolver/route.test.ts # NUEVO
src/app/api/colegio/comite/estadisticas/route.test.ts   # NUEVO: agregados + sin PII + tenant
src/app/api/colegio/estadisticas/route.test.ts          # MOD: incluye alertasPorTipoSujeto
src/app/api/colegio/cursos/[id]/materias/route.test.ts  # MOD: materiaId UUID y CUID → 201
src/app/dashboard/colegio/alertas/AlertasColegioPageClient.test.tsx # NUEVO (unit): botones exactos H06
src/components/modules/colegio/ColegioSideNav.test.tsx  # NUEVO (unit): 8 items rector / 3 comité
docs/architecture/                            # REGENERAR (pantallas, roles-capacidades) → arch:check verde
```

---

## Diseño por bloque

### Bloque A — Navegación por rol

**A1. `nav-items.ts`**. Reescribir `COLEGIO_NAV_ITEMS` a los 8 items del CEO. El nodo "Usuarios" se modela con un campo opcional `children?: NavItem[]` en la interfaz (sin romper el test estructural: los hijos también referencian claves del catálogo). Nuevo arreglo exportado `COMITE_COLEGIO_NAV_ITEMS` con los 3 items del comité (todos con `modulo: "colegios_comite_bandeja"`).

**A2. `ColegioSideNav.tsx`**. Si `rol === "COMITE_CONVIVENCIA"` renderiza `COMITE_COLEGIO_NAV_ITEMS`; si no, `COLEGIO_NAV_ITEMS`. El nodo "Usuarios" se renderiza como botón expandible (estado `useState`, `aria-expanded`/`aria-controls`, patrón Accordion) con sus 2 hijos indentados; auto-expandido cuando la ruta activa está bajo él. Añadir iconos a `ICONS` para: alertas, casos comité, usuarios, profesores, comité integrantes, configuración, auditoría, estadísticas, inicio (hoy varios caen al default).

**A3. `proxy.ts`**.
- `homeForRole`: COMITE_CONVIVENCIA → `/dashboard/colegio/comite`.
- Predicado comité: permitir `/dashboard/colegio/comite/**` EXCEPTO `/dashboard/colegio/comite/integrantes` (y su API de integrantes si aplica) → el admin del comité es exclusivo del rector.
- Sin cambios para SCHOOL_ADMIN (todo `/dashboard/colegio/**`).

**A4. Mover admin del comité**. Crear `comite/integrantes/page.tsx` con el contenido actual de `comite/page.tsx` (guard SCHOOL_ADMIN + `ComiteCuentaCard` + `IntegrantesList`). `comite/page.tsx` pasa a: si SCHOOL_ADMIN → `redirect("/dashboard/colegio/comite/integrantes")`; si COMITE_CONVIVENCIA → render home nueva.

**A5. Home del comité** (`ComiteHome.tsx`, server component + cliente ligero): tarjetas con casos abiertos (PENDIENTE + EN_REVISION), mis casos asignados, y próximos a vencer SLA. Datos vía `ComiteConvivenciaBandejaService` existente (ya soporta filtros y SLA de SPEC-166) — reusar, no crear servicio nuevo. Solo metadatos de caso (número, categoría, estado, SLA); sin texto de reporte ni denunciante.

**A6. Estadísticas del comité** (`/comite/estadisticas` + `GET /api/colegio/comite/estadisticas`): agregados con `groupBy` sobre `SolicitudComite` del colegio: casos por estado, tiempo medio de resolución (RESUELTA/CONSENTIDA → diff fechas), top categorías escaladas. Auth: `verifyAuth("COMITE_CONVIVENCIA")` + `assertModulo(user, "colegios_comite_bandeja")`. Respuesta solo agregados.

### Bloque B — Fixes

**B1 (H01)**. Quitar `"escalada"` del enum de `alertaBatchSchema.accion` (queda: vista, gestionada, cerrada?, asignar, desasignar → ojo: H06 retira del rector cerrada/asignar/desasignar de la UI, pero el schema batch puede conservarlos si la API los usa el comité… NO: el batch es de la UI del rector; se deja el enum alineado a lo que la UI ofrece tras H06: `["vista"]` más los que el endpoint necesite por compatibilidad — decisión: enum queda `["vista", "gestionada"]` para no romper usos existentes de "Marcar gestionada" en lote si se conserva… **Refinado tras H06**: la barra batch final solo tiene "Revisar en lote" → el enum batch queda `["vista"]` y el endpoint batch responde 400 a todo lo demás. Se verifica contra tests existentes y se ajustan). UI: quitar botón "Escalar" de la barra batch; botón individual abre `EscalarAlertaModal` (motivo `z.string().trim().min(1).max(2000)`) que hace POST con `{"motivo": "..."}`.

**B2 (H02)**. `materiaId: z.union([cuidIdSchema, z.string().uuid()])` en `cursoMateriaBodySchema` (y en `cursoMateriaIdParamsSchema` si el DELETE/PUT lo valida igual). `profesorId` intacto. Tests: UUID (backfill) y CUID (app) → 201.

**B3 (H03)**. En `ProfesorDetallePageClient.tsx`: verificar shape de `GET /api/plataformas` (leer el route handler y alinear: `data.plataformas ?? data`); reemplazar `catch(() => {})` por estado de error visible ("No se pudieron cargar las plataformas — reintenta"); deshabilitar el submit mientras `plataformas.length === 0` con hint. Mismo fix defensivo no aplica a otros formularios (fuera de alcance).

**B4 (H04)**. `AlertaColegioRepository.contarPorTipoSujeto(colegioId)`: `groupBy(["tipoSujeto"], _count)` con `ESTADOS_VISIBLES`. DTO + endpoint + sección visible en `ColegioEstadisticasPageClient` (3 tarjetas con etiquetas en criollo: Estudiantes / Profesores / Acudientes).

**B5 (H05)**. `onboarding/page.tsx`: si `estado === "completado"` renderiza tarjeta de resumen (N estudiantes, M cursos, K profesores) + CTA "Ir al inicio" → `/dashboard/colegio`. Conteos: extender `GET /api/colegio/onboarding` con `resumen` cuando completado (3 `count` tenant-first, baratos). El `OnboardingModal` no se toca para el resto de estados.

**B6 (H06)**. En `AlertasColegioPageClient.tsx`:
- Tarjeta: "Revisar" (solo si `nueva` → marca vista), "Resolver aquí" (`ResolverAlertaModal` → nota bitácora + estado `gestionada` vía `SeguimientoCaso` — reusar endpoint de notas de SPEC-159 si existe `[id]/notas` + cambio de estado, o crear `[id]/resolver` que haga ambas en una transacción), "Escalar al Comité" (modal motivo).
- Retirar: Asignar, Reasignar, Desasignar, Cerrar (UI rector) y modal de asignación.
- Batch: solo "Revisar en lote".
- Chips: `title`/Tooltip con glosario: nueva = "Recién llegada, nadie la ha revisado"; vista = "Ya la vi, pendiente de actuar"; gestionada = "La resolví yo en el colegio, sin comité"; escalada = "La pasé al comité de convivencia"; cerrada = "El comité la cerró".
- Nuevo test de componente (unit) que fija los 3 botones + 1 batch + tooltips.

---

## Orden de implementación (para tasks.md tras compuerta)

1. B2 schemas (H01 schema + H02) + tests API — base pequeña y aislada.
2. B6 UI alertas (H06 + modales H01) + test componente.
3. A1-A3 nav + proxy + tests.
4. A4 mover integrantes + A5 home comité + A6 estadísticas comité (endpoint + páginas).
5. B3 plataformas, B4 estadísticas colegio, B5 onboarding.
6. Regenerar `docs/architecture/`, arch:check, gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| arch:check rojo por nav/proxy nuevos | Regenerar artefactos en el mismo commit; aserción B valida hrefs por rol |
| Tests existentes de batch alertas esperan acciones retiradas | Actualizar esos tests a la nueva superficie (batch solo vista; escalada → 400) |
| El nodo expandible rompe el test estructural nav↔catálogo | `children` referencian claves válidas del catálogo; extender el test si exige aplanar |
| "Resolver aquí" duplica lógica de notas SPEC-159 | Reusar servicio/endpoint de notas; una sola mutación con transacción |
| El comité pierde acceso a APIs que la home necesita | Las APIs de bandeja ya permiten COMITE_CONVIVENCIA (SPEC-168); se verifica con tests de API |
| `materiaId` union deja pasar ids arbitrarios | Union estricta uuid|cuid; todo lo demás → 400 |

---

## Decisiones para compuerta §4 (validar con ZEUS)

1. **H02**: union UUID+CUID (no uuid-only) — verificado en fuente: app genera CUID, migración sembró UUID. uuid-only rompería materias creadas desde UI.
2. **Batch final**: enum `alertaBatchSchema.accion` queda alineado a la UI final del rector (solo "Revisar en lote" = `vista`; "Marcar gestionada" en lote se retira también de la UI — H06 dice "SOLO Revisar en lote"). Tests de batch existentes se actualizan.
3. **Módulos de permisos**: se reusa `colegios_comite_bandeja` para los 3 items del comité (sin claves nuevas ni cambios de seed).
4. **Nodo expandible**: patrón nuevo en `ColegioSideNav` (no existe en el codebase; el de SPEC-129 fue reemplazado). Implementación con estado local + ARIA, sin librería nueva.
