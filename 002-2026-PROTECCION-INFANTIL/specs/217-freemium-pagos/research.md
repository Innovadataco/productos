# Research — SPEC-217

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso |
|---|---|---|
| `PagosRepository` | SPEC-210 | CRUD de suscripciones. |
| `date-fns-tz` | D-69 | Cálculo de fechas Bogotá. |
| `motor.programar()` | SPEC-201 | Eventos freemium (vía SPEC-213). |
| `vigencia.service.ts` | SPEC-213 | Transiciones y notificaciones. |

## APIs externas

Ninguna.

## Riesgos técnicos

1. **Plan básico no existe**: si no hay plan `MES_1` para el rol/año, el freemium no puede activarse.
2. **Hook de creación de suscripción**: múltiples SPECs (215, 217, 211) modifican este flujo; coordinar para no duplicar.
3. **Extensión de vigencia**: debe alinearse con el cálculo de SPEC-212 al autorizar pagos.

## Dependencias rotas identificadas

- **SPEC-213**: sin worker de vigencia, el freemium vencido no corta automáticamente.
- **SPEC-215**: la generación de código referido y el freemium comparten el hook de creación de suscripción.
