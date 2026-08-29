# Plan de implementación: SPEC-213 — Motor vigencia + estados (002-PI-113)

## Resumen

Crear el worker `scripts/worker-vigencia-pagos.mjs` que corre una vez al día, evalúa vigencias y ejecuta transiciones automáticas de la máquina de estados. Incluye integración con Motor de Notificaciones, `AuditLog`, idempotencia y servicio Docker.

## Contexto técnico

- **Runtime**: Node.js >=22.
- **ORM**: Prisma 5.22.0.
- **Colas**: `pg-boss` ya usado por otros workers.
- **Timezone**: `America/Bogota` hardcoded v1 (D-69).
- **Patrón worker**: advisory lock de PostgreSQL, igual que `scripts/worker-reportes.mjs`.

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
specs/213-motor-vigencia-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 213-motor-vigencia.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
scripts/worker-vigencia-pagos.mjs
scripts/worker-vigencia-pagos.test.ts
src/lib/pagos/vigencia.service.ts
src/lib/pagos/vigencia.service.test.ts
src/lib/dal/repositories/pagos-repository.ts     # métodos adicionales
docker-compose.yml                                # servicio pi-vigencia
docker-compose.prod.yml                           # servicio pi-vigencia
```

## Cambios de código

### 1. Worker `scripts/worker-vigencia-pagos.mjs`

Basado en `worker-reportes.mjs`:
- Conectar a PostgreSQL.
- Adquirir advisory lock con ID único.
- Leer `pagos.vigencia.hora_corrida`.
- Esperar hasta la hora configurada (o correr inmediato si se ejecuta manualmente con flag `--now`).
- Ejecutar `vigencia.service.ejecutarCorrida()`.
- Registrar `pagos.vigencia.ultima_corrida`.
- Salir con código 0; si no adquiere lock, código 2.

### 2. Servicio `vigencia.service.ts`

Responsabilidades:
- Obtener suscripciones candidatas:
  - `ACTIVA` con `fechaFin <= hoy`.
  - `EN_GRACIA` con `fechaCorteProgramado <= hoy`.
  - `ACTIVA` con `esFreemium=true` y `freemiumFechaFin < hoy`.
- Para cada candidata, ejecutar transición vía `PagosRepository`.
- Registrar `AuditLog`.
- Emitir eventos al motor notif.
- Programar notificaciones futuras (T-5, T-1, T+2).

### 3. Repositorio DAL

Extender `PagosRepository` con:
- `listarSuscripcionesActivasPorVencer(fecha)`.
- `listarSuscripcionesEnGraciaPorCortar(fecha)`.
- `listarSuscripcionesFreemiumVencidas(fecha)`.
- `transitarEstado(suscripcionId, nuevoEstado, data)`.
- `guardarUltimaCorrida(fecha)` / `obtenerUltimaCorrida()`.

### 4. Docker Compose

Agregar servicio:
```yaml
pi-vigencia:
  build: .
  command: node scripts/worker-vigencia-pagos.mjs
  environment:
    TZ: America/Bogota
    DATABASE_URL: ${DATABASE_URL}
  depends_on:
    - db
    - app
```

### 5. Tests

- Test de simulación de transiciones.
- Test de idempotencia.
- Test de emisión de eventos.
- Test de advisory lock (segundo worker devuelve 2).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Motor notif no tiene las 18 reglas sembradas | Verificar catálogo al inicio; abortar con log claro si falta alguna. |
| Doble ejecución del worker | Advisory lock + `ultima_corrida`. |
| Drift de timezone | `date-fns-tz` + `TZ=America/Bogota` + Timestamptz(6). |
| Gran volumen de suscripciones | Procesamiento paginado en lotes de 100. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests de simulación e idempotencia pasan.
- `docker-compose config` válido.
