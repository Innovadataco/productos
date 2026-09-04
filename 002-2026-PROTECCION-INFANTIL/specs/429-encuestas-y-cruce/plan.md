# SPEC-429 · Plan

## Fases

1. **Modelo Prisma** — retirar `EncuestaPrimeraCita`, agregar `EncuestaCita`, `IncidenteContradiccionEncuesta`, `Usuario.encuestaPendiente`, dos `AccionAudit`.
2. **Repositorios (Q-3)** — `EncuestaCitaRepository` + `IncidenteContradiccionEncuestaRepository`. Todo el acceso a Prisma pasa por acá.
3. **`al-cumplir.ts`** — contrato de unión con SPEC-427.
4. **`encuestas.service.ts`** — validar, persistir, cruzar r1/r2, recalcular guardia.
5. **Guardia** — `GUARDIAS_ACCESO.encuesta` + helper `esExentaEncuesta` + bloque en middleware.ts.
6. **Cookie firmada** — `SesionEstadoPayload.encuestaPendiente` (opcional) + build.
7. **Endpoint** — `GET`/`POST /api/encuesta` (verifyAuth sin restringir rol; el service filtra).
8. **Pantallas** — `/encuesta` (RSC) + `EncuestaFormulario` (client) + `EncuestaProfesionalPendiente` (client, montaje de una línea en panel).
9. **Tests desde el primer commit** — 3 escenarios de cruce (coherente/P1/P2), guardia sube/baja, doble respuesta 409, lado incorrecto 403, cita no CUMPLIDA 400, cruce idempotente. Suite completa 11/11.
10. **`arch:check` + `tokens:check` + lint** — regenerar los 3 artefactos (modelo, roles-capacidades, pantallas).

## Reutilización

- `logAudit` con `usuarioId` del padre para la contradicción (actor = sistema).
- `UsuarioRepository.findEncuestaPendiente` (nuevo, patrón `findDebeCambiarPassword`).
- Helpers `matcheaRuta`/`esRutaPublica` + invariante cruzada de `guardias.ts`.
- `EncuestaFormulario` es único (padre y profesional lo comparten con distintas preguntas).

## Riesgos y candados

- **RIESGO I-236**: la guardia cae abierta sin cookie firmada. Se agrega con MISMO estilo que `debeCambiarPassword`, así SPEC-400b cierra ambas juntas.
- **Sumar valor al enum `AccionAudit`** — `ALTER TYPE ADD VALUE IF NOT EXISTS`, fuera del bloque transaccional (lección I-277).
- **Estado `NO_ASISTIO_PADRE`** — SPEC-427 lo escribe; acá SOLO se lee en el cruce (regla dura del CEO 23:5x).
- **Q-3** — nada de `@/lib/prisma` fuera del DAL. Los repos absorben las llamadas.
