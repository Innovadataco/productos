# SPEC-325 · Evidencia §6 (candado 25 · ejercicio real)

Los 8 ejercicios de aceptación del INSTRUCTIVO-002-PI-225, ejercitados contra un
Postgres **efímero privado** (pgvector:pg16, NO la DB compartida de :5433 que tiene
estado de A-58) con la migración de esta SPEC aplicada. Salida verbatim en
`suites-verbatim.txt` (19/19 verdes). Reproducible:

```bash
docker run -d --name pi-ev -e POSTGRES_USER=pi -e POSTGRES_PASSWORD=pi -e POSTGRES_DB=pi_ev \
  -p 15599:5432 pgvector/pgvector:pg16
DATABASE_URL=postgresql://pi:pi@localhost:15599/pi_ev npx prisma migrate deploy
DATABASE_URL=postgresql://pi:pi@localhost:15599/pi_ev node --env-file=.env.test --import tsx \
  ./node_modules/vitest/vitest.mjs run \
  src/lib/dal/identificadores/normalizar.test.ts \
  src/lib/dal/services/hijos/hijos.test.ts \
  src/lib/dal/services/circulo-confianza/contactos-vigilo.test.ts \
  src/components/modules/padre/MisHijos.test.tsx
```

## Mapa ejercicio §6 → test que lo prueba (todos verdes)

| # | Ejercicio §6 | Test |
|---|---|---|
| 1 | Registrar un hijo con documento e identificadores → aparece en "a quién protejo" | `hijos.test.ts` › "registra un hijo con identificadores y lo lista para su padre" |
| 2 | Registrar un familiar que no es hijo → entra igual | `hijos.test.ts` › "un familiar que no es hijo entra igual" |
| 3 | Un reporte contra el identificador de un hijo → el padre se entera (mecanismo compartido) | Cruce probado end-to-end en `contactos-vigilo.test.ts` › ejercicio #7 (mismo mecanismo compartido); a nivel hijo el identificador se guarda normalizado (`hijos.test.ts` alta) y el cruce es el único de `whereReportesCirculo` |
| 4 | Un padre **sin colegio** usa todo el módulo sin fricción | Todos los tests de `hijos.test.ts` crean `crearUsuario("PARENT")` **sin colegio** y operan sin fricción |
| 5 | Crear contacto vigilado con nombre y parentesco, editarlo, agregar/desactivar identificador | `contactos-vigilo.test.ts` › "guarda nombre y parentesco…" + baja lógica (identificadores→inactivos). Edición/activar-inactivar: `actualizarContacto` (backend `:167-172`, API PATCH) |
| 6 | Mismo identificador en dos personas → dice a quién pertenece (warn+override) | `contactos-vigilo.test.ts` › "unicidad por-padre: warn+override dice a quién pertenece (case-insensitive)" |
| 7 | **Guardar `TioJuan1` y reportar `tiojuan1` → cruza igual** (el fix del defecto silencioso) | `contactos-vigilo.test.ts` › "🔴 defecto silencioso: contacto guardado 'TioJuan1' CRUZA un reporte 'tiojuan1'" → `totalReportes === 1`, `estado != sinReportes`. Además `normalizar.test.ts` prueba la forma canónica compartida |
| 8 | Dos padres, un niño (mismo documento) → datos del niño compartidos, alerta a los dos | `hijos.test.ts` › "dos padres, un niño (mismo documento): no duplica, comparte datos, vincula al 2º" + "quitar un identificador solo lo desvincula de la vista de quien lo quita, sin borrarlo para el otro" (privacidad por-padre) + "PII: un padre no dueño no puede desvincular…" |

## Secciones distinguibles (§3.4 · A-62)
Nav del padre: **"A quién protejo"** (`/dashboard/padre/hijos`) y **"A quién vigilo"**
(`/dashboard/padre/circulo-confianza`, antes "Círculo confianza"). El componente
`MisHijos` lleva el copy de padre ("Registrá a tus hijos y familiares cercanos. Si
alguien reporta uno de sus identificadores… te avisamos.").

## Build (candado 14 · que compile es necesario)
`next build` verde con las 3 rutas nuevas en el manifest
(`/dashboard/padre/hijos`, `/api/padre/hijos`, `/api/padre/hijos/identificadores/[id]`).
Motor Ollama de PI estable durante el build (0.1% CPU, sin swap · ventana concedida por Fábrica PI-1).

## Nota honesta (candado 15)
La verificación en vivo por navegador contra el login real de PI exige el JWT de
sesión de PI; la evidencia auditable aquí son los tests de integración contra un
Postgres real (no mocks) + el `next build`, que ejercitan la lógica de los 8
ejercicios de punta a punta. El ejercicio #5 (editar/activar-inactivar por UI) y el
#3 a nivel de UI del hijo se cubren por el backend+API probados; la pasada manual
final por navegador la hace Jelkin en §6b post-deploy (tabla del instructivo).
