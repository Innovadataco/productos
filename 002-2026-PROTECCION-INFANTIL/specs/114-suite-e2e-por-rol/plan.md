# Implementation Plan: SPEC-114 — Suite E2E por rol y estabilización por ciclos

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)
**Brief de diseño (manda)**: `BRIEF-SPEC-114-SUITE-E2E-POR-ROL.md` (ZEUS, v1.2)

## Summary

Suite de recorridos completos por rol (no piezas) ejecutada sobre la infraestructura de
tests existente (Vitest + BD de test compartida), combinando: proxy real con JWT por rol,
handlers de rutas llamados como en los tests de API existentes, render de componentes del
header/menú por rol, y verificación final en BD (§9). Clasificación simulada en los
recorridos (misma técnica de mocks que los tests del pipeline) y UNA prueba lenta con el
motor real, marcada y fuera del gate rápido. Ejecución en 5 ciclos con datos nuevos por
ciclo, arreglos con rojo previo y un commit por arreglo, bitácora en
`docs/ciclos-estabilizacion-114.md`.

## Diseño

### Estructura de la suite

```text
src/lib/e2e/
├── helpers.ts              # usuarios por rol, login real, requests al proxy, asserts comunes
├── seed-ciclo.ts           # datos deterministas POR CICLO (sufijo de ciclo: datos nuevos)
├── journeys/
│   ├── sesion-roles.test.ts        # FR-1: los 5 roles, camino completo de sesión
│   ├── padre.test.ts               # FR-2 (incl. camino a /reportar desde la interfaz — I-38)
│   ├── colegio.test.ts             # FR-3 (alta obligatoria completa — I-35)
│   ├── admin.test.ts               # FR-4 (crear colegio y operador DE VERDAD)
│   ├── operador-comite.test.ts     # FR-5 (resolver con transición + visibilidad)
│   ├── aislamiento.test.ts         # FR-6 (403 correcto = esperado)
│   ├── publico-agregacion.test.ts  # FR-7 (I-11 dos identificadores, umbral, D-08/D-10/I-23/I-28)
│   └── bd-§9 cubierta dentro de cada journey (FR-8)
└── lenta/
    └── motor-real.test.ts          # 1 prueba con motor real: describe.skipIf(E2E_LENTA!=="true")
```

### Decisiones

- **Proxy REAL con JWT por rol** (`crearTokenUsuario` + `proxy(NextRequest)`): prueba el
  CAMINO (el proxy es donde se rompieron I-35/I-36/I-38), no solo los endpoints.
- **Componentes por rol** (`NavHeader`, `ColegioNav` renderizados): menú filtrado y logo
  (logo nunca apunta al pathname actual — regla I-38 verificada por propiedad).
- **Handlers llamados directos** (patrón de tests existente) para login, reportes,
  colegios, operadores, operador/comité y agregación; mocks de clasificador/rúbrica/
  embedder/PII/email como en `procesar/route.test.ts`.
- **Seed por ciclo** (`seed-ciclo.ts`): usuarios por rol + banco de reportes deterministas
  parametrizado por N de ciclo (identificadores, textos y cantidades VARÍAN cada ciclo →
  "datos nuevos").
- **§9 dentro de cada journey**: después del camino, asserts de BD (texto intacto
  descifrado, identificador normalizado, votos, contadores, bcrypt, AuditLog, transiciones).
- **Prueba lenta**: `describe.skipIf(process.env.E2E_LENTA !== "true")` — un reporte real
  por el pipeline con Ollama local (~60 s), fuera del gate rápido pero en el repo.
- **CI**: la suite vive en `src/` → corre dentro de `npm run test` (ya es compuerta).
- **Aceptación (SC-002)**: revertir SOLO la línea de `SESION_ROUTES` de la SPEC-113 en un
  stash temporal, correr `sesion-roles` y `colegio` (deben ir en ROJO), restaurar, verde.

### Ciclo operativo (por ciclo N = 1..5)

1. `seed-ciclo(N)` → `npm run test -- src/lib/e2e` (rápida, motor simulado).
2. Rojo → primero el test que falla, después el arreglo (un commit citando ciclo/recorrido).
3. Suite ENTERA (`npm run test`) verde.
4. Bitácora: tabla del ciclo (recorridos, rojos con causa, arreglos con commit, deudas ZEUS,
   tiempo).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Suite lenta deja de correrse | Motor simulado en recorridos; lenta aparte y opt-in |
| Mocks del pipeline divergen del real | La prueba lenta con motor real cubre el camino completo una vez por ejecución |
| Arreglos que son arquitectura disfrazada | Frontera del brief: defecto evidente (arreglo) vs decisión (bitácora para ZEUS) |

## Project Structure

Documentación: esta carpeta (spec/plan/research/quickstart/tasks + cierre al final).
Código: `src/lib/e2e/**` descrito arriba. Bitácora: `docs/ciclos-estabilizacion-114.md`.
