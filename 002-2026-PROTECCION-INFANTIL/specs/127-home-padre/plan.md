# Implementation Plan: SPEC-127 — Home del padre (PARENT → /dashboard)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/127-home-padre/spec.md` (instructivo 002-PI-043, radica ZEUS; D-42, cierra I-40)

## Summary

Fix acotado: `homeForRole` (`src/lib/proxy.ts:169-173`) gana un caso explícito
`PARENT → /dashboard`. Hoy PARENT cae al default `/dashboard/admin`, que la propia puerta
le niega (`esDestinoPermitidoPorRol`, `proxy.ts:122`) y lo rebota a `/` — doble rebote en
el rol principal del producto. Cambio de una línea + test de regresión del camino PARENT +
regeneración de `03-pantallas.md`. `proxy.ts` es archivo peligroso (D-36): suite completa
+ `tsc --noEmit` + `build` obligatorios.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: ninguna nueva — `next/server` (ya usado por `proxy.ts`), Vitest (tests existentes junto al código)

**Storage**: N/A

**Testing**: Vitest — el test de regresión va junto a los tests existentes del proxy
(`src/lib/proxy.test.ts` o `src/lib/proxy-sesion-roles.test.ts`, mismo patrón: importar
`proxy()` y ejecutarla con `NextRequest` en memoria, sin BD)

**Target Platform**: Next.js middleware/proxy (edge-compatible), macOS dev + GitHub Actions

**Project Type**: fix de redirección en la puerta de acceso

**Performance Goals**: N/A (una rama más en una función de mapeo)

**Constraints**: `proxy.ts` SOLO se toca en `homeForRole` (candado con excepción acotada,
D-42); no se alteran veredictos de la puerta, solo el destino de una redirección existente;
determinismo de `arch:check` (artefactos regenerados en el mismo commit)

**Scale/Scope**: 1 función, ~2 líneas de código + 1 test de regresión + 1 artefacto regenerado

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Solo texto / sin multimedia**: OK — no toca superficie de contenido.
- **Presunción de inocencia**: OK — no toca lenguaje ni consulta pública.
- **IA local**: OK — sin IA.
- **Canales oficiales**: OK — no toca UI de reporte.
- **Disputas (Ley 1581)**: OK — no toca el flujo de disputa.
- **TypeScript estricto / sin `any`**: OK — el cambio es un literal de string tipado por inferencia.
- **Migraciones aditivas / no destructivo**: OK — no toca schema ni datos.
- **Metodología Spec-Kit**: OK — spec + plan; compuerta §4 respetada (PARA antes de tasks/implement).
- **Archivo peligroso (D-36)**: OK — la spec prevé suite completa + tsc + build + test de
  regresión del camino afectado, como exige la decisión.

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/127-home-padre/
├── plan.md              # This file
├── research.md          # Phase 0 output (defecto verificado en fuente; alternativas)
├── quickstart.md        # Phase 1 output (verificación de los 5 criterios del instructivo)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/
│   ├── proxy.ts                 # TOCAR SOLO homeForRole (líneas 169-173): + caso PARENT
│   └── proxy.test.ts            # + test de regresión del camino PARENT (o proxy-sesion-roles.test.ts)
├── docs/architecture/
│   └── 03-pantallas.md          # REGENERADO (home-por-rol + grafo) — nunca editado a mano
└── scripts/arch/                # SE USA, no se toca (generadores existentes)
```

**Structure Decision**: el test vive junto a los tests existentes del proxy (patrón del
repo: tests junto al código). Se reutilizan los helpers de sesión canónica si los tests
actuales los tienen; si no, se construye el `NextRequest` con cookie JWT de sesión PARENT
siguiendo el patrón de `proxy-sesion-roles.test.ts`.

## Diseño (Phase 1)

### Cambio en `homeForRole`

```typescript
function homeForRole(rol: string) {
    if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    if (rol === "SCHOOL_ADMIN") return "/dashboard/colegio";
    if (rol === "PARENT") return "/dashboard";        // ← única línea añadida (I-40/D-42)
    return "/dashboard/admin";
}
```

- El default queda intacto: ADMIN y OPERADOR (roles internos) siguen yendo a
  `/dashboard/admin`, que la puerta SÍ les permite.
- `/dashboard` es ruta de usuario final (`USER_FINAL_ROUTES`): para PARENT la puerta
  devuelve `next()` → aterriza sin rebote. Los roles internos redirigidos a `/dashboard`
  no existen como caso (internos van a su propio home).
- Comentario en el código citando I-40/D-42, en el estilo de los comentarios existentes
  del archivo (referencias a SPEC/D/I).

### Test de regresión (D-36)

En `src/lib/proxy.test.ts` (o el archivo de tests del proxy que ya construya sesiones):

1. Sesión PARENT contra una ruta admin-only (p. ej. `/dashboard/admin/comite/gestion`) →
   la respuesta es redirect con `Location` terminando en `/dashboard` (no `/dashboard/admin`).
2. Sesión PARENT contra `/dashboard` → `NextResponse.next()` (sin redirect): el destino
   del paso 1 es alcanzable — la cadena cierra sin segundo rebote.
3. Tabla de homes por rol: COMITE → `/dashboard/admin/comite`, SCHOOL_ADMIN →
   `/dashboard/colegio`, PARENT → `/dashboard`, ADMIN/OPERADOR → `/dashboard/admin`
   (guarda contra recaídas del default).

### Regeneración de la línea base

`npx tsx scripts/arch/generar-pantallas.ts` (o el orquestador de `arch:check`) regenera
`docs/architecture/03-pantallas.md`: la tabla home-por-rol gana la fila PARENT → `/dashboard`
y el grafo de transiciones lo refleja. `02-roles-capacidades.md` NO cambia (ningún veredicto
de la puerta se altera — la Aserción A compara permitir/bloquear, no destinos). Verificación:
`npm run arch:check` VERDE en el mismo commit.

### Gate D-36 (archivo peligroso)

Antes de commit: `npm run test` (suite completa, incluidos `proxy.test.ts`,
`proxy-sesion-roles.test.ts` y `src/lib/e2e/journeys/aislamiento.test.ts`) +
`npx tsc --noEmit` + `npm run build` + `npm run arch:check`, todo verde.

## Research resumido (Phase 0 → research.md)

Decisión: caso explícito en `homeForRole` (la única opción que cumple "NADA MÁS" de D-42).
Alternativas descartadas: reordenar el default (rompe ADMIN/OPERADOR o los esconde);
redirigir PARENT a `/` (es el comportamiento roto actual); abrir `/dashboard/admin` para
PARENT (fuga de seguridad, descartada de plano). Detalle en [research.md](research.md).

## Quickstart (validación) → [quickstart.md](quickstart.md)

Los criterios 1, 2 y 4 del instructivo 002-PI-043 que aplican a esta spec se verifican ahí
paso a paso (test de regresión, suite+tsc+build, arch:check con artefacto regenerado,
aserciones A/B verdes).

## Data Model

N/A — no cambia schema ni entidades; es lógica de redirección en `homeForRole`.

## Contracts

N/A — no expone endpoints ni interfaces nuevas; la "interfaz" es el destino de una
redirección, cubierto por el test de regresión.

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación. Una rama explícita en una
función de mapeo, un test y un artefacto regenerado.

## Complexity Tracking

Sin violaciones de constitución que justificar.
