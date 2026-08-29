# Tasks — SPEC-114: Suite E2E por rol y 5 ciclos de estabilización

**Input**: plan.md, spec.md, research.md de `/specs/114-suite-e2e-por-rol/` + brief ZEUS v1.2 |
**Branch**: `feature/001-scaffolding` · **Sin compuerta**: implementar y correr los ciclos.

## Fase 1 — Infraestructura de la suite

- [ ] T001 `src/lib/e2e/helpers.ts`: usuarios por rol, login real (POST /api/auth/login → cookie), requests al proxy con JWT, asserts comunes (menú por rol, logo no muerto, sesión muerta).
- [ ] T002 `src/lib/e2e/seed-ciclo.ts`: seed determinista parametrizado por N de ciclo (usuarios por rol + banco de reportes con identificadores/cantidades variables por ciclo).

## Fase 2 — Journeys (cada uno cierra en BD, §9)

- [ ] T003 `journeys/sesion-roles.test.ts` (FR-1): 5 roles — entrar, home correcto, menú solo suyo, logo nunca al pathname actual, salir con sesión muerta (ruta privada → login).
- [ ] T004 `journeys/padre.test.ts` (FR-2): registro, camino de interfaz a /reportar (I-38), reportar autenticado y anónimo, Mis reportes, Círculo con varios identificadores, seguimiento, cambiar contraseña, RPT nunca en URL; §9 (texto intacto descifrado, identificador normalizado, bcrypt).
- [ ] T005 `journeys/colegio.test.ts` (FR-3): alta con contraseña temporal → cambio obligatorio → panel; cursos/carga/alumnos básicos; salida; §9 (debeCambiarPassword, hash bcrypt, cambio de hash).
- [ ] T006 `journeys/admin.test.ts` (FR-4): crear colegio y operador DE VERDAD (alta completa); bandeja/spam/estadísticas/IA/operadores/colegios/anti-abuso/dataset/configuración; §9 (bcrypt, AuditLog).
- [ ] T007 `journeys/operador-comite.test.ts` (FR-5): bandeja asignada, abrir, resolver con transición registrada y visibilidad recalculada; bandeja comité + auditoría.
- [ ] T008 `journeys/aislamiento.test.ts` (FR-6): matriz de lo que cada rol NO alcanza (403/redirect esperado).
- [ ] T009 `journeys/publico-agregacion.test.ts` (FR-7): consulta anónima vs por rol (mismo resultado), I-11 dos identificadores (pocos vs varios, render idéntico), varios reportes al mismo identificador (umbral, ratio, SPAM/OTRO no suman, D-08), dashboard público sin score/nivel (D-10/I-23), seguimiento sin PII (I-28); §9 de contadores.

## Fase 3 — Prueba lenta y aceptación

- [ ] T010 `lenta/motor-real.test.ts`: un reporte por el pipeline REAL (Ollama local), `describe.skipIf(E2E_LENTA !== "true")`, fuera del gate rápido.
- [ ] T011 Aceptación (SC-002): revertir temporalmente SOLO `SESION_ROUTES` (SPEC-113) → journeys sesión+colegio en ROJO → restaurar → verde. Documentado.

## Fase 4 — Los 5 ciclos

- [ ] T012 Ciclo 1: suite → arreglos con rojo previo (un commit c/u) → suite ENTERA verde → bitácora.
- [ ] T013 Ciclo 2: datos nuevos (seed-ciclo(2)) → ídem.
- [ ] T014 Ciclo 3: ídem (seed-ciclo(3)).
- [ ] T015 Ciclo 4: ídem (seed-ciclo(4)).
- [ ] T016 Ciclo 5: ídem (seed-ciclo(5)) + si destapa algo, ciclo 6.
- [ ] T017 Gate final completo + CI GitHub success + cierre.md + specs/README.md + commits. **NO desplegar**.

## Dependencias

- T001/T002 → T003–T009 → T010/T011 → T012–T017.
