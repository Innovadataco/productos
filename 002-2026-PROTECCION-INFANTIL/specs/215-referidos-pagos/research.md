# Research — SPEC-215

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso |
|---|---|---|
| `PagosRepository` | SPEC-210 | CRUD de referidos. |
| `motor.programar()` | SPEC-201 | Eventos `referido.*`. |
| `date-fns-tz` | D-69 | Año calendario Bogotá. |
| `verifyAuth` | `src/lib/auth.ts` | Endpoint. |
| `AppError` | `src/lib/errors.ts` | Conflictos. |

## APIs externas

Ninguna.

## Riesgos técnicos

1. **Hook en creación de suscripción**: necesitamos saber dónde se crean suscripciones (registro, admin). El generador debe estar en el servicio central de creación.
2. **Anti-autorreferido**: el referido puede no tener documento aún. Se usa email como mínimo; si ambos están vacíos, se rechaza.
3. **Evento `pago.autorizado`**: SPEC-213 lo emite; esta SPEC debe suscribirse. Si no está mergeado, se deja hook listo.

## Dependencias rotas identificadas

- **SPEC-213**: si no hay evento `pago.autorizado`, la recompensa no se dispara automáticamente.
- **SPEC-201**: si faltan reglas `referido.*`, los eventos no se envían.
