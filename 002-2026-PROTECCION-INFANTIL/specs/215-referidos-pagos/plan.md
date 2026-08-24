# Plan de implementación: SPEC-215 — Código de referido (002-PI-115)

## Resumen

Implementar generación automática de códigos de referido, endpoint de aplicación, validaciones de integridad, tope anual y recompensas automáticas al autorizar el pago del referido.

## Contexto técnico

- Next.js App Router + TypeScript estricto + Prisma.
- `date-fns-tz` para año calendario Bogotá.
- Motor notif para eventos.
- DAL: `PagosRepository`.

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
specs/215-referidos-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 215-referidos.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/lib/pagos/referido.service.ts
src/lib/pagos/referido.service.test.ts
src/app/api/pagos/aplicar-referido/route.ts
src/app/api/pagos/aplicar-referido/route.test.ts
src/lib/dal/repositories/pagos-repository.ts     # extendido
src/lib/utils/referido-codigo.ts                 # generador de código
```

## Cambios de código

### 1. Generador de código

Crear `src/lib/utils/referido-codigo.ts`:
- `generarCodigoReferido(tipoTitular)` → `PI-<TIPO>-<HASH8>`.
- Excluir `O`, `0`, `I`, `1`.
- Verificar unicidad contra `Suscripcion.codigoReferidoPropio`.

### 2. Hook de creación de suscripción

En el servicio que crea `Suscripcion` (SPEC-210/211/217), generar código antes del insert.

### 3. Servicio `referido.service.ts`

Funciones:
- `aplicarCodigo({ codigo, suscripcionId, emailReferido, documentoReferido })`.
- `validarCodigo(...)`.
- `contarReferidosExitososPorAnio(referidorId, anio)`.
- `otorgarRecompensa(usoId, pagoId)` (llamado desde handler de `pago.autorizado`).

### 4. Endpoint `POST /api/pagos/aplicar-referido`

Autenticado, valida input Zod, delega a servicio.

### 5. Hook en `pago.autorizado`

Al cambiar `Pago.estado` a `AUTORIZADO`, si existe `CodigoReferidoUso` no activado para esa suscripción, disparar `otorgarRecompensa`.

### 6. Tests

- Generación de código y unicidad.
- Aplicación válida/inválida.
- Autorreferido.
- Tope anual.
- Recompensa al autorizar.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Colisiones de código hash | Reintentar con nuevo hash; probabilidad muy baja con 8 chars y excluyendo ambiguos. |
| Evento `pago.autorizado` no existe aún | Depender de SPEC-213; en implementación coordinar merge. |
| Recompensa referidor vs vigencia | Centralizar cálculo en servicio compartido con SPEC-212/213. |

## Criterios de aceptación técnica

- Gate local completo.
- Tests de integración pasan.
- `arch:check` verde.
