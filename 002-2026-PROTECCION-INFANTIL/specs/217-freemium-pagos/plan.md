# Plan de implementación: SPEC-217 — Freemium 30 días (002-PI-117)

## Resumen

Implementar activación de freemium al crear suscripción, cálculo de `freemiumFechaFin`, anti-doble freemium, extensión de vigencia al pagar durante freemium y exposición de datos al cliente.

## Contexto técnico

- Next.js + TypeScript estricto + Prisma.
- `date-fns-tz` America/Bogota.
- DAL: `PagosRepository`.
- Worker de vigencia (SPEC-213) maneja notificaciones y corte.

## Constitution Check

- ✅ Sin multimedia.
- ✅ Presunción de inocencia no aplica.
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/217-freemium-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 217-freemium.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/lib/pagos/freemium.service.ts
src/lib/pagos/freemium.service.test.ts
src/lib/dal/repositories/pagos-repository.ts     # extendido
src/app/api/pagos/suscripcion/route.ts           # endpoint cliente (modificado/extendido)
```

## Cambios de código

### 1. Servicio `freemium.service.ts`

Funciones:
- `activarFreemium(suscripcionData)`: asigna plan básico, calcula fechas, verifica histórico.
- `tieneFreemiumHistorico(identificadorTitular)`.
- `extenderVigenciaDesdeFreemium(suscripcion, pago)`.
- `diasRestantesFreemium(suscripcion)`.

### 2. Hook en creación de suscripción

En el servicio central de creación de `Suscripcion`:
- Si `pagos.freemium.activo` y no tiene histórico, llamar `activarFreemium`.

### 3. Modificación en autorización de pago

En el servicio que autoriza pagos (SPEC-212):
- Si `esFreemium=true`, llamar `extenderVigenciaDesdeFreemium`.

### 4. Endpoint de suscripción

Extender respuesta con:
- `esFreemium`, `freemiumFechaFin`, `diasRestantesFreemium`.

### 5. Tests

- Activación.
- Anti-doble.
- Extensión al pagar.
- Vencimiento (integrado con worker stub).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Plan básico no sembrado | Verificar existencia; si falta, loggear error y no activar freemium. |
| Doble freemium | Consultar histórico antes de activar. |
| Cálculo de vigencia al pagar | Centralizar en `freemium.service.ts`. |

## Criterios de aceptación técnica

- Gate local completo verde.
- Tests de integración pasan.
- `arch:check` verde.
