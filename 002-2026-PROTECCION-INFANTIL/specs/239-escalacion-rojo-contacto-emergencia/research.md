# Research: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

**Date**: 2026-08-22
**Feature**: specs/239-escalacion-rojo-contacto-emergencia/spec.md

---

## Decisions

### D1: Modelo propio `ContactoEmergencia` (no reutilizar `AcudienteEstudiante`)

**Decision**: Crear una tabla específica `ContactoEmergencia` vinculada al `Usuario` padre, en lugar de reutilizar `AcudienteEstudiante`.

**Rationale**:
- `AcudienteEstudiante` está acotado a un `estudianteId` y pertenece al módulo de colegios; el contacto de emergencia del padre es una lista transversal al padre, no al estudiante.
- El flujo de emergencia opera en el contexto del expediente/padre, no del curso/colegio.
- Se requiere un campo `prioridad` explícito (1..3) y un enum de relación controlado que `AcudienteEstudiante` no tiene.

### D2: Validación E.164 para teléfonos

**Decision**: Validar `telefono` en formato E.164 (`+` seguido de dígitos) en API y Zod.

**Rationale**:
- Requisito explícito del instructivo (candado E.164).
- El mismo patrón se usa para reportes y acudientes en el proyecto.
- Garantiza que el canal SMS del Motor Notif reciba un número normalizable.

### D3: Baja lógica (`activo`) en lugar de eliminación física

**Decision**: Los contactos se desactivan (`activo: false`) en vez de borrarse físicamente.

**Rationale**:
- Conserva trazabilidad si un contacto fue usado en una activación de emergencia previa.
- Permite al padre recuperar un contacto sin recrearlo.
- Reduce riesgo de borrado accidental de un receptor crítico.

### D4: Fallback de contactos por prioridad ascendente

**Decision**: Si el contacto de prioridad 1 no está activo, se intenta 2 y luego 3.

**Rationale**:
- Máxima probabilidad de alcanzar a un acudiente sin saturar a toda la lista.
- Se audita `CONTACTO_EMERGENCIA_FALLBACK_USADO` para transparencia.
- Notificar a todos los contactos simultáneamente se descarta para evitar alarma excesiva en esta fase.

### D5: Cálculo de SLA en zona horaria `America/Bogota`

**Decision**: Las comparaciones de vencimiento de 12h se hacen en zona horaria `America/Bogota`, aunque los timestamps se almacenen en UTC.

**Rationale**:
- El producto opera en Colombia; el compromiso de 12h debe interpretarse en horario local.
- Prisma/PostgreSQL soportan conversiones de zona sin complejidad (`AT TIME ZONE`).

### D6: Extender worker existente en lugar de crear uno nuevo

**Decision**: El chequeo de SLA vencido vive en el worker `pi-expediente-motor` entregado por SPEC-236/D-72.

**Rationale**:
- El instructivo prohíbe crear un worker nuevo.
- El worker de expedientes ya itera sobre el conjunto de expedientes; añadir el filtro ROJO+12h es natural.
- Reduce sobrecarga operativa (menos procesos, menos locks).

### D7: Motor Notif solo por catálogo/plantillas

**Decision**: Esta spec añade eventos y plantillas al catálogo del Motor Notif sin modificar su código.

**Rationale**:
- El instructivo prohíbe modificar el Motor Notif.
- El Motor Notif se diseñó como extensible por catálogo (patrón asumido de SPEC-236).
- Mantiene el límite de responsabilidades: SPEC-239 define qué decir, el motor define cómo enviarlo.

### D8: Botón ruby con modal de confirmación

**Decision**: Reutilizar el componente crítico existente del sistema de diseño, cambiando solo color a ruby y el texto.

**Rationale**:
- Consistencia visual con otras acciones destructivas/de alto impacto.
- El modal reduce errores accidentales en una acción que notifica a terceros.
- No se inventa un nuevo patrón de UI.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Reutilizar `AcudienteEstudiante` como contactos de emergencia | Acotado a estudiante y colegio; no tiene prioridad ni relación controlada |
| Notificar a todos los contactos activos a la vez | Genera alarma múltiple; se prefiere fallback ordenado en esta fase |
| Eliminar físicamente contactos | Pierde trazabilidad de activaciones históricas |
| Crear worker separado para SLA | Prohibido por instructivo (D-72); además sería overkill |
| Llamada telefónica real (call center) | Fuera de scope; reservado para "call center v2" |
| Escalamiento automático a autoridades | Fuera de scope; reservado para "authority external escalation v2" |
| Historial de emergencias | Fuera de scope; reservado para "emergency history v2" |
| UI padre para contactos en esta spec | Reservado para SPEC-232 |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. Los contratos con SPEC-236 (Motor de Estados, worker, Motor Notif) se asumen estables; cualquier cambio en esos contratos requiere reabrir la compuerta §4 de esta spec.
