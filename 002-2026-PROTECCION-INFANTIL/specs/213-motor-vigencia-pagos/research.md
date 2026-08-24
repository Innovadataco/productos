# Research — SPEC-213

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso en esta SPEC |
|---|---|---|
| `worker-reportes.mjs` | `scripts/worker-reportes.mjs` | Patrón de advisory lock y estructura de worker. |
| `PagosRepository` | `src/lib/dal/repositories/pagos-repository.ts` (SPEC-210) | CRUD de suscripciones y transiciones. |
| `motor.programar()` | `src/lib/notificaciones/motor.ts` (SPEC-201) | Programar eventos de notificación. |
| `date-fns-tz` | dependencia aprobada (D-69) | Aritmética de fechas en Bogotá. |
| `AuditLog` helpers | existentes | Registro de transiciones. |
| `ParametroSistema` helpers | existentes | Lectura/escritura de parámetros. |

## APIs externas

Ninguna. Las notificaciones salen por Motor de Notificaciones interno.

## Riesgos técnicos

1. **Motor notif no mergeado**: si SPEC-201 no está en la rama, `motor.programar()` no existe. Mitigación: documentar dependencia; en implementación se puede hacer stub que loguee eventos pendientes.
2. **Catálogo de eventos incompleto**: si falta alguna de las 18 reglas/plantillas, el worker no puede programar. Mitigación: script de verificación al arranque.
3. **Timezone**: si el contenedor no tiene `TZ=America/Bogota`, las comparaciones cerca de medianoche fallan. Mitigación: forzar `TZ` en docker-compose y usar `date-fns-tz`.
4. **Idempotencia sin tabla de control**: usar `ParametroSistema` es simple pero no permite historial. Mitigación: suficiente para v1; considerar tabla `CorridaVigencia` en v2.

## Dependencias rotas identificadas

- **SPEC-201 (Motor Notificaciones)**: es bloqueante para la emisión de eventos. Si no está mergeado, se debe dejar stub documentado.
- **SPEC-INFRA-TIMEZONE**: si `date-fns-tz` no está instalado o contenedores no tienen `TZ`, esta SPEC no puede funcionar correctamente.
