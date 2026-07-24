# Implementation Plan: Kanban de Oportunidades (componente reutilizable)

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `007-kanban-oportunidades`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/007-kanban-oportunidades/spec.md` (Status: **Aprobada 2026-07-24, D-060**).
Turno nocturno desatendido: la compuerta del plan la sustituye `/speckit-analyze` (D-060).

## Summary

Añadir al módulo de Oportunidades una vista **Tablero** donde cada estado del catálogo
`LicitacionStatus` es una columna y cada oportunidad una tarjeta que se arrastra entre
columnas, persistiendo el cambio de estado con registro en auditoría.

La condición de diseño de ZEUS (RZ-1) manda sobre todo lo demás: el tablero es un
**componente genérico** que no sabe nada de oportunidades. SPEC-008 lo reutilizará para las
fases PM2. **No es trabajo pesado.**

## Decisión de diseño central: tres capas, no dos

La spec pide "componente genérico + adaptador". El plan lo parte en **tres** para que lo
verificable no dependa de jsdom:

| Capa | Archivo | Qué es | Cómo se prueba |
|---|---|---|---|
| **Lógica genérica** | `src/lib/kanban.ts` | Tipos `ColumnaKanban`/`TarjetaKanban` y funciones **puras** (agrupar por columna, detectar huérfanas, decidir si un movimiento es real) | Vitest en `node`, sin DOM |
| **Presentación genérica** | `src/components/kanban/KanbanBoard.tsx` | Columnas, tarjetas y arrastre. Emite `onMover`. **Solo importa `@/lib/kanban`** | Contrato + revisión de imports (SC-008) |
| **Adaptador de dominio** | `src/lib/tableroOportunidades.ts` + `src/components/licitaciones/TableroOportunidades.tsx` | Traduce estados↔columnas y oportunidades↔tarjetas (puro) y persiste el movimiento (componente) | Vitest sobre las funciones puras + test de la ruta de persistencia |

**Por qué esta partición**: la suite corre en entorno `node` (vitest.config.ts) y no hay
todavía ningún test de componente en el proyecto. Meter la lógica del tablero dentro del
`.tsx` obligaría a estrenar jsdom esta noche para poder probar cualquier cosa. Sacando el
mapeo y las reglas a funciones puras, **lo que decide comportamiento queda cubierto por la
suite existente** y el `.tsx` queda como una capa fina de presentación. SC-008 (el tablero no
importa nada de oportunidades) se acredita leyendo los imports, que es exactamente lo que la
spec pide.

## Decisión: arrastre nativo HTML5, sin librería

El contrato del componente no depende de la librería de arrastre (spec, Edge Cases). Se usa
**HTML5 drag & drop nativo** (`draggable`, `onDragStart`, `onDragOver`, `onDrop`):

- **Cero dependencias nuevas** en una noche desatendida. `@dnd-kit` o `react-beautiful-dnd`
  añadirían peso y superficie de fallo sin aportar nada que esta spec necesite (no hay
  reordenar dentro de la columna — está *Out of Scope*).
- Si mañana el negocio pide reordenar tarjetas, se cambia la implementación del arrastre
  **dentro** de `KanbanBoard` sin tocar su contrato ni a sus dos consumidores.

## Decisión: se **añade** un submódulo "Tablero", no se sustituye "Estados"

FR-011 deja la elección al plan. Se **añade**: "Estados" sigue administrando el catálogo (es
la única vía para crear estados) y "Tablero" es la vista operativa nueva. Sustituir "Estados"
por el tablero dejaría el catálogo sin pantalla de administración — una regresión.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, React 19.2.4, Prisma 5.22.0, Vitest 4.1.9.
**Ninguna dependencia nueva.**

**Storage**: PostgreSQL 16 (puerto host 5435). **Sin migración**: el tablero no cambia el
esquema; `Licitacion.estadoId` y `LicitacionStatus` ya existen y bastan.

**Testing**: Vitest en entorno `node`, sin BD ni Ollama (mocks spec 002). Línea base: **282
pruebas en 39 archivos**.

**Constraints**: cero `any` nuevos; cero fugas de `err.message`; gate `npx tsc --noEmit`;
`verifyAuth` + `apiError` en la ruta de persistencia; staging explícito; puertos
5005/5433/5010/5434 y el RAG intactos.

**Scale/Scope**: 2 archivos de lógica nuevos, 2 componentes nuevos, 1 ruta API **existente**
retocada (auditoría), 2 archivos de test nuevos + 1 extendido, 2 líneas de cableado de UI.

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada (D-060); plan y `/speckit-analyze` antes de implementar. |
| §0.2 Pruebas | ✅ Lógica genérica y de dominio con test propio; la ruta de persistencia extiende su test. |
| §0.3 Tipado / errores | ✅ Cero `any`; el fallo de persistencia muestra mensaje propio, nunca `err.message`. |
| §0.5 Aislamiento | ✅ Solo `001-`. Sin RAG, sin Base Oficial, sin otros productos. Sin trabajo pesado. |
| §0.7 Configurabilidad | ✅ Las columnas salen del catálogo (RZ-2). El color por `key` es **presentación con fallback**: un estado nuevo aparece igual, con acento neutro. |
| §2.5 Auditoría | ✅ El cambio de estado registra `auditLog` (hoy el PATCH no auditaba nada: se corrige). |
| §5.1 Rutas públicas | ✅ Se reutiliza `PATCH /api/licitaciones/[id]`, que ya exige `verifyAuth`. |
| §6.2 Reglas de React | ✅ Sin `setState` síncrono en `useEffect` (el fetch resuelve en callback asíncrono). |

**Sin violaciones.** Complexity Tracking vacío.

## Cambios exactos por bloque

### Bloque 1 · Lógica genérica del tablero — `src/lib/kanban.ts`

```typescript
export interface ColumnaKanban { id: string; titulo: string; acento?: string }
export interface TarjetaKanban { id: string; columnaId: string; titulo: string;
                                 referencia?: string; etiqueta?: string }
