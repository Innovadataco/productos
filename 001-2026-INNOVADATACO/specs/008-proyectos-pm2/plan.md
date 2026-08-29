# Implementation Plan: Proyectos PM2 (edición, fases Kanban y gestión completa)

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `008-proyectos-pm2`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/008-proyectos-pm2/spec.md` (Status: **Aprobada 2026-07-24, D-060**).
Turno nocturno desatendido: la compuerta del plan la sustituye `/speckit-analyze` (D-060).

## Summary

Convertir Proyectos de "crea y olvida" en gestión PM2. **US1** (editar un proyecto — hoy
imposible) y **US2** (fases en un tablero Kanban) son el **mínimo de la noche**; US3–US6
entran por prioridad si queda tiempo, cada una en su commit.

La **incidencia I-011** entra en US1 y se trata como criterio, no como parche: *ningún
elemento debe señalar interactividad que no tiene*.

## Decisión que ordena la noche: US1 + US2 no necesitan migración

`Proyecto` ya tiene `codigo`, `nombre`, `cliente`, `estado` y `currentPhase`. Editar y mover
fases **no cambia el esquema**: son rutas y UI. Las tablas nuevas (entregables, partidas,
recursos, hitos, lecciones) solo hacen falta a partir de US3.

Esto es deliberado: el mínimo de la noche queda **sin riesgo de migración** sobre la BD del
CEO. La primera migración solo aparece si se llega a US3, y entonces se ensaya en BD
desechable (D-039) antes de tocar la viva.

## Decisión: las fases son un catálogo FIJO en código, no una tabla

Las 4 fases PM2 (Inicio · Planeación · Ejecución · Cierre) son metodología, no configuración
(spec, Edge Cases). Viven en `src/lib/fasesPm2.ts` como constante, con su validación. Esa es
la **diferencia deliberada con SPEC-007**, donde las columnas salían de un catálogo en BD.

Consecuencia práctica: la ruta de edición **valida** `currentPhase` contra esa lista y
responde 400 ante una fase inventada. Hoy `POST /api/projects` acepta cualquier string.

## Decisión: RZ-2 se acredita por sustracción

El tablero de fases **no aporta ni una línea de tablero**. Reutiliza
`@/components/kanban/KanbanBoard` tal cual y solo escribe su adaptador
(`src/lib/tableroProyectos.ts` + `TableroProyectos.tsx`), en el mismo patrón que el adaptador
de oportunidades. Si `KanbanBoard.tsx` apareciera modificado en el diff de esta spec, RZ-2
estaría incumplida. **No aparece.**

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, React 19.2.4, Prisma 5.22.0, Vitest 4.1.9.
**Ninguna dependencia nueva.**

**Storage**: PostgreSQL 16 (puerto host 5435). **US1 y US2: sin migración.**

**Testing**: Vitest en entorno `node`, sin BD ni Ollama. Línea base tras SPEC-007: **303
pruebas en 41 archivos**.

**Constraints**: cero `any` nuevos; cero fugas de `err.message`; `verifyAuth` + `apiError` en
toda ruta; gate `tsc --noEmit`; staging explícito; puertos 5005/5433/5010/5434 y RAG intactos.

**Scale/Scope (US1+US2)**: 1 ruta API nueva (`projects/[id]` con PATCH y DELETE), 2 archivos
de lógica nuevos, 1 componente nuevo, 2 componentes retocados, 2 archivos de test nuevos.

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada (D-060); plan y `/speckit-analyze` antes de implementar. |
| §0.2 Pruebas | ✅ `projects/[id]/route.test.ts` nuevo; lógica de fases con test propio. |
| §0.3 Tipado / errores | ✅ Cero `any`. Se **elimina** el `catch (err: any)` de `ProjectForm.tsx` y su `alert` con `err.message`. |
| §0.5 Aislamiento | ✅ Solo `001-`. Sin RAG, sin Base Oficial, sin otros productos. Sin trabajo pesado. |
| §2.5 Auditoría | ✅ PATCH y DELETE de proyecto registran `auditLog`; el cambio de fase deja su propio registro con origen y destino. |
| §3.2 Rutas API | ✅ `projects/[id]/route.ts` sigue la convención `[id]`; la prueba de superficie la cubrirá automáticamente. |
| §5.1 / §5.2 | ✅ `verifyAuth` en ambos manejadores; validación explícita de campos y de fase. |
| §6.2 Reglas de React | ✅ Sin `setState` síncrono en `useEffect`. |

**Sin violaciones.** Complexity Tracking vacío.

## Cambios exactos por bloque

### Bloque 1 · Fases PM2 — `src/lib/fasesPm2.ts`

```typescript
export interface FasePm2 { key: string; nombre: string }
export const FASES_PM2: readonly FasePm2[] = [
  { key: "initiation", nombre: "Inicio" },
  { key: "planning",   nombre: "Planeación" },
  { key: "execution",  nombre: "Ejecución" },
  { key: "closing",    nombre: "Cierre" },
];
export function esFasePm2(key: string): boolean
export function nombreDeFase(key: string): string   // fallback: la propia clave
```

Las claves conservan las que ya usa el dato vivo (`currentPhase` tiene default `initiation`
y `ProjectForm` ya escribía `planning`/`execution`). **`closing` es nueva en la UI**: el
formulario de creación solo ofrecía tres fases, así que "Cierre" era inalcanzable — se
corrige aquí.

`nombreDeFase` devuelve la clave si no la reconoce: un proyecto con una fase heredada rara no
desaparece del tablero (mismo criterio que las huérfanas de SPEC-007).

### Bloque 2 · Ruta de edición — `src/app/api/projects/[id]/route.ts` (nueva)

- **`PATCH`**: edita `codigo`, `nombre`, `cliente`, `estado`, `currentPhase`. `verifyAuth` →
  401; proyecto inexistente → **404**; `codigo` en uso (P2002) → **409**; fase no PM2 →
  **400**; campos vacíos → 400. Contrato `apiError`, sin `err.message`.
- **`DELETE`**: borra el proyecto. Hoy no hay tablas hijas; cuando US3–US6 las añadan, será
  CASCADE en el esquema (FR-002) y el borrado no cambia.
- **Auditoría** (§2.5): `proyecto.fase.cambio` cuando `currentPhase` cambia (con origen y
  destino), `proyecto.editado` cuando cambian otros campos, `proyecto.eliminado` en DELETE.
  Un PATCH que reenvía la misma fase **no** audita cambio de fase (FR-007).

### Bloque 3 · Adaptador de proyectos — `src/lib/tableroProyectos.ts` + componente

`columnasDeFases()` → una columna por fase PM2, en orden de metodología.
`tarjetasDeProyectos(proyectos)` → tarjeta por proyecto (nombre, código, cliente).

`src/components/proyectos/TableroProyectos.tsx`: carga `/api/projects`, alimenta el
**`KanbanBoard` de SPEC-007 sin modificarlo**, y persiste con
`PATCH /api/projects/[id]` `{ currentPhase }`, optimista con rollback y mensaje propio.

### Bloque 4 · UI de edición y **I-011** (US1)

**`ProjectForm.tsx`** pasa a servir crear **y** editar (FR-004):
- Prop opcional `proyecto`: si llega, precarga el formulario y hace `PATCH` en vez de `POST`.
- Selector de fase con las **4** fases desde `FASES_PM2` (antes 3 cableadas).
- Se elimina `catch (err: any)` y el `alert("...", err.message)`: mensaje propio en el
  formulario (§0.3 y deuda P1 de SPEC-009 adelantada aquí porque este archivo se reescribe).
- Se corrige el pie "Local Storage Active": el proyecto persiste en PostgreSQL, no en local
  storage. Un rótulo que miente sobre dónde viven los datos es del mismo género que I-011.

**`src/app/projects/page.tsx`** — los **cuatro** casos de I-011 encontrados en el barrido:

| # | Elemento | Hoy | Queda |
|---|---|---|---|
| 1 | `ArrowRight` en círculo con hover (línea 107) | sin `onClick` | **botón real** que abre la edición |
| 2 | Tarjeta con `cursor-pointer` y hover | sin `onClick` | **abre la edición** al pulsar |
| 3 | Input "Buscar en la Base de Datos Real…" | no filtra nada | **filtra** por código, nombre y cliente |
| 4 | Botón de filtro (icono `Filter`) | sin `onClick` | **se elimina**: no tiene semántica definida y fingirla sería repetir I-011 |

El criterio es el de la incidencia: o el elemento hace lo que aparenta, o no aparenta.

**`ProyectosTab.tsx`**: hoy ignora `submoduleId` (además de ser un `no-unused-vars` de la
línea base). Pasa a enrutar `listado` → listado y `fases` → tablero. `SUBMODULES.proyectos`
suma `{ id: "fases", title: "Fases PM²" }`.

### Bloque 5 · Pruebas

- `src/lib/fasesPm2.test.ts`: las 4 fases, orden, validación, fallback de nombre.
- `src/lib/tableroProyectos.test.ts`: 4 columnas (SC-003), proyecto en la columna de su fase,
  fase desconocida no rompe.
- `src/app/api/projects/[id]/route.test.ts`: 401 / 404 / 409 / 400 fase inválida / edición OK
  (SC-001, SC-002); auditoría del cambio de fase (SC-004) y **no** auditoría si la fase llega
  igual; DELETE con 401 y 404; sin fuga de `err.message`.

## Orden de implementación (sin turno)

1. `fasesPm2.ts` + test.
2. `projects/[id]/route.ts` + test. ← **US1 servidor**
3. `ProjectForm` editable + `projects/page.tsx` (I-011, 4 casos). ← **US1 cliente**
4. `tableroProyectos.ts` + `TableroProyectos.tsx` + submódulo. ← **US2**
5. Gates: suite ≥ 303, `tsc`, `eslint`, `build`.
6. US3–US6 solo si queda tiempo, por prioridad (US3 → US5 → US4 → US6), **cada una en su
   commit** y con ensayo de migración en BD desechable antes de tocar la viva.

## Verificación por requisito (US1 + US2)

| FR | Cómo se verifica |
|---|---|
| FR-001 / SC-001 | test de PATCH: nombre y cliente persisten |
| FR-002 | DELETE existe y borra; CASCADE queda para cuando haya hijas (US3+) |
| FR-003 / SC-002 | tests de 409 (código en uso), 404 (inexistente), 401 (sin sesión) |
| FR-004 | `ProjectForm` con prop `proyecto` hace PATCH; la tarjeta abre la edición |
| FR-005 / SC-003 | `columnasDeFases` devuelve las 4 fases PM2 en orden (test) |
| FR-006 / SC-004 | test de auditoría del cambio de fase con origen y destino |
| FR-007 | rollback en el adaptador; misma fase → sin llamada (garantizado por `KanbanBoard`) |
| FR-008 / SC-005 | `KanbanBoard.tsx` **no aparece modificado** en el diff de esta spec |
| FR-015/016 / SC-013 | ruta con `verifyAuth` + `apiError`; `tsc` y `eslint` limpios |
| I-011 | los 4 elementos del barrido, o funcionan o se retiran |

## Riesgos

- **R-01 · RZ-2 se incumple sin querer** tocando `KanbanBoard` para acomodar las fases.
  Mitigación: el adaptador absorbe toda diferencia; el diff del tablero debe ser vacío y es
  criterio de revisión (SC-005).
- **R-02 · Validar `currentPhase` rompe datos vivos** con una fase fuera de la lista.
  Mitigación: la validación se aplica solo a lo que **entra** por PATCH/POST; al **leer**,
  `nombreDeFase` degrada con la propia clave y el proyecto sigue visible.
- **R-03 · US3–US6 tientan a migrar de madrugada.** Mitigación: quedan explícitamente detrás
  del mínimo, cada una en su commit, y ninguna se aplica a la BD viva sin ensayo en desechable
  con conteo antes/después (D-039).
- **R-04 · `ProjectForm` sirviendo dos modos se enreda.** Mitigación: un solo formulario, el
  modo lo decide la presencia de la prop `proyecto`; el texto del botón y el título lo reflejan.

## Artefactos de esta spec (D-066)

| Artefacto | Estado |
|---|---|
| `spec.md`, `plan.md`, `tasks.md`, `checklists/` | sí |
| `research.md` | **sí** — añadido en el turno D-068 |
| `quickstart.md` | **sí** — añadido en el turno D-068 |
| `data-model.md` | **no aplica para US1 y US2** (no tocan el esquema). US3 sí añadió la entidad `Entregable`, documentada en el esquema Prisma y en su migración; si entran US4–US6, con sus tablas, este artefacto **pasa a ser obligatorio**. |

## Complexity Tracking

Sin violaciones. La única decisión que podría parecer desviación —fases fijas en código en vez
de catálogo en BD— la fija la propia spec (Edge Cases) como diferencia deliberada con
SPEC-007: son metodología PM2, no configuración del cliente.
