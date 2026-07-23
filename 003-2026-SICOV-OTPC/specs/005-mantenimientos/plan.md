# Implementation Plan: 005-mantenimientos — Preventivos y correctivos (paridad legacy + modelo CEO)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Status**: PLANEADO — **gate D-022 resuelto en DOS entregas (2026-07-22) e incorporado**;
pendiente orden de implementación (NO generar tasks.md sin orden explícita)

**Input**: Feature specification from `specs/005-mantenimientos/spec.md` + `HANDOFF-SICOV.md`
**§9, §9.1, §10, §11** (prevalecen sobre §2-§6)

## Registro del gate D-022 (ZEUS, 2026-07-22 — dos entregas)

| # | Punto | Resolución |
|---|---|---|
| 1 | `exceljs` | **APROBADA**; **CSV (D-019e) se suma** como formato nuevo (no reemplaza XLSX) |
| 2 | PDF en filesystem | **APROBADO CON CONDICIONES**: env **fuera de la app** + **interfaz de almacenamiento** (`guardarArchivo`/`leerArchivo`); respaldo de la carpeta = requisito de switch-over |
| 3 | `hora` varchar(8) | **APROBADO como DESVIACIÓN** (legacy `table.time()`, `1741738351341_tbl_preventivos.ts:11`); condición: `^([01]\d|2[0-3]):[0-5]\d$` en el borde |
| 4 | Variante JSON `bulk/*` | **SE CORTA** |
| 5 | Catálogo tipos de identificación | **RESUELTO**: 12 valores del manual |
| B1 | id que viaja a la Super | Viaja el **id EXTERNO**, pero id local e id externo van en **COLUMNAS SEPARADAS** (base Y detalle) — corrige bug legacy `RepositorioMantenimientoDB.ts:1443` |
| B2 | Variable de entorno | Se **CONSERVA `URL_MATENIMIENTOS`** [sic] — viva en `.env.example:52` y `cliente-http.ts:76`; renombrar rompe `requireEnv` |
| B3 | Alcance por rol (D-015) | Server-side; roles 2/3 atados a NIT efectivo (rol 3 = NIT del admin) ignorando `nit` del cliente; **rol 1 ve todo = DESVIACIÓN DELIBERADA aprobada por el CEO**; SQL parametrizado (no replicar I-08) |
| B4 | Módulo = dos cosas (§10.2) | Cliente (2) = PDF del programa (último ACTIVO), NO registra; Operador (3) = registros + carga masiva |
| D-021 | Envío inmediato | **Dentro de 005-A, para LAS TRES COLAS** (despachos, llegadas, mantenimientos) + reintentos/backoff por env (D-019b) + reenvío manual = ciclo completo nuevo |
| D-017/D-018 | Guard de módulos | **Dentro de 005-A**: guard compartido server-side aplicado a cada endpoint de operación; **7 módulos asignables** (5 legacy + Salidas + Llegadas) |
| D-016 | Partición | **005-A** = datos+integración+envío inmediato+cola+jobs+guard+XLSX/CSV · **005-B** = pantalla+PDF+modales. Recorte autorizado: XLSX/CSV → 005-B. Envío inmediato y guard NO se mueven |

## Summary

Quinta feature del 003, partida en **005-A** (backend estructural) y **005-B** (pantalla). Paridad
del módulo de mantenimientos del legacy — solo tipos 1 y 2 — bajo el **modelo de reporte del CEO**
(`HANDOFF §11`): registro web con **intento inmediato y caída a cola**, carga masiva **XLSX/CSV
todo-o-nada** por cola, reintentos **parametrizables**, log de fallidos con **corregir-y-reenviar**.
Además, dos piezas estructurales que evitan retrofit en 005-008: el mismo envío inmediato para
**despachos y llegadas** (D-021) y el **guard de permisos por módulo** aplicado a todos los
endpoints de operación (D-017, 7 módulos D-018). Cliente doble token reutilizado con el contrato de
cabeceras propio de mantenimientos (`URL_MATENIMIENTOS` [sic] se conserva).

## Technical Context