export interface ColumnaConTarjetas { columna: ColumnaKanban; tarjetas: TarjetaKanban[] }

export function agruparPorColumna(columnas, tarjetas): ColumnaConTarjetas[]
export function tarjetasHuerfanas(columnas, tarjetas): TarjetaKanban[]
export function esMovimientoReal(tarjetas, tarjetaId, columnaDestinoId): boolean
```

- `agruparPorColumna` respeta el **orden de `columnas`** (FR-003) y devuelve columna vacía,
  no la omite (US1-3).
- `tarjetasHuerfanas` resuelve US1-2: una tarjeta cuya columna no existe **no rompe** el
  tablero; queda fuera y el adaptador la reporta.
- `esMovimientoReal` es FR-009 en una función pura: `false` si la tarjeta no existe o si ya
  está en la columna destino.

Sin `any`, sin dependencias, sin dominio: el archivo no menciona oportunidad ni estado.

### Bloque 2 · Presentación genérica — `src/components/kanban/KanbanBoard.tsx`

```typescript
interface KanbanBoardProps {
  columnas: ColumnaKanban[];
  tarjetas: TarjetaKanban[];
  onMover: (tarjetaId: string, columnaDestinoId: string) => void;
  moviendoId?: string | null;   // tarjeta en vuelo: se atenúa mientras persiste
  mensajeVacio?: string;        // catálogo sin columnas (Edge Case)
}
```

- **Único import de dominio: ninguno.** Solo `@/lib/kanban` y React (SC-008).
- Arrastre nativo. Al soltar, consulta `esMovimientoReal` y **solo entonces** emite `onMover`
  (FR-009 blindado en el componente, no confiado al consumidor).
- No decide cómo persistir ni conoce rutas (FR-001, US3-2).
- Columna vacía → placeholder "Sin tarjetas". Cero columnas → `mensajeVacio`.

### Bloque 3 · Adaptador de Oportunidades

**`src/lib/tableroOportunidades.ts`** (puro, testable en `node`):

- `columnasDeEstados(estados)` → una `ColumnaKanban` por `LicitacionStatus`, en el orden que
  devuelve el catálogo, con `acento` por `key` y **fallback neutro** para claves desconocidas
  (RZ-2: añadir un estado no exige tocar código).
- `tarjetasDeOportunidades(oportunidades)` → una `TarjetaKanban` por oportunidad con título,
  número y tipo (FR-004).

**`src/components/licitaciones/TableroOportunidades.tsx`** (componente adaptador):

- Carga en paralelo `/api/licitaciones?pageSize=100` y `/api/licitaciones/estados`.
  El `pageSize` es inerte hoy y queda listo para cuando SPEC-009 pagine el listado; la
  lectura acepta **ambas formas** (arreglo o `{ items }`) para no romperse en el cambio.
- `onMover` → **optimista con rollback** (FR-008): mueve la tarjeta en el estado local,
  lanza `PATCH /api/licitaciones/[id]` con `{ estadoId }`; si falla, **restaura** el estado
  previo y muestra un mensaje propio (nunca `err.message`).
- Muestra un aviso si hay tarjetas huérfanas (US1-2), sin romper el tablero.

### Bloque 4 · Persistencia y auditoría — `PATCH /api/licitaciones/[id]`

Se **reutiliza la ruta existente** (FR-005, US2-6: no se inventa una ruta paralela que se
salte validaciones). Único cambio: **registrar auditoría cuando cambia el estado**.

```typescript
if (data.estadoId !== undefined && existente.estadoId !== nuevoEstadoId) {
  await auditLog({ action: "oportunidad.estado.cambio", entityType: "Licitacion",
                   entityId: id, userId: session.sub, status: "success",
                   message: `Estado ${existente.estadoId} → ${nuevoEstadoId}`,
                   metadata: { estadoAnterior, estadoNuevo } });
}
```

FR-007 pide usuario, oportunidad, origen, destino y momento: los cinco quedan (el momento lo
pone `auditLog` con `createdAt`). Si el estado **no** cambia, no se audita (FR-009 también en
el servidor, no solo en la UI).

### Bloque 5 · Cableado de UI

- `SUBMODULES.licitaciones` en `WorkspaceContext.tsx`: nuevo `{ id: "tablero", title: "Tablero" }`
  después de "Listado". "Estados" **se conserva** (administra el catálogo).
- `LicitacionesTab.tsx`: `case "tablero": return <TableroOportunidades />;`

### Bloque 6 · Pruebas

- `src/lib/kanban.test.ts`: orden de columnas, columna vacía no omitida, huérfanas
  detectadas, `esMovimientoReal` en los tres casos (misma columna / tarjeta inexistente /
  movimiento real).
- `src/lib/tableroOportunidades.test.ts`: una columna por estado del catálogo (SC-001),
  tarjeta en la columna de su estado (SC-002), estado nuevo sin color → acento de fallback
  (RZ-2), tarjeta sin número no rompe.
- `src/app/api/licitaciones/[id]/route.test.ts` (extendido): auditoría al cambiar de estado
  (SC-004), **sin** auditoría si el estado no cambia (SC-007), 401 sin sesión ya cubierto
  (SC-005).

## Orden de implementación (sin turno)

1. `src/lib/kanban.ts` + su test.
2. `KanbanBoard.tsx` (solo presentación).
3. `tableroOportunidades.ts` + su test.
4. `TableroOportunidades.tsx` (adaptador) + cableado de submódulo.
5. Auditoría en el PATCH + test extendido.
6. Gates: suite ≥ 282, `tsc --noEmit`, `eslint`, `build`.

## Verificación por requisito

| FR | Cómo se verifica |
|---|---|
| FR-001 / SC-008 | `KanbanBoard.tsx` solo importa `@/lib/kanban` y React (revisión de imports) |
| FR-002 | el adaptador vive en archivos aparte; el tablero no cambia entre los dos usos |
| FR-003 / SC-001 | `columnasDeEstados` deriva del catálogo y respeta su orden (test) |
| FR-004 / SC-002 | `tarjetasDeOportunidades` asigna `columnaId = estadoId` (test) |
| FR-005 / FR-006 | PATCH existente, con `verifyAuth` (test 401 ya en la suite) |
| FR-007 / SC-004 | test de auditoría en el PATCH |
| FR-008 / SC-006 | rollback en el adaptador; mensaje propio, sin `err.message` |
| FR-009 / SC-007 | `esMovimientoReal` (test) + guarda en el servidor (test) |
| FR-010 | la ruta ya tiene test y contrato `apiError`; se extiende |
| FR-011 | submódulo "Tablero" añadido; "Estados" conservado |
| FR-012 / SC-010 | `tsc` limpio; `eslint src/lib src/app/api` sin `no-explicit-any` |
| SC-011 | no se tocan puertos ajenos ni el RAG |

## Riesgos

- **R-01 · El tablero se contamina de dominio** (rompería RZ-1 y dejaría a SPEC-008 sin nada
  que reutilizar). Mitigación: la lógica genérica vive en `@/lib/kanban`, sin dominio; el
  adaptador es quien conoce oportunidades. SPEC-008 es la prueba real y llega esta misma
  noche.
- **R-02 · Optimista sin rollback deja la UI mintiendo** (FR-008). Mitigación: se guarda el
  estado previo antes de mutar y se restaura en el `catch`; el aviso de error es texto propio.
- **R-03 · Arrastre nativo con soporte desigual.** Mitigación: contrato desacoplado de la
  implementación; cambiarlo no toca a los consumidores. Cero dependencias nuevas de noche.
- **R-04 · SPEC-009 pagina `GET /api/licitaciones` y el tablero se queda con 25 tarjetas.**
  Mitigación: el adaptador ya pide `pageSize=100` y acepta ambas formas de respuesta. El
  techo de 100 queda **declarado** como límite conocido, no descubierto en producción.
- **R-05 · Dos usuarios mueven la misma tarjeta** (Edge Case). El último persistido gana y la
  auditoría registra ambos movimientos; no se añade bloqueo optimista (fuera de alcance).

## Complexity Tracking

Sin violaciones. La partición en tres capas (en vez de las dos que nombra la spec) **no añade
complejidad de diseño**: separa lo puro de lo visual dentro de la misma frontera que la spec
exige, y es lo que permite probar el tablero sin estrenar jsdom en un turno desatendido.
