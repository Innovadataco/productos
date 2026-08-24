# Checklist de requisitos — SPEC-233

## Completitud de la spec

- [x] User Stories con Priority y Acceptance Scenarios (Given/When/Then).
- [x] Edge Cases documentados.
- [x] Functional Requirements numerados (FR-001 a FR-018).
- [x] Non-Functional Requirements (NFR-001 a NFR-005).
- [x] Success Criteria medibles (SC-001 a SC-007).
- [x] Assumptions explícitas.
- [x] Decisiones propuestas / Deuda.
- [x] Sin `[NEEDS CLARIFICATION]` abiertos; desviaciones acotadas documentadas en "Decisiones propuestas".

## Cumplimiento de restricciones

- [x] No toca `src/lib/ai/**` ni rate-limit del reporte público.
- [x] No modifica schema Prisma ni crea migraciones (data-model: cero cambios).
- [x] No usa `@/lib/prisma` en páginas ni componentes (todo vía DAL).
- [x] Ley 1581: vista admin solo agregado anónimo + select anonimizado sin `padreUsuarioId` ni textos.
- [x] Presunción de inocencia: lenguaje descriptivo/estadístico, sin veredictos ni etiquetas de riesgo.
- [x] Solo texto: no se introduce multimedia en ninguna forma.
- [x] Color `cielo` (padre) / `ambar` (admin), vidrio heredado, radios 16/12/22.
- [x] Terminología en criollo (§3 del brief), sin códigos técnicos en UI, tono neutral sin voseo.
- [x] Campos nulos → "—" o motivo explícito.
- [x] Timezone Bogotá (D-69) con `date-fns-tz`.
- [x] Constelación N7 fuera de alcance v1 (§16 del brief).

## Coordinación

- [x] Usa sidebar/layout padre de SPEC-231 sin tocarlo.
- [x] Ancla entrada padre en `ExpedienteDetalleClient` de SPEC-232 (edición mínima).
- [x] Reutiliza `obtenerSenalComunitaria` de SPEC-234 (fuente única del agregado).
- [x] No toca `/dashboard/padre/suscripcion` (SPEC-211) ni `AdminNav` ni `src/lib/proxy.ts`.
- [x] Sin colisión con SPEC-237 (bandeja comité): solo crea rutas `identificador/` nuevas.