**Language/Version**: TypeScript 5.8 (`strict`) / Node.js ≥ 22
**Primary Dependencies**: Next.js 16.2.10 (App Router), Prisma 5.22, React 19, zod, jose/bcryptjs;
**nuevas:** `exceljs` ^4.4 (XLSX + lector CSV; solo server) y **`luxon` ^3 + `@types/luxon`**
(parsers de fecha/hora con paridad exacta de los 14 formatos del legacy — ver D11)
**Storage**: PostgreSQL 16 Docker 003 (`:5434`), esquema `sicov`; PDFs (005-B) vía interfaz de
almacenamiento con raíz `ALMACENAMIENTO_DIR` (env, FUERA de la app; D-022 #2)
**Testing**: Vitest — **mitigación jsdom**: `vitest.config.ts` hoy usa `environment: "jsdom"` global
SIN `environmentMatchGlobs` (verificado); se añade `environmentMatchGlobs` para correr
`src/lib/mantenimientos/**` y rutas API nuevas en **node** (exceljs y su lector CSV resuelven build
de navegador bajo jsdom — riesgo real, ver D12)
**Target Platform**: Mac Studio dev (app `:5010`); worker único demonio (`HANDOFF §11.4`)
**Project Type**: web app (Next.js full-stack + worker)
**Performance Goals**: archivo de 500 filas validado < 5 s; listados paginados < 1 s
**Constraints**: migraciones ADITIVAS con `--create-only` + revisión de SQL; stub doble gate;
un solo worker/advisory lock; America/Bogota; sin secretos en repo
**Scale/Scope**: **~18 endpoints** (15 mantenimientos + 3 archivos-programas) + 2 rutas tocadas
(despachos/llegadas) + guard transversal, 6 tablas, 1 pasada de worker, 1 pantalla (005-B)

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| §1.1 Aislamiento Docker | Reusa contenedor/BD 003 (`:5434`) y app `:5010`; sin infra nueva ✔ |
| §1.2 Migraciones aditivas | `add_mantenimientos` solo CREA tablas/columnas nuevas; `--create-only` + revisión; nunca reset ✔ |
| §1.3 Secretos por env | Sin secretos nuevos; `URL_MATENIMIENTOS` no es secreta; NO se replica el bearer hardcodeado ✔ |
| §1.4 Doble token | Token proveedor cacheado + token vigilado + herencia rol 3; variante de cabeceras de mantenimientos verificada y documentada ✔ |
| §1.5 Cinco reglas de oro | Spec-Kit completo → commit por US → deploy limpio → gates → cierre ✔ |
| §2.3 Colas | Pasada nueva en el worker único (demonio, §11.4); prohibido segundo proceso ✔ |
| §3 Calidad TS | Sin `any`; catch `unknown`; SQL parametrizado (D-015) ✔ |
| §4.3/§4.4 | Paginación estándar; XLSX/CSV server-side; PDF ≤ 4 MB → 413 ✔ |
| §6.1 Autorización | Guard por módulo server-side (D-017) — corrige I-09; alcance por NIT server-side (D-015) — corrige I-08 ✔ |
| §6.3 Bugs no replicados | exportar sin auth; sobrescritura del enlace local (B1); interpolación SQL; reintento sin reset ✔ |
| Guardarraíl APIs | `INTEGRACIONES_MODO=stub` default; doble gate; tests solo stub ✔ |

**Desviaciones aprobadas:** `exceljs`+`luxon` (D-022 #1 / D11); `hora` varchar(8) con regex de borde
(D-022 #3); **rol 1 ve todas las empresas** (D-015 — desviación deliberada del CEO, NO paridad).

## Project Structure

### Documentation (this feature)

```text
specs/005-mantenimientos/
├── spec.md              # actualizado con el gate completo (partición D-016, US1-US6)
├── plan.md              # este archivo
├── research.md          # R1-R13
├── data-model.md        # 6 tablas + columnas 003 (id externo separado)
├── quickstart.md        # validación E2E stub (005-A y 005-B)
├── contracts/
│   ├── mantenimientos.md      # 15 endpoints + worker + cabeceras + D-021/D-017
│   └── archivos-programas.md  # 3 endpoints PDF (005-B)
├── checklists/requirements.md
└── tasks.md             # NO GENERADO — pendiente orden de ZEUS
```

### Source Code (repository root)

```text
# ── 005-A ──────────────────────────────────────────────────────────────
prisma/schema.prisma                       # +6 modelos (ids externos en columnas separadas)
prisma/migrations/<ts>_add_mantenimientos/ # ADITIVA (creada con --create-only + revisión)
prisma/seed.ts                             # tipos 1-4, 7 módulos (D-018), demo
package.json                               # + exceljs, luxon (+ @types/luxon)
vitest.config.ts                           # + environmentMatchGlobs (node para lib/mantenimientos y api nuevas)
.env.example                               # + COLA_MAX_REINTENTOS, COLA_BACKOFF_MIN (URL_MATENIMIENTOS ya existe)

src/lib/guard-modulos.ts                   # D-017: requiereModulo(usuario, modulo) sobre modulos.ts (+test)
src/lib/integracion/
├── cabeceras.ts                           # + construirCabecerasMantenimiento (+test)
├── cliente.ts                             # + postMantenimiento / getMantenimiento
├── cliente-stub.ts                        # + stubs mantenimiento (FALLA* fuerza error) (+test)
└── cliente-http.ts                        # + impl. real (usa URL_MATENIMIENTOS [sic] ya presente)
src/lib/normalizar.ts                      # + extraerIdMantenimientoExterno (REUSA extractores/mensajes existentes) (+test)
src/lib/mantenimientos/
├── tipos.ts                               # dominio + TIPOS_OPERABLES + TIPOS_IDENTIFICACION (12) + REGEX_HORA + REGEX_PLACA
├── validacion.ts                          # columnas, tipos, hora, placa 3+3, todo-o-nada (+test)
├── excel.ts                               # lector XLSX/CSV (exceljs) + normalización luxon + plantilla + historialAXlsx (+test)
├── servicio.ts                            # base/detalle (inmediato+caída a cola, desactiva previos), masivo transaccional (+test)
└── cola.ts                                # crearJob, procesarLote, procesarJob*, PendienteError, reintentos (acciones) (+test)
src/lib/despachos/cola.ts                  # MAX_REINTENTOS/BACKOFF_MIN → env (D-019b) + envío inmediato reutilizable
src/lib/llegadas/cola.ts                   # ídem
src/app/api/integracion/despachos/route.ts # + intento síncrono con caída a cola (D-021) + guard Salidas
src/app/api/integracion/llegadas/route.ts  # ídem + guard Llegadas
src/app/api/mantenimientos/                # 15 endpoints (contrato) — todos con guard Mantenimientos
scripts/worker.mjs                         # + pasada 3 (mantenimientos); lee env de reintentos

# ── 005-B ──────────────────────────────────────────────────────────────
src/lib/almacenamiento.ts                  # interfaz guardarArchivo/leerArchivo (D-022 #2) (+test)
src/lib/mantenimientos/archivos.ts         # PDF programa: último ACTIVO desactiva anteriores (+test)
src/app/api/archivos-programas/            # 3 endpoints (contrato)
src/app/dashboard/mantenimientos/page.tsx  # tabs + cards por rol + modales + estados de placa
```

**Structure Decision**: estructura por dominio de 001-004. Rutas base `/api/mantenimientos/*` y
`/api/archivos-programas/*`. El guard D-017 es lib compartida (no middleware Next) para aplicarse
explícitamente por endpoint junto a `verifyAuth`, testeable en unidad.

## Decisiones de diseño (detalle en research.md)

- **D1. Individual inmediato con caída a cola / masivo diferido** (R1, §11.1, D-021): el patrón
  se implementa una vez (`intentarEnviarConCaida(job)`) y lo usan las 3 colas.
- **D2. Cabeceras propias de mantenimientos** (R2): `construirCabecerasMantenimiento` con
  `vigiladoId` opcional; nunca `documento` en este módulo.
- **D3. Cliente extendido, gate único** (R3): `postMantenimiento`/`getMantenimiento`; base URL
  **`URL_MATENIMIENTOS`** [sic] — nombre heredado que se CONSERVA (B2).
- **D4. Worker único, tercera pasada** (R4): mismo advisory lock `30032026`;
  `MantenimientoPendienteError` sin consumir reintento; env `COLA_MAX_REINTENTOS`/`COLA_BACKOFF_MIN`.
- **D5. `exceljs` para XLSX y CSV** (R5): un solo pipeline; CSV con tolerancia a `;`.
- **D6. Modelo con ids separados** (R6, B1): base `tmt_id` (local) vs `tmt_mantenimiento_id`
  (externo); detalle `*_mantenimiento_id` (local, nunca se sobrescribe) vs
  `*_mantenimiento_id_externo` (columna ADITIVA 003). `hora` varchar(8) + regex de borde;
  `nit` y `tmt_usuario_id` **BigInt** (ojo serialización JSON).
- **D7. PDFs tras interfaz de almacenamiento** (R7, 005-B): `ALMACENAMIENTO_DIR` fuera de la app;
  último ACTIVO desactiva anteriores (§10.2); respaldo = switch-over.
- **D8. Reintento = corregir y reenviar** (R8, §10.6): `actualizar` con payload actualiza también
  datos locales, resetea a 0 y dispara ciclo completo; alcance de listados por D-015 (server-side,
  rol 3 = NIT del admin, rol 1 todo por desviación aprobada, SQL parametrizado).
- **D9. Jobs UI dentro del módulo** (R8): tabla de sincronización en 005-B; dashboard después.
- **D10. Fechas** (R10): timestamptz + `bogota.ts`; NO se replica el hack UTC-5.
- **D11. `luxon` como dependencia** (nueva): los parsers legacy usan luxon con ~14 formatos
  (`fromISO/fromFormat×8/fromRFC2822/fromJSDate/serial`); reimplementarlos a mano es riesgo de
  divergencia silenciosa. Se añade `luxon` (prod, cero deps) + `@types/luxon` (dev) y los tests
  cubren los formatos del legacy. Alternativa descartada: reimplementación propia (más código, menos
  paridad).
- **D12. Vitest → node para exceljs** (nueva): `environmentMatchGlobs: [["src/lib/mantenimientos/**",
  "node"], ["src/app/api/mantenimientos/**", "node"], ["src/app/api/archivos-programas/**", "node"]]`
  — evita que exceljs (XLSX y CSV) resuelva el build de navegador bajo el jsdom global actual.
- **D13. Reuso de `normalizar.ts`** (menor del gate): los extractores de id/mensaje existentes se
  REUSAN; solo se añade `extraerIdMantenimientoExterno` con sus candidatos, en el mismo módulo con
  su test — no se crea un módulo de extractores paralelo.
- **D14. Guard D-017** (nueva): `requiereModulo(usuarioId, 'mantenimientos'|'salidas'|...)` consulta
  las asignaciones (reusa `cargarModulos`) y responde 403; se aplica endpoint por endpoint (los 52
  tests existentes se ajustan donde aplique). Seed: 7 módulos (D-018).

## Fases de implementación (post-aprobación)

### 005-A (ventana jul 23-29)

1. **Datos:** deps (`exceljs`, `luxon`) + `vitest.config.ts` (D12) + 6 modelos + migración
   `--create-only` revisada + seed (tipos, 7 módulos, demo) + env de reintentos en `.env.example`.
2. **Integración:** `construirCabecerasMantenimiento` + `postMantenimiento`/`getMantenimiento`
   (stub/http) + `extraerIdMantenimientoExterno` en `normalizar.ts`. Tests (cabeceras, herencia
   rol 3, cero red).
3. **US5 — guard (commit `feat(003-US5)`):** `guard-modulos.ts` + aplicación a endpoints existentes
   de despachos/llegadas + seed módulos. Ajustar tests existentes. *(Se hace temprano: las rutas
   nuevas de mantenimientos nacen ya con guard.)*
4. **US4 — envío inmediato 3 colas (commit `feat(003-US4)`):** helper compartido intento síncrono +
   caída a cola; rutas despachos/llegadas; env `COLA_MAX_REINTENTOS`/`COLA_BACKOFF_MIN` en las colas
   existentes. Tests (inmediato OK, caída a cola, env override, reset manual conservado).
5. **US1 — registro individual (commit `feat(003-US1)`):** `servicio.ts` (base con desactivación +
   detalle, ids separados, inmediato+caída) + rutas individuales + placas/historial/exportar. Tests.
6. **US2 — carga masiva (commit `feat(003-US2)`):** `validacion.ts` (todo-o-nada, regex hora/placa,
   catálogo 1..12) + `excel.ts` (XLSX/CSV, luxon, plantilla) + masivo transaccional + rutas bulk +
   plantilla. Tests (columnas, "Fila N", tipos, serial, hora, CSV `;`, todo-o-nada, 400/202).
7. **US3 — cola y jobs (commit `feat(003-US3)`):** `cola.ts` + rutas jobs (alcance D-015) + pasada 3
   en worker. Tests (dependencia sin consumir reintento, máximos por env, corregir-y-reenviar,
   redirección al base, alcance rol 3 = NIT admin, rol 2 ignora `nit` ajeno).
8. **Verificación 005-A:** `typecheck`+`lint`+`vitest`+`build` + quickstart (secciones 005-A) +
   guardarraíl. **Aviso a ZEUS si la ventana no alcanza** → recorte autorizado: mover US2 (XLSX/CSV)
   a 005-B.

### 005-B (siguiente ventana)

9. **US6a — programa PDF:** `almacenamiento.ts` + `archivos.ts` (último ACTIVO) + rutas
   archivos-programas. Tests (413/400, activo/inactivo, interfaz).
10. **US6b — pantalla:** tabs + cards por rol (§10.2) + estados de placa (5/3) + modales
    registro/historial/corrección + resumen y descarga de errores TXT + tabla de sincronización +
    menú. Tests de helpers.
11. **Verificación + cierre 005:** gates completos + quickstart en vivo + `cierre.md` + sección
    Implementación en `spec.md` + deuda técnica + push con evidencia.

## Riesgos / deuda

- **Contrato real del API de mantenimientos** sin credenciales (única pregunta abierta); validar
  antes del switch-over.
- **BigInt (`nit`, `tmt_usuario_id`)** en JSON: serialización explícita en rutas/tests.
- **Todo-o-nada transaccional:** el encolado masivo va en transacción; para archivos muy grandes
  (>1000 filas) evaluar `createMany` — decidir en implementación.
- **Ajuste de tests existentes por el guard D-017:** las rutas de despachos/llegadas exigirán módulo;
  los fixtures del seed deben asignar Salidas/Llegadas a los usuarios demo (riesgo controlado, se
  ajusta en la fase 3).
- **Estados de placa (§10.3):** si el historial de la Super no trae el estado calculado, el umbral
  exacto de "próximo a vencer" se cierra con el CEO en 005-B (asunción documentada en spec).
- **Respaldo de `ALMACENAMIENTO_DIR`** (005-B): requisito de switch-over — al runbook/cierre.
- **Ventana jul 23-29:** si no alcanza, el recorte autorizado es XLSX/CSV → 005-B (envío inmediato y
  guard NO se mueven). Se avisa a ZEUS apenas se detecte.

## Operación (regla reforzada)

Dev/worker: matar SOLO por PID o puertos del 003 (5010/5434); prohibido `pkill` por patrón. Worker =
demonio único con supervisor (`npm run worker`, §11.4); un solo proceso vivo tras cada cambio.

## Comandos (quickstart resumido)

```bash
npm install
npx prisma migrate dev --name add_mantenimientos --create-only   # revisar SQL (aditiva)
npx prisma migrate dev && npm run db:seed
rm -rf .next && npm run dev        # :5010
npm run worker                     # worker único, 3 pasadas
npm run typecheck && npm run lint && npm run test && npm run build
```

---

**⛔ DETENIDO (modo plan).** Gate D-022 completo (dos entregas) incorporado. Siguiente paso SOLO con
orden explícita de ZEUS: `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`.
