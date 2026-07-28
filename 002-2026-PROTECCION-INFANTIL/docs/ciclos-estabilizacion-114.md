# SPEC-114 · Bitácora de ciclos de estabilización

Suite E2E por rol (`src/lib/e2e/`). Cada ciclo: seed con datos NUEVOS → suite completa →
rojos se arreglan (rojo primero, un commit por arreglo) → suite entera en verde → siguiente.
Prueba lenta con motor real: opt-in (`E2E_LENTA=true`), fuera del gate rápido.

## Ciclo 1

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| sesión 5 roles | Logo clic muerto: SPEC-106 dejaba logo=home del rol estando ya EN el home | `NavHeader.tsx`: si el destino es la ruta actual, logo → `/` (f80d7240) | — |
| padre | I-38: el área del padre no tenía camino de interfaz a `/reportar` | `DashboardUsuarioClient.tsx`: enlace "Reportar un riesgo" (9e052874) | — |
| aislamiento | `esDestinoPermitidoPorRol` clasificaba `/dashboard/admin` como ruta de usuario final (startsWith) y contradecía al proxy | `proxy.ts`: mismo orden de evaluación que proxyCore (224eae5a) | — |
| todos | — | suite + journeys: T001–T009 (varios commits, último edbace7e) | — |

- **Aceptación (T011)**: con `SESION_ROUTES` de SPEC-113 revertida (sin `/api/auth/cambiar-password`
  ni `/api/auth/logout`), la suite va en ROJO en 3 tests: colegio (alta/cambio obligatorio y
  cursos/logout) y sesión SCHOOL_ADMIN (logout). Demostrado, no afirmado. Restaurada → verde.
  Nota: el recorrido padre NO se ve afectado por esa reversión porque `/api/auth/*` es ruta
  pública en el proxy para PARENT; la trampa I-35 era exclusiva del colegio.
- Tiempo suite e2e (rápida): ~25 s.

## Ciclo 2

(pendiente)

## Ciclo 3

(pendiente)

## Ciclo 4

(pendiente)

## Ciclo 5

(pendiente)
