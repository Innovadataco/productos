# Implementation Plan: Documentos legales públicos limpios

**Branch**: `work/pi-SPEC-343-documentos-legales-publicos` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/343-documentos-legales-publicos/spec.md`

## Summary

Cirugía documental + render. Se crean dos documentos legales públicos limpios en
`public/legal/` (política v1.0 pública y convenio v1.0 público) a partir de los
borradores internos, que se mudan a `docs/legal/` para dejar de ser servidos. El
modal de consentimiento pasa de pintar markdown crudo línea a línea a renderizar
markdown real y seguro (react-markdown + remark-gfm, HTML siempre escapado) con
tablas desplazables en móvil. Los parámetros sembrados de ruta apuntan a los
archivos nuevos sin tocar `consentimiento.version_actual` (no se re-pide firma).
Un test-candado garantiza que lo servido jamás contenga marcadores internos.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`) · Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10 (App Router) · React 19.2.4 ·
react-markdown + remark-gfm (NUEVAS, aprobadas por CEO) ·
@tailwindcss/typography (NUEVA, dev; ver research R3) · Prisma 5.22.0 (solo seed)

**Storage**: PostgreSQL 16 vía Prisma — solo `ParametroSistema` (valores sembrados de
`consentimiento.padre.documento_ruta` y `consentimiento.colegio.documento_ruta`).
Sin cambios de schema, sin migraciones.

**Testing**: Vitest + jsdom + Testing Library (render del modal y test-candado de
contenido) · tests de integración existentes del servicio/route de consentimiento
actualizados a las rutas nuevas.

**Target Platform**: web (app en puerto 5005); lectura crítica en móvil ≈375 px.

**Project Type**: web app (Next.js App Router, un solo proyecto).

**Performance Goals**: sin metas nuevas; el render del documento (~200 líneas de
markdown) es una pantalla estática — imperceptible frente al estándar de la app.

**Constraints**: markdown SIEMPRE con HTML escapado (nunca rehype-raw) ·
`consentimiento.version_actual` intacta · originales inmutables (mudanza literal) ·
migraciones: ninguna · el UPDATE de parámetros en BD prod lo ejecuta el CEO pegado
al deploy (el PR documenta ruta vieja → ruta nueva de los DOS parámetros).

**Scale/Scope**: 2 documentos markdown nuevos + 2 mudados · 1 componente
modificado · seed (2 valores) · 3 archivos de test tocados/nuevos · 0 endpoints
nuevos · 0 modelos nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| §1.2 Solo texto | ✅ Solo markdown de texto; no se añade capacidad multimedia. |
| §1.3 Presunción de inocencia | ✅ No se toca lenguaje de consulta pública; los documentos legales conservan su redacción sustantiva. |
| §1.1 Canales oficiales | ✅ Sin cambios en interfaces de reporte. |
| §1.6 Disputas / Ley 1581 | ✅ La política pública conserva íntegro el capítulo de habeas data; se le quitan solo notas internas. |
| IA local | ✅ N/A — sin IA en este frente. |
| §3.1 TS estricto / sin `any` | ✅ Componente y tests tipados; react-markdown trae tipos propios. |
| §4.5 Migraciones aditivas | ✅ Cero migraciones; solo valores del seed (upsert idempotente ya existente). |
| §6.3 Datos sensibles | ✅ No se tocan cifrado ni logs. El cambio REDUCE exposición: los borradores internos dejan de ser públicos. |
| §8 Proceso | ✅ Rama propia desde origin/main, PR contra main, gate completo (tsc, lint, test, build, dev-restart). |
| Reglas de oro (arch) | ✅ No cambia schema, proxy, navegación ni stack de runtime (deps de render UI no alteran la línea base de arquitectura; se verifica `npm run arch:check` igual). |

**Veredicto pre-Phase 0**: PASA sin violaciones. **Re-check post-diseño**: PASA —
el diseño final no introdujo endpoints, modelos ni capacidades nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/343-documentos-legales-publicos/
├── spec.md              # Especificación (hecha)
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── checklists/
│   └── requirements.md  # Validación de la spec (verde)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

*(Sin `contracts/`: no se crea ni cambia ningún endpoint; el contrato de
`POST /api/consentimiento/aceptar` y del servicio permanece idéntico.)*

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── public/legal/
│   ├── POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md        # NUEVO (limpio)
│   └── CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md # NUEVO (limpio)
├── docs/legal/
│   ├── POLITICA-TRATAMIENTO-DATOS-v0.4.md                # MOVIDO desde public/legal/ (intacto)
│   └── CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md            # MOVIDO desde public/legal/ (intacto)
├── src/components/modules/
│   ├── ModalConsentimiento.tsx                           # MODIFICADO (render markdown seguro)
│   └── ModalConsentimiento.test.tsx                      # MODIFICADO (formato + escape + tablas)
├── src/lib/
│   └── consentimiento-test-utils.ts                      # MODIFICADO (rutas nuevas)
├── src/app/api/consentimiento/aceptar/
│   └── route.test.ts                                     # MODIFICADO (hash sobre ruta nueva)
├── src/lib/legal/
│   └── documentos-servidos.test.ts                       # NUEVO (test-candado FR-011)
├── prisma/seed.ts                                        # MODIFICADO (2 valores de ruta)
├── tailwind.config.ts                                    # MODIFICADO (plugin typography — R3)
└── package.json                                          # MODIFICADO (react-markdown, remark-gfm, @tailwindcss/typography)
```

**Structure Decision**: proyecto único existente; no se crean carpetas de código
nuevas salvo `src/lib/legal/` para el test-candado (nombre alineado al dominio) y
`docs/legal/` para los internos. Callsites verificados de las rutas parametrizadas
(enumeración candado 22v5, grep completo en fuente):

- `prisma/seed.ts:173-175` y `:180-182` — valores a cambiar.
- `src/lib/dal/services/consentimiento.ts:91-92` — lee las claves; NO cambia.
- `src/lib/consentimiento-test-utils.ts:23-27` y `:36-40` — rutas de test a cambiar.
- `src/app/api/consentimiento/aceptar/route.test.ts:80` — hash del archivo viejo, a cambiar.
- Consumidores del componente: `src/app/consentimiento/page.tsx:5,51` (real) y
  `src/app/consentimiento/page.test.tsx` (mockea el modal; no le afecta el render interno).

## Complexity Tracking

Sin violaciones de constitución que justificar. Únicas adiciones de dependencia:
`react-markdown` + `remark-gfm` (runtime, aprobadas por CEO 01-09-2026 01:00) y
`@tailwindcss/typography` (estilo; justificada en research R3 — las clases `prose`
del modal existen desde SPEC-241 pero están muertas porque el plugin nunca se
instaló).
