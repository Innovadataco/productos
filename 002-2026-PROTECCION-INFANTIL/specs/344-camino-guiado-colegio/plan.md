# Implementation Plan: El camino guiado del colegio (SPEC-344 · A-69 · C1)

**Branch**: `work/pi-SPEC-344-camino-colegio` | **Date**: 01-09-2026 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/344-camino-guiado-colegio/spec.md`

## Summary

Extender la cadena de guardias del camino guiado (nacida en SPEC-339 para
PARENT) al rol SCHOOL_ADMIN con cinco pasos derivados: rector, plan,
profesores, cursos, estudiantes. Reutiliza el mecanismo ya probado
(cookie firmada `sesion_estado`, emisor por rol, guardián en middleware,
rebote fail-closed, sellado por server-action) y lo generaliza sin duplicar.
Retira el registro por código de 6 dígitos del colegio (pasa a enlace, mismo
`TokenRegistro` con columna `rol` aditiva). Cambia el auto-registro para que
elegir plan escriba `Colegio.finServicio` con la ventana correspondiente
(freemium 30 días parametrizable, pagado según duración) — puente barato al
bug D2 usando `calcularFinServicio` de A-64. Siembra 11 cursos ("Grado 1º"
… "Grado 11º") al crear cualquier colegio. Impone en el endpoint que toda
materia lleve profesor (D3), sin migrar `CursoMateria.profesorId String?`.
Añade documento opcional aditivo al acudiente. Apaga OnboardingColegio
(2ª fuente de verdad de "pasoActual" persistida en BD, familia de bugs que
`estado.ts:2-17` mata; nada se borra). Añade Excel de profesores fresco
(parser + validator + 3 endpoints + UI), con `bc49277fc` de SPEC-335 como
referencia, no rescate (candado 15v5).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`) · Node.js >= 22 · React 19 · Next.js 16.2 (App Router).

**Primary Dependencies**: Prisma 5.22 (schema, migraciones aditivas) ·
`jose` + `bcryptjs` (existentes — nueva ruta de enlace del colegio reusa
patrón A-67) · `exceljs` 4.4 (existente — Excel profesores).

**Storage**: PostgreSQL 16 vía Prisma. Migraciones **aditivas**:
- `TokenRegistro`: columna `rol RolUsuario @default("PARENT")` — aditiva.
- `AcudienteEstudiante`: columnas `documentoTipo String?`, `documentoNumero
  String?` — aditivas, sin unicidad nueva.
- `Colegio`: (opcional) columna `representanteLegalTipoDoc String?` si se
  prefiere sobre reflejar solo el número; alternativa: usar el mapa
  `Usuario.documentoTipo` como fuente y mantener `Colegio.representanteLegal-
  Identificacion` como reflejo. Decisión de implementación (research R6).

**Testing**: Vitest + jsdom + Testing Library (unit + integración) · Playwright
(E2E `tests/e2e/camino-colegio.spec.ts` nuevo). La suite del PADRE
(`camino-padre.spec.ts`, `estado.test.ts`, `middleware.test.ts`,
`sesion-estado-emitter.test.ts`) NO se degrada — se ACTUALIZAN los tests que
antes afirmaban "SCHOOL_ADMIN nunca porta pasoCamino" para reflejar la nueva
verdad (SC-008 exige esto).

**Target Platform**: web (app puerto 5005); soporte móvil 390 px (mockup 1.x).

**Project Type**: web app (Next.js App Router, un solo proyecto).

**Performance Goals**: sin metas nuevas. El guardián corre en Edge sin tocar
Prisma; el emisor deriva 5 queries en Node (misma clase que el padre).

**Constraints**:
- **`sellarCookieSesionEstadoEnAccion` obligatorio** en cada server action del
  camino del colegio que cierra un paso (candado 26 / I-227, brief explícito).
- **Nada del padre se degrada** (SC-008).
- **Invariante cruzada de guardias generalizada** (FR-038) — hoy hardcodea
  PARENT en `guardias.ts:245-246`; sin generalización, los destinos del camino
  colegio pasan la invariante al arranque y producen bucle I-25/I-111/I-141
  en producción, no al arrancar.
