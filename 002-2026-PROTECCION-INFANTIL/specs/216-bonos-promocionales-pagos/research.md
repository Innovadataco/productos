# Research — SPEC-216

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso en esta SPEC |
|---|---|---|
| `PagosRepository` | `src/lib/dal/repositories/pagos-repository.ts` (SPEC-210) | Lectura/escritura de bonos y aplicaciones. |
| `verifyAuth` | `src/lib/auth.ts` | Autenticación del endpoint. |
| `AppError` + códigos canónicos | `src/lib/errors.ts` | Manejo de rechazos de negocio. |
| `AuditLog` | `prisma/schema.prisma` + helpers existentes | Trazabilidad de aplicaciones. |
| `motor.programar()` | `src/lib/notificaciones/motor.ts` (SPEC-201) | Emitir `bono.aplicado` (opt-out). |
| `date-fns-tz` | dependencia ya aprobada (D-69) | Aritmética de vigencia en Bogotá. |

## APIs externas

Ninguna. El cálculo de descuento es local.

## Riesgos técnicos

1. **Dependencia de SPEC-212**: el CRUD admin del bono no está en esta rama. Mitigación: el endpoint solo lee `BonoPromocional` por `nombre`; no requiere la UI admin.
2. **Dependencia del Motor de Notificaciones**: si la regla `bono.aplicado` no está sembrada, el evento no se puede programar. Mitigación: verificar en seed de SPEC-213/217 o documentar stub.
3. **Combinabilidad con referidos**: la lógica debe alinearse con SPEC-215. Mitigación: crear `pagos-calculos.service.ts` compartido.
4. **Monto negativo**: edge case en bonos de monto fijo mayor al base. Mitigación: `Math.max(0, ...)` y test explícito.

## Decisiones pendientes de compuerta §4

- ¿El bono se pre-aplica sin pago (como aquí se propone) o solo al crear `Pago`?  
  Propuesta: pre-aplicación permitida para mejor UX en el formulario de renovación.
