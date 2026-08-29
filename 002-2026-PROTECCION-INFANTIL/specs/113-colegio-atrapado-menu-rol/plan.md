# Implementation Plan: SPEC-113 — El colegio atrapado (I-35/I-35b) y menú por rol (I-36)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/113-colegio-atrapado-menu-rol/spec.md`

## Summary

El proxy permite la pantalla `/cambiar-password` a SCHOOL_ADMIN pero no su endpoint
(`SESION_ROUTES = ["/api/me", "/cambiar-password"]` — se añadió la página y se olvidó la
API, como advertía el propio comentario C-9): el alta obligatoria queda en bucle de 403 y
BLOQUEA EL PILOTO. El mismo hueco afecta a `/api/auth/logout` (I-35b: "Cerrar sesión" no
saca de la pantalla). Fix: ampliar `SESION_ROUTES` con `/api/auth/cambiar-password` y
`/api/auth/logout`, con test rojo→verde obligatorio. I-36: el menú del header filtra por
rol reutilizando el MISMO criterio de rutas del proxy (una sola fuente de verdad).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: `src/lib/proxy.ts` (`esRutaPermitidaSchoolAdmin`,
`SESION_ROUTES`), `src/components/modules/NavHeader.tsx`, `AuthContext` (logout),
`src/app/cambiar-password/page.tsx`

**Storage**: PostgreSQL (test DB compartida)

**Testing**: Vitest (`src/lib/proxy.test.ts`, `src/app/api/auth/cambiar-password/route.test.ts`
existente, test nuevo de menú por rol)

**Constraints**: una sola fuente de verdad de permisos (la del proxy); I-37 y "En proceso"
fuera de alcance; NO desplegar.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-28).*

- **Acceso por rol y denegar por defecto**: el fix abre SOLO los endpoints de sesión que el
  propio flujo exige (cambio obligatorio y logout), manteniendo el aislamiento del colegio
  en todo lo demás. CUMPLE.
- **Tono neutral**: el menú por rol evita ofrecer caminos rotos; sin cambios de texto de
  dominio. CUMPLE.

Sin violaciones que justificar.

## Diseño

### 1. I-35 (🔴): el endpoint que la pantalla llama (FR-001/FR-003)

- `src/lib/proxy.ts`: `SESION_ROUTES = ["/api/me", "/cambiar-password",
  "/api/auth/cambiar-password", "/api/auth/logout"]` (las dos últimas entran por esta spec;
  el comentario se actualiza: página Y endpoints).
- **Test obligatorio rojo→verde**: con SCHOOL_ADMIN + `debeCambiarPassword=true`, POST a
  `/api/auth/cambiar-password` → 200 y la contraseña nueva entra en el siguiente login.
  Se ejecuta PRIMERO contra el código actual (debe fallar con el 403 del proxy en la ruta
  del test) y se reporta el rojo; luego el fix lo pone verde. El test vive junto al
  endpoint (`src/app/api/auth/cambiar-password/route.test.ts`) o en proxy.test.ts según el
  patrón existente; además `esRutaPermitidaSchoolAdmin("/api/auth/cambiar-password")` y
  `("/api/auth/logout")` → true en `proxy.test.ts`.

### 2. I-35b: salir de la pantalla (FR-002)

- `/api/auth/logout` queda cubierto por `SESION_ROUTES` (hoy SCHOOL_ADMIN recibe 403 al
  llamarlo y la cookie sobrevive — esa es la causa de que la pantalla no suelte).
- Defensa de UI: `AuthContext.logout()` (o el handler del header) navega al inicio público
  INCLUSO si la llamada a la API falla (la salida no depende del resultado de la API).

### 3. I-36 (🟡): menú por rol con la fuente del proxy (FR-004)

- Extraer de `proxy.ts` el criterio de rutas por rol a un helper exportado y reutilizable
  (p.ej. `rutasPermitidasPorRol(rol)` o exponer los conjuntos `COLEGIO_ROUTES`,
  `USER_FINAL_ROUTES`), que el proxy sigue usando igual (cero cambio de comportamiento).
- `NavHeader.tsx`: las entradas "Mi panel", "Círculo de Confianza", "Mis reportes" se
  muestran SOLO si el rol tiene permitida la ruta destino según ese helper (SCHOOL_ADMIN →
  no las ve; PARENT → las ve; roles internos → su área).
- Test: por rol, el menú ofrece exactamente lo permitido (SCHOOL_ADMIN sin entradas de
  padres; PARENT con las suyas; sin cambios para anónimo).

### 4. Verificación de otros roles (FR-005)

- Documentar por escrito en el cierre: PARENT y roles internos (ADMIN/OPERADOR/COMITE)
  llegan a `/api/auth/cambiar-password` y `/api/auth/logout` por el flujo por defecto del
  proxy (sin rama restrictiva como la de SCHOOL_ADMIN); si aparece un bloque, se corrige
  con el mismo criterio.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Abrir de más en el proxy | Solo los dos endpoints de sesión, por ruta exacta/prefijo como hoy; el aislamiento del colegio sigue |
| Segunda fuente de verdad en el menú | El helper se exporta desde `proxy.ts` y el proxy lo usa; no se duplica lógica |
| Romper el flujo comité (C-9 original) | Los tests existentes de proxy y auth corren en el gate completo |

## Project Structure

### Documentation (this feature)

```text
specs/113-colegio-atrapado-menu-rol/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (causa raíz + revisión de roles)
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
src/lib/proxy.ts                                   # SESION_ROUTES + helper por rol exportado
src/lib/proxy.test.ts                              # rutas de sesión por rol
src/app/api/auth/cambiar-password/route.test.ts    # ROJO→VERDE con SCHOOL_ADMIN (FR-003)
src/components/modules/NavHeader.tsx               # menú filtrado por rol (misma fuente)
src/components/modules/NavHeader.test.tsx          # menú por rol (FR-004)
src/lib/contexts/AuthContext.tsx                   # logout navega aunque falle la API (FR-002)
```

**Structure Decision**: proyecto único Next.js; cambios mínimos en proxy/header/auth. Sin
contratos nuevos (no aplica `contracts/`).