- **`esPasoCamino` invalida cookies vivas** al agregar valores nuevos — costo
  transitorio aceptable (mismo que pagó SPEC-339 al lanzarse).
- **`Prisma.CursoMateria.profesorId` sigue nullable** (D3 candado servidor,
  no schema) — el vínculo histórico no se migra.
- **Colegio con `finServicio` no-nulo (creado por admin) queda intacto** — el
  puente D2 (FR-024) solo aplica cuando el rector cierra el Paso 2 en el
  camino de auto-registro.

**Scale/Scope**: 6 endpoints nuevos (registro enlace + activar freemium
colegio + carga profesores plantilla/validar/confirmar + PATCH curso-materia
para reasignación) · 1 emisor extendido · 1 servicio derivador nuevo
(estado-colegio.ts) · 4 migraciones aditivas · 6 pantallas del camino
`/camino/colegio/**` · 1 seed nuevo (11 grados) · 2 eventos + plantillas ·
`~10` archivos de test tocados/nuevos · 0 cambios de schema que rompan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| §1.2 Solo texto | ✅ Sin multimedia; Excel de profesores es texto tabular. |
| §1.3 Presunción de inocencia | ✅ N/A (no toca consulta pública). |
| §1.4 Umbrales parametrizables | ✅ `pagos.freemium.duracion_dias` ya sembrado (`prisma/seed.ts:752`); tope Excel por parámetro; usa mecanismo existente. |
| §1.6 Habeas Data / Ley 1581 | ✅ El convenio institucional público (SPEC-343) es el documento del Paso 1. |
| IA local | ✅ N/A. |
| §2.2 Roles | ✅ Solo SCHOOL_ADMIN entra al camino nuevo; COMITE_CONVIVENCIA no. |
| §2.3 Multi-tenant | ✅ Cada Colegio es su tenant; el emisor lee del `Usuario` autenticado y su `Colegio` asociado. |
| §3.1 TS estricto / sin `any` | ✅ TS estricto; tipos de Prisma en filtros. |
| §3.2 Prisma tipado | ✅ `Prisma.CursoMateriaWhereInput` etc. |
| §3.5 Logs y auditoría | ✅ Mutaciones críticas registran `AuditLog` (registro enlace, activación plan, cambio de rector, cambio de materias). |
| §3.6 Límites y validación | ✅ Excel: 5 MB / 2000 filas por parámetro; NIT `min(1).max(50)` conservado. |
| §4.4 Async con pg-boss | ✅ N/A (nada asíncrono nuevo). |
| §4.5 Prisma aditivo | ✅ 4 migraciones aditivas, ninguna destructiva. |
| §5 Tests | ✅ Todo endpoint nuevo trae `.test.ts`; extensión del pool de unit (`vitest.unit.includes.ts`) y de integración. |
| §6.1 Auth JWT | ✅ Sin cambios; token para completar enlace es hash bcrypt en `TokenRegistro`. |
| §6.3 Datos sensibles | ✅ Sin cambios en cifrado. Ningún log incluye contraseñas. |
| §7.3 Estilos | ✅ Tailwind único; usted formal Colombia; ámbar como único color de alerta; sin rojo. |
| Reglas de oro (arch) | ✅ Antes de tocar `src/` se leyeron los mapas 22v5 (4 agentes en paralelo). `arch:check` VERDE con `06-stack.md` regenerado si hay deps nuevas (no las hay: reusa exceljs, jose, bcryptjs). Migraciones aditivas. **Regenerar `docs/architecture/` porque cambian `03-navegacion.md` (5 pantallas nuevas /camino/colegio/**), `02-roles-capacidades.md` (SCHOOL_ADMIN en guardián), `04-modelo.md` (columnas aditivas).** |
| Cero cambios que rompen datos | ✅ La única migración de valor (retro-llena `"PENDIENTE"` en `Colegio.representanteLegalIdentificacion`) NO se aplica en la migración: se hace guiada por el rector al completar el Paso 1. |
| Cero segundas fuentes de verdad | ✅ El paso del colegio se DERIVA (no se persiste). OnboardingColegio se apaga precisamente por violar esta regla. |

**Veredicto pre-Phase 0**: PASA sin violaciones.
**Re-check post-diseño**: PASA — el diseño final no introduce endpoints ni
capacidades nuevas más allá de las declaradas; la generalización de la
invariante cruzada de guardias es exactamente lo que el ratchet exige.

## Project Structure

### Documentation (this feature)

```text
specs/344-camino-guiado-colegio/
├── spec.md              # Especificación (hecha, con matices CEO 03:18)
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (endpoints nuevos)
│   ├── auth-registro-colegio-solicitar.md
│   ├── auth-registro-colegio-completar.md
│   ├── colegio-suscripcion-activar-freemium.md
│   └── colegio-carga-profesores.md
├── checklists/
│   └── requirements.md  # Validación de la spec (verde)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── migrations/YYYYMMDDHHMMSS_camino_colegio/…  # aditivas: TokenRegistro.rol, AcudienteEstudiante.doc, (opcional) Colegio.repLegalTipoDoc
│   └── seed.ts                                     # +11 cursos por defecto + eventos + params
├── src/
│   ├── app/
│   │   ├── camino/colegio/
│   │   │   ├── layout.tsx                          # NUEVO · indicador "Paso N de 5"
│   │   │   ├── rector/page.tsx                     # NUEVO · Paso 1 (form + convenio)
│   │   │   ├── plan/page.tsx                       # NUEVO · Paso 2
│   │   │   ├── profesores/page.tsx                 # NUEVO · Paso 3
│   │   │   ├── cursos/page.tsx                     # NUEVO · Paso 4
│   │   │   ├── estudiantes/page.tsx                # NUEVO · Paso 5
│   │   │   └── listo/page.tsx                      # NUEVO · pantalla cierre
│   │   ├── registro-colegio/
│   │   │   ├── page.tsx                            # MODIFICADO · pasa a enlace (retira 6 dígitos)
│   │   │   └── crear-clave/[token]/page.tsx        # NUEVO · misma UI que padre
│   │   ├── api/
│   │   │   ├── auth/registro-colegio/
│   │   │   │   ├── solicitar/route.ts              # NUEVO · anti-enum por correo + NIT
│   │   │   │   └── completar/route.ts              # NUEVO · crea Tenant+Colegio+Usuario+bienvenida
│   │   │   ├── auth/logout/route.ts                # MODIFICADO · expira sesion_estado (FR-044)
│   │   │   ├── colegio/suscripcion/
│   │   │   │   └── activar-freemium/route.ts       # NUEVO · escribe finServicio (FR-024)
│   │   │   ├── colegio/suscripcion/solicitar-plan/route.ts  # MODIFICADO · escribe finServicio + sella cookie
│   │   │   ├── colegio/carga-profesores/
│   │   │   │   ├── plantilla/route.ts              # NUEVO
│   │   │   │   ├── validar/route.ts                # NUEVO · dry-run
│   │   │   │   └── confirmar/route.ts              # NUEVO · token single-use
│   │   │   └── colegio/cursos/[id]/materias/[materiaId]/route.ts  # NUEVO PATCH (reasignar profesor)
│   ├── components/modules/colegio/
│   │   ├── camino/
│   │   │   ├── ArmazonCaminoColegio.tsx            # NUEVO · dos salidas + rótulo paso N/5
│   │   │   └── RectorForm.tsx                      # NUEVO · form Paso 1
│   │   ├── profesores/ImportProfesores.tsx         # NUEVO · UI Excel dry-run + confirmar
│   │   └── OnboardingModal.tsx                     # MODIFICADO · no se monta (apagado FR-041)
│   ├── lib/
│   │   ├── camino/
│   │   │   ├── pasos.ts                            # MODIFICADO · registry por rol
│   │   │   └── pasos-colegio.ts                    # NUEVO · Edge-safe, hermano de pasos.ts (5 pasos)
│   │   ├── dal/services/camino/
│   │   │   ├── estado.ts                           # SIN CAMBIOS
│   │   │   └── estado-colegio.ts                   # NUEVO · derivarPasoPendienteColegio(usuarioId)
│   │   ├── dal/services/registro-enlace.ts         # MODIFICADO · parametrizable por rol
│   │   ├── dal/services/registro-colegio.ts        # MODIFICADO · llama a crearCursosPorDefecto
│   │   ├── colegio/
│   │   │   ├── cursos-seed.ts                      # NUEVO · crearCursosPorDefecto(colegioId, anioLectivo)
│   │   │   └── carga-profesores/
│   │   │       ├── parser.ts                       # NUEVO · fresco (referencia bc49277fc)
│   │   │       ├── validator.ts                    # NUEVO · fresco (referencia bc49277fc)
│   │   │       └── importer.ts                     # NUEVO · token firmado single-use
│   │   ├── routing/
│   │   │   ├── guardias.ts                         # MODIFICADO · vigencia.SCHOOL_ADMIN.exentas + invariante cruzada generalizada
│   │   │   └── sesion-estado-emitter.ts            # MODIFICADO · pasoCamino por rol
│   │   ├── routing/vigencia-cookie.ts              # SIN CAMBIOS (esPasoCamino usa union tipada)
│   │   ├── email-colegio.ts                        # NUEVO · enviarEnlaceRegistroColegio + enviarBienvenidaRector
│   │   └── schemas/index.ts                        # MODIFICADO · acudienteEstudianteBodySchema con doc opcional
│   ├── middleware.ts                               # MODIFICADO · guardián camino acepta SCHOOL_ADMIN
├── tests/e2e/
│   └── camino-colegio.spec.ts                      # NUEVO · recorrido 390 px de los 5 pasos
└── vitest.unit.includes.ts                         # MODIFICADO · +tests unit de camino colegio
```

**Structure Decision**: proyecto único existente; se crea el árbol
`/camino/colegio/**` (hermano de `/camino/**` del padre) y el árbol
`src/lib/colegio/carga-profesores/` (hermano de `src/lib/colegio/carga/`).
`src/lib/camino/` gana un módulo `pasos-colegio.ts` Edge-safe (cero Prisma)
que exporta los 5 pasos del colegio; `pasos.ts` no se toca en su superficie
externa — se agrega un `PASOS_COLEGIO`/`DEFINICION_PASOS_COLEGIO` paralelo y
un registry por rol (`obtenerDefinicion(rol)`) para que el guardián y las
pantallas discriminen. Enumeración 22v5 completa de callsites de la cadena
está documentada en el reporte del agente 4 (research R2) — 6 riesgos
concretos, todos direccionados en este plan.

## Complexity Tracking

Sin violaciones de constitución que justificar. Únicos aumentos de superficie:

| Nueva superficie | Justificación |
|---|---|
| 6 endpoints nuevos | 2 de registro enlace (paridad con A-67), 1 activar freemium colegio (paridad), 3 de Excel profesores (D5), 1 PATCH curso-materia (reasignación en línea, FR-031). |
| 5 páginas + layout + cierre en `/camino/colegio/**` | Espejo directo de `/camino/**` del padre; reusan componentes de gestión con `variante="camino"`. |
| `pasos-colegio.ts` Edge-safe hermano de `pasos.ts` | Alternativa (extender `pasos.ts` con union type) fue rechazada porque el guardián debe seguir Edge-safe y la unión tipada crece la superficie de `esPasoCamino` — más frágil bajo `esPasoCamino` invalidando cookies. Registry por rol es más aditivo. |
| `estado-colegio.ts` hermano de `estado.ts` | Misma regla de derivación (sin persistir), distintos hechos. Fuente única por rol. |
| Generalización invariante cruzada (`guardias.ts:245-246`) | Sin esto, los destinos del camino colegio pasan la invariante en arranque y producen bucle en producción. |
| Modelo `OnboardingColegio` inactivo, no borrado | Regla nada-se-borra; queda documentado en decisiones. |
